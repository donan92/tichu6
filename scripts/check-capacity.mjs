// Local-only sustained exercise: 100 identities, 20 active rooms, one bot/room.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import WebSocket from 'ws';
import { legalPlays } from '../src/game.js';
const base = process.env.TEST_API || 'http://localhost:8787';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw new Error('Capacity test is local-only.');
const clients = [];
const latency = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(fn, label) {
  const end = Date.now() + 30000;
  while (!fn()) {
    const failed = clients.find((c) => c.error);
    if (failed) throw new Error(`${label}: ${failed.error}`);
    if (Date.now() > end) throw new Error(`Timed out: ${label}`);
    await pause(20);
  }
}
async function connect(i, previous) {
  const c = {
    name: `Load${i}`,
    token: previous?.token || randomBytes(32).toString('hex'),
  };
  c.ws = new WebSocket(base.replace('http', 'ws') + '/lounge', {
    origin: 'http://localhost:5173',
  });
  clients.push(c);
  if (previous) previous.replacing = true;
  c.ws.on('close', (code) => {
    if (!c.replacing) c.error = `Unexpected socket close ${code}`;
  });
  c.ws.on('message', (raw) => {
    if (raw.toString() === 'pong') return;
    const m = JSON.parse(raw);
    if (m.type === 'state') c.state = m.value;
    if (m.type === 'directory') c.directory = m;
    if (m.type === 'welcome') c.welcome = true;
    if (m.type === 'error') c.error = m.code;
  });
  await new Promise((resolve, reject) => {
    c.ws.once('open', resolve);
    c.ws.once('error', reject);
  });
  c.ws.send(
    JSON.stringify({
      type: 'hello',
      name: c.name,
      token: c.token,
      ...(previous ? { roomId: previous.state.roomId } : {}),
    }),
  );
  await until(() => c.welcome && (!previous || c.state), 'admission');
  return c;
}
async function send(c, message, verify) {
  const begin = performance.now();
  c.ws.send(JSON.stringify(message));
  await until(verify, message.type);
  latency.push(performance.now() - begin);
}
async function action(c, move) {
  const revision = c.state.revision;
  await send(
    c,
    { type: 'action', revision, action: move },
    () => c.state.revision > revision,
  );
}
try {
  const people = await Promise.all(
    Array.from({ length: 100 }, (_, i) => connect(i)),
  );
  await until(
    () => people.every((c) => c.directory?.count === 100),
    '100 directory',
  );
  assert.equal(
    people[0].directory.rooms.length,
    0,
    'Use fresh local persistence',
  );
  const groups = Array.from({ length: 20 }, (_, i) =>
    people.slice(i * 5, i * 5 + 5),
  );
  await Promise.all(
    groups.map(async (group) => {
      const owner = group[0];
      await send(
        owner,
        { type: 'create', name: owner.name },
        () => owner.state?.phase === 'lobby',
      );
      for (const c of group.slice(1))
        await send(
          c,
          {
            type: 'join',
            roomId: owner.state.roomId,
            name: c.name,
            watch: false,
          },
          () => c.state?.roomId === owner.state.roomId,
        );
      await action(owner, { type: 'start' });
    }),
  );
  await until(
    () => people.every((c) => c.state?.phase === 'grand'),
    '20 started rooms',
  );
  for (const c of people) {
    assert.equal(c.directory.rooms.length, 20);
    assert.equal(c.directory.rooms.filter((r) => r.mine).length, 1);
    assert.equal(c.state.hand.length, 10);
    assert.equal('hands' in c.state, false);
    assert.equal('spectatorHands' in c.state, false);
  }
  // Sequential within each room avoids stale revisions; all 20 rooms run concurrently.
  await Promise.all(
    groups.map(async (group) => {
      for (const c of group) await action(c, { type: 'grand', call: false });
      await until(
        () => group.every((c) => c.state.phase === 'exchange'),
        'exchange',
      );
      for (const c of group)
        await action(c, {
          type: 'exchange',
          ids: c.state.hand.slice(0, 2).map((card) => card.id),
        });
      await until(() => group.every((c) => c.state.phase === 'play'), 'play');
    }),
  );
  const moves = Array(20).fill(0);
  const end = Date.now() + 120000;
  await Promise.all(
    groups.map(async (group, roomIndex) => {
      while (Date.now() < end) {
        const s = group[0].state;
        const seat = s.phase === 'trick' ? s.last : s.turn;
        const c = group.find((c) => c.state.seat === seat);
        if (
          c &&
          s.phase === 'play' &&
          c.state.revision === s.revision &&
          c.state.deadline - Date.now() > 2000
        ) {
          let move;
          const desired = s.wish ? legalPlays(c.state.hand, s.top, s.wish) : [];
          const options = desired.length
            ? desired
            : legalPlays(c.state.hand, s.top);
          const chosen = options.sort(
            (a, b) =>
              b.cards.length - a.cards.length || a.play.power - b.play.power,
          )[0];
          move = chosen
            ? {
                type: 'play',
                ids: chosen.cards.map((x) => x.id),
                target: (seat + 2) % 6,
                wish: 14,
              }
            : { type: 'pass' };
          await action(c, move);
          moves[roomIndex]++;
        }
        await pause(1000);
      }
    }),
  );
  assert.ok(
    moves.every((n) => n >= 10),
    `Insufficient progress: ${moves}`,
  );
  assert.ok(
    people.every((c) => c.ws.readyState === WebSocket.OPEN && !c.error),
    'All 100 sockets must remain connected through the load test',
  );
  assert.ok(people.every((c) => c.directory.count === 100));
  // Reconnect all 20 owners at capacity, using the same identity and room.
  await Promise.all(
    groups.map(async (group, i) => {
      const old = group[0];
      const restored = await connect(i * 5, old);
      assert.equal(restored.state.seat, old.state.seat);
      assert.equal(restored.state.roomId, old.state.roomId);
      assert.deepEqual(restored.state.hand, old.state.hand);
      assert.equal(restored.directory.count, 100);
    }),
  );
  latency.sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        identities: 100,
        activeRooms: 20,
        durationSeconds: 120,
        acceptedHumanMoves: moves.reduce((a, b) => a + b, 0),
        minMovesPerRoom: Math.min(...moves),
        responseMs: {
          p50: latency[Math.floor(latency.length * 0.5)],
          p95: latency[Math.floor(latency.length * 0.95)],
          max: latency.at(-1),
        },
        note: 'Local machine only; includes polling delay, not production latency or a long soak test.',
      },
      null,
      2,
    ),
  );
} finally {
  for (const c of clients) c.ws.terminate();
}
