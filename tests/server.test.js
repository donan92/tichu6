import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from '../server/worker.ts';
import worker from '../server/worker.ts';
import { newGame, startRound } from '../src/game.js';
globalThis.WebSocketRequestResponsePair = class {};
function fixture(data, sockets = []) {
  const storage = {
    value: structuredClone(data),
    alarm: null,
    async get() {
      return structuredClone(this.value);
    },
    async put(_k, v) {
      this.value = structuredClone(v);
    },
    async setAlarm(t) {
      this.alarm = t;
    },
    async deleteAll() {
      this.value = undefined;
    },
  };
  const ctx = {
    storage,
    getWebSockets: () => sockets,
    setWebSocketAutoResponse() {},
    blockConcurrencyWhile(fn) {
      const p = fn();
      this.ready = p;
      return p;
    },
  };
  return { ctx, storage };
}
const socket = (seat) => ({
  readyState: 1,
  attachment: { seat },
  messages: [],
  deserializeAttachment() {
    return this.attachment;
  },
  serializeAttachment(v) {
    this.attachment = v;
  },
  send(raw) {
    this.messages.push(JSON.parse(raw));
  },
  close() {
    this.readyState = 3;
  },
});
function data() {
  return {
    code: 'ABCDEFGHJK',
    state: startRound(newGame()),
    members: Array.from({ length: 6 }, (_, i) => ({
      hash: String(i),
      offlineSince: null,
    })),
    updated: Date.now(),
  };
}
test('durable state survives instance reconstruction; snapshots contain only own ten cards', async () => {
  const d = data(),
    ws = socket(2),
    { ctx, storage } = fixture(d, [ws]);
  let room = new GameRoom(ctx);
  await ctx.ready;
  room.data.state.scores = [123, 456];
  await room.save();
  room = new GameRoom(ctx);
  await ctx.ready;
  room.broadcast();
  assert.deepEqual(room.data.state.scores, [123, 456]);
  assert.deepEqual(room.data.state.hands, d.state.hands);
  assert.equal(ws.messages.at(-1).value.hand.length, 10);
  assert.equal('hands' in ws.messages.at(-1).value, false);
  assert.equal('members' in ws.messages.at(-1).value, false);
  assert.ok(storage.value);
});
test('offline host is acted for after grace, and its seat remains reclaimable', async () => {
  const d = data();
  d.members[0].offlineSince = Date.now() - 46000;
  const { ctx, storage } = fixture(d, [
    socket(1),
    socket(2),
    socket(3),
    socket(4),
    socket(5),
  ]);
  const room = new GameRoom(ctx);
  await ctx.ready;
  await room.alarm();
  assert.equal(room.data.state.ready[0], true);
  assert.equal(room.data.members[0].hash, '0');
  assert.equal(storage.value.state.revision, 2);
});
test('brief dropout does not trigger bot; disconnected lobby seats expire', async () => {
  const d = data();
  d.members[0].offlineSince = Date.now();
  const { ctx } = fixture(d, [socket(1)]);
  const room = new GameRoom(ctx);
  await ctx.ready;
  await room.alarm();
  assert.equal(room.data.state.ready[0], false);
  room.data.state = newGame();
  room.data.members[0].offlineSince = Date.now() - 46000;
  await room.alarm();
  assert.equal(room.data.members[0], null);
});
test('all-offline rooms retain state for 24 hours and expire afterwards', async () => {
  const d = data();
  const { ctx, storage } = fixture(d);
  const room = new GameRoom(ctx);
  await ctx.ready;
  await room.alarm();
  assert.equal(room.data.state.ready[0], false);
  assert.ok(storage.value);
  room.data.updated = Date.now() - 86400001;
  await room.alarm();
  assert.equal(storage.value, undefined);
});
test('old socket close never marks a replacement seat offline', async () => {
  const d = data(),
    old = socket(null),
    active = socket(0);
  const { ctx } = fixture(d, [active]);
  const room = new GameRoom(ctx);
  await ctx.ready;
  await room.webSocketClose(old, 1000);
  assert.equal(room.data.members[0].offlineSince, null);
});
test('expected admission/action errors do not escape the DO concurrency gate', async () => {
  const { ctx } = fixture(data());
  const room = new GameRoom(ctx);
  await ctx.ready;
  await assert.rejects(
    room.serial(async () => {
      throw new Error('expected');
    }),
    /expected/,
  );
  await ctx.ready;
});
test('worker rejects foreign origins before touching room storage', async () => {
  const response = await worker.fetch(
    new Request('https://worker/rooms', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    }),
    {},
  );
  assert.equal(response.status, 403);
});
