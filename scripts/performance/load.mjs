// Local-only sustained exercise: 100 identities, 20 active rooms, one bot/room.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import WebSocket from 'ws';
import { legalPlays } from '../../src/game.js';
const base = process.env.TEST_API || 'http://localhost:8787';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw new Error('Capacity test is local-only.');
const count = Number(process.env.PERF_USERS || 100);
const humans = Number(process.env.PERF_HUMANS || 5);
const duration = Number(process.env.PERF_SECONDS || 120);
assert.ok([20, 50, 100].includes(count));
assert.ok([1, 5].includes(humans) && count / humans <= 20);
const roomCount = count / humans;
const clients = [];
let receivedMessages = 0,
  receivedBytes = 0;
const metrics = async () => (await fetch(base + '/__metrics')).json();
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
    receivedMessages++;
    receivedBytes += raw.length;
    const m = JSON.parse(raw);
    if (m.type === 'state') c.state = m.value;
    if (m.type === 'directory') c.directory = m;
    if (m.type === 'welcome') c.welcome = true;
    if (m.type === 'error') {
      if (c.setupRetry && m.code === 'error.staleState') c.setupStale = true;
      else c.error = m.code;
    }
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
      trainingConsent: process.env.PERF_CONSENT === 'true',
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
// Preparation races server bots. Verify the requested effect, not just any newer
// revision; only these setup transitions retry expected stale-state rejections.
async function setupAction(c, move, verify) {
  c.setupRetry = true;
  try {
    while (!verify()) {
      c.setupStale = false;
      c.ws.send(
        JSON.stringify({
          type: 'action',
          revision: c.state.revision,
          action: move,
        }),
      );
      await until(() => verify() || c.setupStale, 'preparation action');
      if (c.setupStale) await pause(20);
    }
  } finally {
    c.setupRetry = false;
  }
}

