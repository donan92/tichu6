import test from 'node:test';
import assert from 'node:assert/strict';
import { Lounge, nickname, publicView } from '../server/lounge.ts';
import { newGame, startRound } from '../src/game.js';
globalThis.WebSocketRequestResponsePair = class {};
function socket() {
  return {
    readyState: 1,
    a: { created: Date.now(), window: Date.now(), requests: 0 },
    messages: [],
    deserializeAttachment() {
      return structuredClone(this.a);
    },
    serializeAttachment(a) {
      this.a = structuredClone(a);
    },
    send(s) {
      this.messages.push(JSON.parse(s));
    },
    close(code) {
      this.readyState = 3;
      this.code = code;
    },
  };
}
async function setup() {
  const values = new Map();
  const sockets = [];
  let queue = Promise.resolve();
  const storage = {
    async get(key) {
      return structuredClone(values.get(key));
    },
    async put(key, value) {
      if (typeof key === 'string') values.set(key, structuredClone(value));
      else
        for (const [k, v] of Object.entries(key))
          values.set(k, structuredClone(v));
    },
    async setAlarm() {},
    async deleteAlarm() {},
  };
  const ctx = {
    storage,
    getWebSockets: () => sockets,
    setWebSocketAutoResponse() {},
    blockConcurrencyWhile(fn) {
      const p = queue.then(fn);
      queue = p.catch(() => {});
      return p;
    },
  };
  const hub = new Lounge(ctx);
  await queue;
  return { hub, sockets, ctx, ready: () => queue };
}
async function user(f, i, name = 'Tester') {
  const ws = socket();
  f.sockets.push(ws);
  const token = i.toString(16).padStart(64, '0');
  await f.hub.webSocketMessage(
    ws,
    JSON.stringify({ type: 'hello', name, token }),
  );
  return ws;
}
const msg = (hub, ws, message) =>
  hub.webSocketMessage(ws, JSON.stringify(message));
