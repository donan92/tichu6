// Explicit-GC ownership regression, complementary to real workerd heap snapshots.
// Run: node --expose-gc scripts/performance/retention.mjs
import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { GameExecutor } from '../../server/game/executor.ts';
import { Snapshots } from '../../server/room/snapshots.ts';
import { RoomEngine } from '../../server/game/room-engine.ts';
import { newGame, startRound, deck } from '../../src/game.js';
if (!global.gc) throw Error('Run with --expose-gc');
const weak = { states: [], sockets: [], engines: [] };
const executor = new GameExecutor();
let active = [];
const connections = {
  users: () => active,
  presence: () => new Map(),
  attachment: (ws) => ws.attachment,
  authenticated: (ws) => ws.attachment,
  send: () => true,
};
const snapshots = new Snapshots({ data: { rooms: {} } }, connections);
async function churn() {
  for (let i = 0; i < 300; i++) {
    const state = startRound(newGame(), deck());
    await executor.bot('room' + i, state, 0);
    weak.states.push(new WeakRef(state));
    const ws = {
      attachment: { hash: 'identity' + i, room: null, watch: false },
    };
    active = [ws];
    snapshots.broadcast();
    weak.sockets.push(new WeakRef(ws));
    let last;
    const ctx = {
      blockConcurrencyWhile: async (fn) => fn(),
      storage: {
        get: async () => last,
        put: async (_key, value) => {
          last = structuredClone(value);
        },
        getAlarm: async () => null,
        setAlarm: async () => {},
      },
    };
    const engine = new RoomEngine(ctx);
    await engine.fetch(
      new Request('https://internal/transition', {
        method: 'POST',
        body: JSON.stringify({ operation: 'start', state: newGame() }),
      }),
    );
    weak.engines.push(new WeakRef(engine));
  }
  active = [];
}
await churn();
const samples = [];
for (let i = 0; i < 8; i++) {
  await pause(20);
  global.gc();
  await pause(20);
  samples.push(process.memoryUsage());
}
const retained = Object.fromEntries(
  Object.entries(weak).map(([kind, refs]) => [
    kind,
    refs.filter((ref) => ref.deref() !== undefined).length,
  ]),
);
assert.deepEqual(retained, { states: 0, sockets: 0, engines: 0 });
console.log(
  JSON.stringify(
    {
      result: 'PASS',
      createdPerKind: 300,
      retained,
      samples,
      note: 'Node ownership test, not workerd or production GC timing.',
    },
    null,
    2,
  ),
);