try {
  const people = await Promise.all(
    Array.from({ length: count }, (_, i) => connect(i)),
  );
  await until(
    () => people.every((c) => c.directory?.count === count),
    '100 directory',
  );
  assert.equal(
    people[0].directory.rooms.length,
    0,
    'Use fresh local persistence',
  );
  const groups = Array.from({ length: roomCount }, (_, i) =>
    people.slice(i * humans, i * humans + humans),
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
      await setupAction(
        owner,
        { type: 'start' },
        () => owner.state.phase === 'grand',
      );
    }),
  );
  await until(
    () => people.every((c) => c.state?.phase === 'grand'),
    '20 started rooms',
  );
  for (const c of people) {
    assert.equal(c.directory.rooms.length, roomCount);
    assert.equal(c.directory.rooms.filter((r) => r.mine).length, 1);
    assert.equal(c.state.hand.length, 10);
    assert.equal('hands' in c.state, false);
    assert.equal('spectatorHands' in c.state, false);
  }
  // Sequential within each room avoids stale revisions; all 20 rooms run concurrently.
  await Promise.all(
    groups.map(async (group) => {
      for (const c of group)
        await setupAction(
          c,
          { type: 'grand', call: false },
          () => c.state.phase !== 'grand' || c.state.ready[c.state.seat],
        );
      await until(
        () => group.every((c) => c.state.phase === 'exchange'),
        'exchange',
      );
      for (const c of group)
        await setupAction(
          c,
          {
            type: 'exchange',
            ids: c.state.hand.slice(0, 2).map((card) => card.id),
          },
          () =>
            c.state.phase !== 'exchange' || c.state.exchangeReady[c.state.seat],
        );
      await until(() => group.every((c) => c.state.phase === 'play'), 'play');
    }),
  );
  const moves = Array(roomCount).fill(0);
  latency.length = 0;
  const before = await metrics();
  const receivedBefore = { messages: receivedMessages, bytes: receivedBytes };
  const started = performance.now();
  const end = Date.now() + duration * 1000;
  await Promise.all(
    groups.map(async (group, roomIndex) => {
      while (Date.now() < end) {
        const s = group[0].state;
        if (s.phase === 'matchEnd') {
          for (const p of group)
            await send(p, { type: 'leave' }, () =>
              p.directory.rooms.every((r) => !r.mine),
            );
          const owner = group[0];
          const oldId = owner.state.roomId;
          await send(
            owner,
            { type: 'create', name: owner.name },
            () => owner.state.roomId !== oldId && owner.state.phase === 'lobby',
          );
          for (const p of group.slice(1))
            await send(
              p,
              {
                type: 'join',
                roomId: owner.state.roomId,
                name: p.name,
                watch: false,
              },
              () => p.state.roomId === owner.state.roomId,
            );
          await setupAction(
            owner,
            { type: 'start' },
            () => owner.state.phase === 'grand',
          );
          continue;
        }
        if (s.phase === 'roundEnd') {
          const host = group.find((c) => c.state.isHost);
          if (host)
            await setupAction(
              host,
              { type: 'next' },
              () => host.state.phase === 'grand',
            );
          await pause(100);
          continue;
        }
        if (s.phase === 'grand') {
          for (const p of group)
            if (p.state.phase === 'grand' && !p.state.ready[p.state.seat])
              await setupAction(
                p,
                { type: 'grand', call: false },
                () => p.state.phase !== 'grand' || p.state.ready[p.state.seat],
              );
          await pause(1000);
          continue;
        }
        if (s.phase === 'exchange') {
          for (const p of group)
            if (
              p.state.phase === 'exchange' &&
              !p.state.exchangeReady[p.state.seat]
            )
              await setupAction(
                p,
                {
                  type: 'exchange',
                  ids: p.state.hand.slice(0, 2).map((x) => x.id),
                },
                () =>
                  p.state.phase !== 'exchange' ||
                  p.state.exchangeReady[p.state.seat],
              );
          await pause(1000);
          continue;
        }

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
                target:
                  [(seat + 2) % 6, (seat + 4) % 6].find(
                    (i) => s.counts[i] > 0,
                  ) ?? (seat + 2) % 6,
                wish: 14,
                phoenixRank: chosen.play.phoenixRank,
              }
            : { type: 'pass' };
          await action(c, move);
          moves[roomIndex]++;
        }
        await pause(1000);
      }
    }),
  );
  const elapsed = (performance.now() - started) / 1000;
  const after = await metrics();
  const counters = Object.fromEntries(
    Object.entries(after).map(([k, v]) => [k, v - (before[k] || 0)]),
  );
  const received = {
    messages: receivedMessages - receivedBefore.messages,
    bytes: receivedBytes - receivedBefore.bytes,
  };
  assert.ok(
    moves.every((n) => n >= (humans === 1 ? 2 : 10)),
    `Insufficient progress: ${moves}`,
  );
  assert.ok(
    people.every((c) => c.ws.readyState === WebSocket.OPEN && !c.error),
    'All 100 sockets must remain connected through the load test',
  );
  assert.ok(people.every((c) => c.directory.count === count));
  // Reconnect all 20 owners at capacity, using the same identity and room.
  await Promise.all(
    people.slice(0, 20).map(async (old, i) => {
      const restored = await connect(i, old);
      assert.equal(restored.state.seat, old.state.seat);
      assert.equal(restored.state.roomId, old.state.roomId);
      assert.equal(restored.directory.count, count);
    }),
  );
  latency.sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        identities: count,
        activeRooms: roomCount,
        durationSeconds: elapsed,
        counters,
        received,
        consent: process.env.PERF_CONSENT === 'true',
        throughput: moves.reduce((a, b) => a + b, 0) / elapsed,
        acceptedHumanMoves: moves.reduce((a, b) => a + b, 0),
        minMovesPerRoom: Math.min(...moves),
        responseMs: {
          p50: latency[Math.floor(latency.length * 0.5)],
          p95: latency[Math.floor(latency.length * 0.95)],
          p99: latency[Math.floor(latency.length * 0.99)],
          max: latency.at(-1),
        },
        note: 'Local machine only; includes polling delay, not production latency or Cloudflare billing measurements.',
      },
      null,
      2,
    ),
  );
} finally {
  for (const c of clients) c.ws.terminate();
}