const last = (ws, type) => ws.messages.filter((m) => m.type === type).at(-1);
test('nicknames accept only 1 to 8 ASCII letters and digits, preserving case', () => {
  for (const s of ['a', 'Z', '0', 'Ab12Cd34', '12345678'])
    assert.equal(nickname(s), s);
  for (const s of [
    '',
    'Ab1234569',
    '한글',
    'é',
    'Ａ',
    '１',
    'hello!',
    'a_b',
    'a b',
    ' a',
    'a ',
    'a\n',
    '😀',
    null,
    123,
  ])
    assert.throws(() => nickname(s));
});
test('31 simultaneous identities yield exactly 30 admissions; reconnect takes no extra slot', async () => {
  const f = await setup();
  const users = await Promise.all(
    Array.from({ length: 31 }, (_, i) => user(f, i + 1)),
  );
  assert.equal(f.hub.users().length, 30);
  assert.equal(users.filter((w) => last(w, 'welcome')).length, 30);
  const replacement = await user(f, 1);
  assert.ok(last(replacement, 'welcome'));
  assert.equal(f.hub.users().length, 30);
  assert.equal(users[0].code, 4001);
});
test('simultaneous room creation cannot exceed five and server supplies nonempty titles', async () => {
  const f = await setup();
  const users = await Promise.all(
    Array.from({ length: 6 }, (_, i) => user(f, i + 1)),
  );
  await Promise.all(
    users.map((w) => msg(f.hub, w, { type: 'create', name: 'Star' })),
  );
  assert.equal(Object.keys(f.hub.data.rooms).length, 5);
  for (const r of Object.values(f.hub.data.rooms))
    assert.ok(r.title.adjective && r.title.noun && r.title.number);
  assert.equal(last(users[5], 'error').code, 'error.roomsFull');
});
test('spectators see dealt hands, cannot act or spoof a seat, and count globally', async () => {
  const f = await setup();
  const users = await Promise.all(
    Array.from({ length: 7 }, (_, i) => user(f, i + 1)),
  );
  await msg(f.hub, users[0], { type: 'create', name: 'Host' });
  const id = Object.keys(f.hub.data.rooms)[0];
  for (let i = 1; i < 6; i++)
    await msg(f.hub, users[i], {
      type: 'join',
      roomId: id,
      watch: false,
      name: 'Friend',
    });
  await msg(f.hub, users[6], {
    type: 'join',
    roomId: id,
    watch: true,
    name: 'Watcher',
  });
  await msg(f.hub, users[0], {
    type: 'action',
    revision: 0,
    action: { type: 'start' },
  });
  const snapshot = last(users[6], 'state').value;
  assert.equal(snapshot.seat, -1);
  assert.deepEqual(snapshot.hand, []);
  assert.deepEqual(
    snapshot.spectatorHands.map((hand) => hand.length),
    [10, 10, 10, 10, 10, 10],
  );
  assert.equal('spectatorHands' in last(users[0], 'state').value, false);
  for (const key of ['hands', 'first', 'exchanges', 'members'])
    assert.equal(key in snapshot, false);
  assert.equal(last(users[0], 'state').value.hand.length, 10);
  assert.equal(last(users[6], 'directory').count, 7);
  await msg(f.hub, users[6], {
    type: 'action',
    seat: 0,
    revision: 1,
    action: { type: 'grand', call: true },
  });
  assert.equal(last(users[6], 'error').code, 'error.spectator');
  assert.equal(f.hub.data.rooms[id].state.revision, 1);
  assert.equal(f.hub.data.rooms[id].state.ready[0], false);
});
test('leaving waiting room frees seat and deletes empty room without leaking identity', async () => {
  const f = await setup(),
    a = await user(f, 1);
  await msg(f.hub, a, { type: 'create', name: 'Name' });
  assert.equal(Object.keys(f.hub.data.rooms).length, 1);
  const directory = last(a, 'directory');
  assert.equal(JSON.stringify(directory).includes('hash'), false);
  await msg(f.hub, a, { type: 'leave' });
  assert.equal(Object.keys(f.hub.data.rooms).length, 0);
});
test('saved games survive reconstruction, reconnect authenticates original seat', async () => {
  const f = await setup(),
    a = await user(f, 1);
  await msg(f.hub, a, { type: 'create', name: 'Name' });
  const id = Object.keys(f.hub.data.rooms)[0];
  f.hub.data.rooms[id].state = startRound(newGame());
  await f.hub.persist();
  const hand = f.hub.data.rooms[id].state.hands[0];
  a.readyState = 3;
  await f.hub.disconnected(a);
  const restored = new Lounge(f.ctx);
  await f.ready();
  f.hub = restored;
  const b = socket();
  f.sockets.push(b);
  await msg(restored, b, {
    type: 'hello',
    token: '1'.padStart(64, '0'),
    name: 'Return',
    roomId: id,
  });
  assert.equal(last(b, 'state').value.seat, 0);
  assert.deepEqual(restored.data.rooms[id].state.hands[0], hand);
});
test('oversized and unauthenticated requests are rejected; flooding closes a connection', async () => {
  const f = await setup();
  const a = socket();
  f.sockets.push(a);
  await msg(f.hub, a, { type: 'create', name: 'Name' });
  assert.equal(a.code, 4003);
  const b = await user(f, 2);
  await f.hub.webSocketMessage(b, 'x'.repeat(4097));
  assert.equal(last(b, 'error').code, 'error.payload');
  assert.equal(b.code, 1009);
  const c = await user(f, 3);
  for (let i = 0; i < 31; i++) await msg(f.hub, c, { type: 'unknown' });
  assert.equal(c.code, 4008);
  assert.equal(Object.keys(f.hub.data.rooms).length, 0);
});
test('public view excludes private storage even when engine gains extra properties', () => {
  const s = startRound(newGame());
  s.futureSecret = 'secret';
  assert.equal('futureSecret' in publicView(s), false);
});

