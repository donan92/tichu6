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
  await a.actor.alarm();
  assert.equal(a.store.size, 0);
  assert.equal(b.store.size, 1);
});
