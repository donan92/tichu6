import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomRepository } from '../server/persistence/room.repository.ts';
import { Alarm } from '../server/persistence/alarm.ts';
import { GameExecutor } from '../server/game/executor.ts';
import { newGame, startRound } from '../src/game.js';

function storage() {
  const values = new Map();
  const calls = [];
  let alarm = null,
    fail = false;
  return {
    values,
    calls,
    fail() {
      fail = true;
    },
    async get(key) {
      calls.push(['get', key]);
      return structuredClone(values.get(key));
    },
    async put(batch) {
      calls.push(['put', Object.keys(batch)]);
      if (fail) {
        fail = false;
        throw Error('disk');
      }
      for (const [k, v] of Object.entries(batch))
        values.set(k, structuredClone(v));
    },
    async getAlarm() {
      calls.push(['getAlarm']);
      return alarm;
    },
    async setAlarm(at) {
      calls.push(['setAlarm', at]);
      if (fail) {
        fail = false;
        throw Error('disk');
      }
      alarm = at;
    },
    async deleteAlarm() {
      calls.push(['deleteAlarm']);
      alarm = null;
    },
    fire() {
      alarm = null;
    },
  };
}
test('repository skips unchanged keys, separates training, retains dirty data after a failed atomic put', async () => {
  const store = storage(),
    repo = new RoomRepository(store);
  await repo.load();
  await repo.save();
  store.calls.length = 0;
  await repo.save();
  assert.equal(store.calls.length, 0);
  repo.data.activity.a = 1;
  await repo.save();
  assert.deepEqual(store.calls.pop(), ['put', ['lounge']]);
  repo.training.sessions.push({
    id: 'x',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    events: [],
  });
  repo.markTrainingDirty();
  repo.data.activity.a = 2;
  store.fail();
  await assert.rejects(repo.save(), /disk/);
  assert.equal(store.values.get('lounge').activity.a, 1);
  await repo.save();
  assert.deepEqual(store.calls.at(-1), ['put', ['lounge', 'training-v1']]);
  assert.equal(store.values.get('lounge').activity.a, 2);
  store.calls.length = 0;
  await repo.save();
  assert.equal(store.calls.length, 0);
  repo.training.sessions[0].createdAt = 0;
  await repo.save();
  assert.deepEqual(store.calls.at(-1), ['put', ['training-v1']]);
});
test('alarm caches null, suppresses duplicate writes, recovers after firing, restart and failure', async () => {
  const store = storage(),
    a = new Alarm(store);
  await a.update(null);
  await a.update(null);
  assert.deepEqual(store.calls, [['getAlarm']]);
  await Promise.all([a.update(100), a.update(100)]);
  assert.equal(store.calls.filter((c) => c[0] === 'setAlarm').length, 1);
  await new Alarm(store).update(100);
  assert.equal(store.calls.filter((c) => c[0] === 'setAlarm').length, 1);
  store.fail();
  await assert.rejects(a.update(200), /disk/);
  await a.update(200);
  assert.deepEqual(store.calls.at(-1), ['setAlarm', 200]);
  store.fire();
  a.fired();
  await a.update(200);
  assert.deepEqual(store.calls.at(-1), ['setAlarm', 200]);
  await a.update(300, true);
  assert.deepEqual(store.calls.at(-1), ['setAlarm', 200]);
  await a.update(null);
  await a.update(null);
  assert.equal(store.calls.filter((c) => c[0] === 'deleteAlarm').length, 1);
});
test('bot decisions reuse identical state only, and failed internal requests remain retryable', async () => {
  let calls = 0,
    fail = false;
  const engines = {
    idFromName: (x) => x,
    get: () => ({
      async fetch() {
        calls++;
        if (fail) {
          fail = false;
          return new Response('', { status: 503 });
        }
        return Response.json({ action: { type: 'grand', call: false } });
      },
    }),
  };
  const e = new GameExecutor(engines),
    s = startRound(newGame());
  await Promise.all([e.bot('a', s, 0), e.bot('a', s, 0)]);
  assert.equal(calls, 1);
  await e.bot('a', s, 1);
  assert.equal(calls, 2);
  s.revision++;
  await e.bot('a', s, 0);
  assert.equal(calls, 3);
  await e.bot('b', s, 0);
  assert.equal(calls, 4);
  fail = true;
  await assert.rejects(e.bot('a', structuredClone(s), 0));
  const next = structuredClone(s);
  fail = true;
  await assert.rejects(e.bot('a', next, 0));
  await e.bot('a', next, 0);
  assert.equal(calls, 7);
});