test('offline player advances after grace; all-offline rooms pause and expire', async () => {
  const f = await setup(),
    a = await user(f, 1),
    b = await user(f, 2);
  await msg(f.hub, a, { type: 'create', name: 'Check' });
  const id = Object.keys(f.hub.data.rooms)[0];
  await msg(f.hub, b, {
    type: 'join',
    roomId: id,
    watch: false,
    name: 'Friend',
  });
  const r = f.hub.data.rooms[id];
  r.state = startRound(newGame());
  a.readyState = 3;
  await f.hub.disconnected(a);
  r.members[0].offlineSince = Date.now() - 46000;
  await f.hub.alarm();
  assert.equal(r.state.ready[0], true);
  b.readyState = 3;
  await f.hub.disconnected(b);
  r.members[1].offlineSince = Date.now() - 46000;
  const revision = r.state.revision;
  await f.hub.alarm();
  assert.equal(r.state.revision, revision);
  r.lastActive = Date.now() - 86400001;
  await f.hub.alarm();
  assert.equal(f.hub.data.rooms[id], undefined);
});
test('invalid actions and stale revisions never change game state', async () => {
  const f = await setup(),
    a = await user(f, 1);
  await msg(f.hub, a, { type: 'create', name: 'Check' });
  const r = Object.values(f.hub.data.rooms)[0];
  r.state = startRound(newGame());
  const before = structuredClone(r.state);
  for (const action of [
    { type: 'grand', call: 'yes' },
    { type: 'play', ids: [{}] },
    { type: 'start' },
  ]) {
    await msg(f.hub, a, { type: 'action', revision: r.state.revision, action });
    assert.deepEqual(r.state, before);
  }
  await msg(f.hub, a, {
    type: 'action',
    revision: 0,
    action: { type: 'grand', call: false },
  });
  assert.deepEqual(r.state, before);
});

test('one human starts with five persistent bots, advances, reconnects and pauses when alone offline', async () => {
  const f = await setup(),
    owner = await user(f, 101, 'Solo');
  await msg(f.hub, owner, { type: 'create', name: 'Solo' });
  const r = Object.values(f.hub.data.rooms)[0];
  await msg(f.hub, owner, {
    type: 'action',
    revision: 0,
    action: { type: 'start' },
  });
  let snapshot = last(owner, 'state').value;
  const seat = snapshot.seat;
  assert.equal(snapshot.names[seat], 'Solo');
  assert.equal(snapshot.bots.filter(Boolean).length, 5);
  assert.equal(snapshot.hand.length, 10);
  assert.equal(f.hub.users().length, 1);
  assert.equal(r.members.filter((m) => m.bot).length, 5);
  for (let i = 0; i < 5; i++) await f.hub.alarm();
  assert.equal(r.state.ready.filter(Boolean).length, 5);
  await msg(f.hub, owner, {
    type: 'action',
    revision: r.state.revision,
    action: { type: 'grand', call: false },
  });
  assert.equal(last(owner, 'state').value.hand.length, 18);
  for (let i = 0; i < 5; i++) await f.hub.alarm();
  assert.equal(r.state.exchanges.filter(Boolean).length, 5);
  const saved = structuredClone(r);
  const restoredHub = new Lounge(f.ctx);
  await f.ready();
  assert.deepEqual(restoredHub.data.rooms[r.id].members, saved.members);
  owner.readyState = 3;
  await f.hub.disconnected(owner);
  const revision = r.state.revision;
  await f.hub.alarm();
  assert.equal(r.state.revision, revision);
  const back = await user(f, 101, 'Solo');
  await msg(f.hub, back, {
    type: 'join',
    roomId: r.id,
    watch: false,
    name: 'Solo',
  });
  snapshot = last(back, 'state').value;
  assert.equal(snapshot.seat, seat);
  assert.equal(snapshot.bots.filter(Boolean).length, 5);
});

test('randomized membership preserves identity/name pairs and teams through following rounds', async () => {
  const f = await setup(),
    users = await Promise.all(
      [1, 2, 3].map((i) => user(f, 200 + i, `User${i}`)),
    );
  await msg(f.hub, users[0], { type: 'create', name: 'User1' });
  const r = Object.values(f.hub.data.rooms)[0];
  for (let i = 1; i < 3; i++)
    await msg(f.hub, users[i], {
      type: 'join',
      roomId: r.id,
      watch: false,
      name: `User${i + 1}`,
    });
  await msg(f.hub, users[1], {
    type: 'action',
    revision: 0,
    action: { type: 'start' },
  });
  assert.equal(last(users[1], 'error').code, 'error.coordinator');
  assert.equal(r.state.phase, 'lobby');
  await msg(f.hub, users[0], {
    type: 'action',
    revision: 0,
    action: { type: 'start' },
  });
  const members = structuredClone(r.members),
    names = [...r.state.names];
  for (let i = 0; i < 3; i++) {
    const s = last(users[i], 'state').value;
    assert.equal(s.names[s.seat], `User${i + 1}`);
    assert.equal(r.members[s.seat].hash, users[i].a.hash);
    assert.equal(s.hand.length, 10);
  }
  r.state.phase = 'roundEnd';
  const leader = users.find(
    (u) =>
      r.members.findIndex((m) => m.hash === u.a.hash) ===
      f.hub.online(r).findIndex(Boolean),
  );
  await msg(f.hub, leader, {
    type: 'action',
    revision: r.state.revision,
    action: { type: 'next' },
  });
  assert.deepEqual(r.members, members);
  assert.deepEqual(r.state.names, names);
  assert.equal(r.state.round, 2);
});

