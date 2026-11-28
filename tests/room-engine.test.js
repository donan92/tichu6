import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomEngine } from '../server/game/room-engine.ts';
import { newGame } from '../src/game.js';

function engine() {
  const store = new Map();
  let writes = 0;
  const ctx = {
    blockConcurrencyWhile: async (fn) => fn(),
    storage: {
      get: async (key) => structuredClone(store.get(key)),
      put: async (key, value) => {
        writes++;
        store.set(key, structuredClone(value));
      },
      getAlarm: async () => null,
      setAlarm: async () => {},
      deleteAll: async () => store.clear(),
    },
  };
  return { ctx, store, writes: () => writes, actor: new RoomEngine(ctx) };
}
const send = async (actor, payload) =>
  (
    await actor.fetch(
      new Request('https://internal/transition', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    )
  ).json();

test('room engines persist idempotent transitions across reconstruction and remain isolated', async () => {
  const a = engine(),
    b = engine();
  const request = { operation: 'start', state: newGame() };
  const first = await send(a.actor, request);
  assert.equal(first.state.phase, 'grand');
  assert.deepEqual(await send(new RoomEngine(a.ctx), request), first);
  assert.equal(a.writes(), 1);
  assert.equal(b.store.size, 0);
  await send(b.actor, request);
  assert.equal(b.writes(), 1);
  const denied = await send(a.actor, {
    operation: 'act',
    state: first.state,
    seat: 0,
    action: { type: 'pass' },
  });
  assert.ok(denied.error);
  assert.equal(a.writes(), 1);
  a.store.set('last', { ...a.store.get('last'), expiresAt: Date.now() - 1 });
  await a.actor.alarm();
  assert.equal(a.store.size, 0);
  assert.equal(b.store.size, 1);
  await send(a.actor, request);
  assert.equal(a.writes(), 2, 'expired warm result must not survive cleanup');
});

test('engine keeps the first cleanup alarm, extends expiry in the committed result and repairs failed alarm writes', async () => {
  const f = engine();
  let at = null,
    writes = 0,
    fail = true;
  f.ctx.storage.getAlarm = async () => at;
  f.ctx.storage.setAlarm = async (value) => {
    writes++;
    if (fail) {
      fail = false;
      throw Error('alarm failure');
    }
    at = value;
  };
  const request = { operation: 'start', state: newGame() };
  const rejected = await send(f.actor, request);
  assert.ok(rejected.error);
  const first = await send(f.actor, request);
  assert.equal(first.state.phase, 'grand');
  assert.equal(f.writes(), 1);
  assert.equal(writes, 2);
  await send(f.actor, { operation: 'bot', state: first.state, seat: 0 });
  assert.equal(
    writes,
    2,
    'later expiration does not rewrite the earlier alarm',
  );
  const cached = f.store.get('last');
  at = null;
  await f.actor.alarm();
  assert.deepEqual(
    f.store.get('last'),
    cached,
    'early cleanup must not erase a recently used result',
  );
  assert.equal(at, cached.expiresAt);
  const reconstructed = new RoomEngine(f.ctx);
  const result = await send(reconstructed, {
    operation: 'bot',
    state: first.state,
    seat: 0,
  });
  assert.deepEqual(result.action, { type: 'grand', call: false });
  assert.equal(f.writes(), 2);
});

test('engine reloads a possibly committed result after a storage rejection before retrying a deal', async () => {
  const f = engine();
  const original = f.ctx.storage.put;
  let fail = true;
  f.ctx.storage.put = async (...args) => {
    await original(...args);
    if (fail) {
      fail = false;
      throw Error('uncertain commit');
    }
  };
  const payload = { operation: 'start', state: newGame() };
  assert.ok((await send(f.actor, payload)).error);
  const committed = structuredClone(f.store.get('last').value);
  assert.deepEqual(await send(f.actor, payload), committed);
  assert.equal(f.writes(), 1);
});