test('one through six humans are balanced between teams, including odd counts', async () => {
  for (let count = 1; count <= 6; count++) {
    const f = await setup();
    const users = await Promise.all(
      Array.from({ length: count }, (_, i) => user(f, 300 + i)),
    );
    await msg(f.hub, users[0], { type: 'create', name: 'Human0' });
    const r = Object.values(f.hub.data.rooms)[0];
    for (let i = 1; i < count; i++)
      await msg(f.hub, users[i], {
        type: 'join',
        roomId: r.id,
        watch: false,
        name: `Human${i}`,
      });
    await msg(f.hub, users[0], {
      type: 'action',
      revision: 0,
      action: { type: 'start' },
    });
    const humans = [0, 1].map(
      (team) => r.members.filter((m, i) => i % 2 === team && !m.bot).length,
    );
    assert.equal(humans[0] + humans[1], count);
    assert.ok(Math.abs(humans[0] - humans[1]) <= 1);
    assert.equal(r.members.filter((m) => m.bot).length, 6 - count);
  }
});
const IDLE = 30 * 60 * 1000;
test('idle deadline logs out hall users and spectators and frees capacity', async (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const f = await setup();
  const owner = await user(f, 1);
  await msg(f.hub, owner, { type: 'create', name: 'Owner' });
  const roomId = owner.a.room;
  const watcher = await user(f, 2);
  await msg(f.hub, watcher, {
    type: 'join',
    roomId,
    watch: true,
    name: 'Watcher',
  });
  const hall = await user(f, 3);
  now += IDLE - 1;
  await f.hub.alarm();
  assert.equal(watcher.readyState, 1);
  assert.equal(hall.readyState, 1);
  now++;
  await f.hub.alarm();
  for (const ws of [owner, watcher, hall]) {
    assert.equal(ws.code, 4009);
    assert.equal(ws.a.hash, undefined);
  }
  assert.equal(f.hub.users().length, 0);
  assert.equal(Object.keys(f.hub.data.rooms).length, 0);
  assert.ok(last(await user(f, 4), 'welcome'));
});
test('only accepted user requests refresh inactivity; broadcasts and invalid actions do not', async (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const f = await setup(),
    ws = await user(f, 1);
  const hash = ws.a.hash;
  now += IDLE - 1000;
  await msg(f.hub, ws, { type: 'create', name: 'Owner' });
  const at = f.hub.data.activity[hash];
  now += 500;
  await msg(f.hub, ws, {
    type: 'action',
    revision: -1,
    action: { type: 'start' },
  });
  f.hub.broadcast();
  await f.hub.alarm();
  assert.equal(f.hub.data.activity[hash], at);
  now = at + IDLE;
  const revision = f.hub.data.rooms[ws.a.room].state.revision;
  await msg(f.hub, ws, { type: 'action', revision, action: { type: 'start' } });
  assert.equal(ws.code, 4009);
  assert.equal(f.hub.users().length, 0);
});
test('idle takeover survives hibernation, advances without grace and allows explicit same-seat return', async (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const f = await setup(),
    ws = await user(f, 1);
  await msg(f.hub, ws, { type: 'create', name: 'Owner' });
  const roomId = ws.a.room;
  await msg(f.hub, ws, {
    type: 'action',
    revision: 0,
    action: { type: 'start' },
  });
  let r = f.hub.data.rooms[roomId];
  const seat = r.members.findIndex((m) => m?.hash === ws.a.hash);
  const hand = structuredClone(r.state.hands[seat]);
  // Bot progress midway through the user idle window keeps the room alive.
  now += IDLE / 2;
  r.lastProgress = now;
  // Already completed bot decisions, leaving the human as the only blocker.
  r.state.ready = r.members.map((m) => !!m.bot);
  await f.hub.persist();
  f.hub = new Lounge(f.ctx);
  await f.ready();
  now += IDLE / 2;
  await f.hub.alarm();
  r = f.hub.data.rooms[roomId];
  assert.equal(ws.code, 4009);
  assert.equal(r.members[seat].idle, true);
  assert.equal(r.state.phase, 'exchange');
  assert.equal(f.hub.users().length, 0);
  const retry = await user(f, 1);
  assert.equal(retry.code, 4009);
  const manual = socket();
  f.sockets.push(manual);
  await msg(f.hub, manual, {
    type: 'hello',
    token: '1'.padStart(64, '0'),
    name: 'Owner',
    roomId,
    manual: true,
  });
  assert.ok(last(manual, 'welcome'));
  assert.equal(last(manual, 'state').value.seat, seat);
  assert.deepEqual(last(manual, 'state').value.hand, hand);
  assert.equal(r.members[seat].idle, false);
});
test('automatic reconnect keeps the existing idle deadline', async (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const f = await setup(),
    ws = await user(f, 1);
  const hash = ws.a.hash,
    at = f.hub.data.activity[hash];
  now += IDLE - 1;
  ws.close(1006);
  await f.hub.webSocketClose(ws, 1006);
  const retry = await user(f, 1);
  assert.equal(f.hub.data.activity[hash], at);
  now++;
  await f.hub.alarm();
  assert.equal(retry.code, 4009);
});
test('upgrade persists old socket idle baselines across repeated hibernation', async (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const f = await setup(),
    ws = await user(f, 1);
  const hash = ws.a.hash;
  delete f.hub.data.activity;
  await f.hub.persist();
  f.hub = new Lounge(f.ctx);
  await f.ready();
  const at = f.hub.data.activity[hash];
  now += IDLE - 1;
  f.hub = new Lounge(f.ctx);
  await f.ready();
  assert.equal(f.hub.data.activity[hash], at);
  await f.hub.alarm();
  assert.equal(ws.readyState, 1);
  now++;
  await f.hub.alarm();
  assert.equal(ws.code, 4009);
});
test('forfeit is authenticated, hands the seat to a bot immediately and prevents reclaim', async () => {
  const f = await setup(),
    owner = await user(f, 1),
    other = await user(f, 2),
    watcher = await user(f, 3);
  await msg(f.hub, owner, { type: 'create', name: 'Owner' });
  const id = owner.a.room;
  await msg(f.hub, other, {
    type: 'join',
    roomId: id,
    name: 'Other',
    watch: false,
  });
  await msg(f.hub, watcher, {
    type: 'join',
    roomId: id,
    name: 'Watcher',
    watch: true,
  });
  await msg(f.hub, owner, {
    type: 'action',
    revision: 0,
    action: { type: 'start' },
  });
  const r = f.hub.data.rooms[id];
  const seat = r.members.findIndex((m) => m?.hash === owner.a.hash);
  const before = structuredClone(r);
  await msg(f.hub, watcher, { type: 'forfeit', seat });
  assert.equal(last(watcher, 'error').code, 'error.cannotForfeit');
  assert.deepEqual(r, before);
  r.state.ready = Array(6).fill(true);
  r.state.ready[seat] = false;
  await msg(f.hub, owner, { type: 'forfeit', seat: (seat + 1) % 6 });
  assert.equal(r.members[seat].bot, true);
  assert.equal(r.members[seat].hash, undefined);
  assert.ok(last(owner, 'hall'));
  await f.hub.alarm();
  assert.equal(r.state.phase, 'exchange');
  await msg(f.hub, owner, {
    type: 'join',
    roomId: id,
    name: 'Owner',
    watch: false,
  });
  assert.equal(last(owner, 'error').code, 'error.watchOnly');
  await msg(f.hub, owner, {
    type: 'join',
    roomId: id,
    name: 'Owner',
    watch: true,
  });
  assert.equal(last(owner, 'state').value.spectator, true);
  assert.equal('exchangeReview' in last(owner, 'state').value, false);
  assert.equal('exchangeReview' in last(watcher, 'state').value, false);
});

test('room progress expires at 30 minutes despite presence and spectators', async () => {
  const f = await setup();
  const owner = await user(f, 1001);
  await msg(f.hub, owner, { type: 'create', name: 'Owner' });
  const id = owner.a.room;
  const watcher = await user(f, 1002);
  await msg(f.hub, watcher, {
    type: 'join',
    roomId: id,
    watch: true,
    name: 'Watch',
  });
  const room = f.hub.data.rooms[id];
  const deadline = room.lastProgress + 30 * 60 * 1000;
  f.hub.refreshPresence();
  assert.equal(f.hub.expireStalledRooms(deadline - 1), false);
  assert.equal(f.hub.expireStalledRooms(deadline), true);
  assert.equal(f.hub.data.rooms[id], undefined);
  for (const ws of [owner, watcher]) {
    assert.equal(ws.a.room, null);
    assert.equal(ws.a.watch, false);
    assert.equal(ws.readyState, 1);
  }
  await f.hub.persist();
  const restored = new Lounge(f.ctx);
  await f.ready();
  assert.equal(restored.data.rooms[id], undefined);
});

test('only accepted game actions extend room progress and expired actions cannot revive it', async () => {
  const f = await setup();
  const owner = await user(f, 1003);
  await msg(f.hub, owner, { type: 'create', name: 'Owner' });
  const id = owner.a.room;
  const room = f.hub.data.rooms[id];
  room.lastProgress = Date.now() - 60000;
  const before = room.lastProgress;
  await msg(f.hub, owner, {
    type: 'action',
    revision: -1,
    action: { type: 'start' },
  });
  assert.equal(room.lastProgress, before);
  await msg(f.hub, owner, {
    type: 'action',
    revision: room.state.revision,
    action: { type: 'start' },
  });
  assert.ok(room.lastProgress > before);
  room.lastProgress = Date.now() - 30 * 60 * 1000;
  await msg(f.hub, owner, {
    type: 'action',
    revision: room.state.revision,
    action: { type: 'grand', call: false },
  });
  assert.equal(f.hub.data.rooms[id], undefined);
  assert.equal(owner.a.room, null);
  assert.equal(last(owner, 'hall').type, 'hall');
});

test('bot progress extends the room deadline but cannot revive an expired room', async () => {
  const f = await setup();
  const owner = await user(f, 1004);
  await msg(f.hub, owner, { type: 'create', name: 'Owner' });
  const id = owner.a.room;
  const room = f.hub.data.rooms[id];
  await msg(f.hub, owner, {
    type: 'action',
    revision: room.state.revision,
    action: { type: 'start' },
  });
  room.lastProgress = Date.now() - 60000;
  const before = room.lastProgress;
  await f.hub.alarm();
  assert.ok(room.lastProgress > before);
  room.lastProgress = Date.now() - 30 * 60 * 1000;
  await f.hub.alarm();
  assert.equal(f.hub.data.rooms[id], undefined);
});

test('room progress migration grants one window and survives repeated hibernation', async (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const f = await setup();
  const owner = await user(f, 1005);
  await msg(f.hub, owner, { type: 'create', name: 'Owner' });
  const id = owner.a.room;
  delete f.hub.data.rooms[id].lastProgress;
  await f.hub.persist();
  f.hub = new Lounge(f.ctx);
  await f.ready();
  const baseline = f.hub.data.rooms[id].lastProgress;
  assert.equal(baseline, now);
  now += 60000;
  f.hub = new Lounge(f.ctx);
  await f.ready();
  assert.equal(f.hub.data.rooms[id].lastProgress, baseline);
});
test('accepted actions are persisted before state acknowledgement after service extraction', async () => {
  const f = await setup();
  const ws = await user(f, 1);
  await msg(f.hub, ws, { type: 'create', name: 'Host' });
  const room = Object.values(f.hub.data.rooms)[0];
  let persistedRevision = room.state.revision;
  const put = f.ctx.storage.put.bind(f.ctx.storage);
  f.ctx.storage.put = async (key, value) => {
    await put(key, value);
    persistedRevision = (typeof key === 'string' ? value : key.lounge).rooms[
      room.id
    ].state.revision;
  };
  const send = ws.send.bind(ws);
  ws.send = (raw) => {
    const message = JSON.parse(raw);
    if (message.type === 'state')
      assert.equal(message.value.revision, persistedRevision);
    send(raw);
  };
  await msg(f.hub, ws, {
    type: 'action',
    revision: 0,
    action: { type: 'start' },
  });
  assert.equal(persistedRevision, 1);
  assert.equal(last(ws, 'state').value.phase, 'grand');
});

test('training is opt-in, records accepted own-perspective actions, persists and stops on withdrawal', async () => {
  const f = await setup();
  const ws = await user(f, 1);
  await msg(f.hub, ws, { type: 'create', name: 'Human' });
  await msg(f.hub, ws, {
    type: 'action',
    revision: 0,
    action: { type: 'start' },
  });
  const room = Object.values(f.hub.data.rooms)[0];
  const seat = room.members.findIndex((m) => m && !m.bot);
  assert.equal(f.hub.repository.training.sessions.length, 0);
  await msg(f.hub, ws, {
    type: 'trainingConsent',
    enabled: true,
    seat: (seat + 1) % 6,
  });
  assert.equal(room.members[seat].trainingConsent, true);
  assert.equal(room.members[(seat + 1) % 6].trainingConsent, undefined);
  await msg(f.hub, ws, {
    type: 'action',
    revision: room.state.revision,
    action: { type: 'grand', call: false },
  });
  const archive = f.hub.repository.training;
  assert.equal(archive.sessions.length, 1);
  const record = archive.sessions[0].events[0];
  assert.equal(record.seat, seat);
  assert.equal(record.ownHand.length, 10);
  assert.equal(record.source, 'human');
  assert.equal(JSON.stringify(archive).includes('Human'), false);
  assert.equal(JSON.stringify(last(ws, 'state')).includes('recordId'), false);
  await msg(f.hub, ws, {
    type: 'action',
    revision: -1,
    action: { type: 'pass' },
  });
  assert.equal(archive.sessions[0].events.length, 1);
  await msg(f.hub, ws, { type: 'trainingConsent', enabled: false });
  assert.equal(room.members[seat].trainingConsent, false);
  f.hub = new Lounge(f.ctx);
  await f.ready();
  assert.equal(f.hub.repository.training.sessions[0].events.length, 1);
  assert.equal(
    Object.values(f.hub.data.rooms)[0].members[seat].trainingConsent,
    false,
  );
});

test('training match grouping survives next round and reconnect, and changes for a new match', async () => {
  const f = await setup();
  const owner = await user(f, 901, 'Group');
  await msg(f.hub, owner, { type: 'create', name: 'Group' });
  const room = Object.values(f.hub.data.rooms)[0];
  await msg(f.hub, owner, {
    type: 'action',
    revision: room.state.revision,
    action: { type: 'start' },
  });
  const firstMatch = room.trainingMatch;
  assert.match(firstMatch, /^[0-9a-f-]{36}$/);
  assert.equal(
    JSON.stringify(last(owner, 'state').value).includes('trainingMatch'),
    false,
  );

  room.state.phase = 'roundEnd';
  room.state.delta = [0, 0];
  await msg(f.hub, owner, {
    type: 'action',
    revision: room.state.revision,
    action: { type: 'next' },
  });
  assert.equal(room.trainingMatch, firstMatch);

  owner.readyState = 3;
  await f.hub.disconnected(owner);
  const returned = await user(f, 901, 'Group');
  await msg(f.hub, returned, {
    type: 'join',
    roomId: room.id,
    watch: false,
    name: 'Group',
  });
  assert.equal(room.trainingMatch, firstMatch);

  const other = await user(f, 902, 'Other');
  await msg(f.hub, other, { type: 'create', name: 'Other' });
  const otherRoom = Object.values(f.hub.data.rooms).find(
    (value) => value.id !== room.id,
  );
  await msg(f.hub, other, {
    type: 'action',
    revision: otherRoom.state.revision,
    action: { type: 'start' },
  });
  assert.notEqual(otherRoom.trainingMatch, firstMatch);
});
