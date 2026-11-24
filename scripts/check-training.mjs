import WebSocket from 'ws';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { legalPlays } from '../src/game.js';
const base = process.env.TEST_API || 'http://localhost:18946';
if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(base))
  throw Error('Local-only integration');
const token = 'local-test-only-not-a-production-secret';
const clients = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  const deadline = Date.now() + 15000;
  while (!check()) {
    if (Date.now() > deadline) throw Error('Timed out');
    await wait(10);
  }
}
async function connect(index, roomId, watch = false) {
  const ws = new WebSocket(base.replace('http', 'ws') + '/lounge', {
    origin: 'http://localhost:5173',
  });
  const client = { ws, messages: [], view: null, lastSend: 0 };
  clients.push(client);
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    client.messages.push(m);
    if (m.type === 'state') client.view = m.value;
  });
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  ws.send(
    JSON.stringify({
      type: 'hello',
      token: randomBytes(32).toString('hex'),
      name: `Tester${index}`,
      trainingConsent: index !== 0,
    }),
  );
  await until(() => client.messages.some((m) => m.type === 'welcome'));
  ws.send(
    JSON.stringify(
      roomId
        ? { type: 'join', roomId, watch, name: `Tester${index}` }
        : { type: 'create', name: `Tester${index}` },
    ),
  );
  await until(() => client.view);
  return client;
}
async function action(c, value) {
  await wait(Math.max(0, 450 - (Date.now() - c.lastSend)));
  const revision = c.view.revision,
    before = c.messages.length;
  c.ws.send(JSON.stringify({ type: 'action', revision, action: value }));
  c.lastSend = Date.now();
  await until(
    () =>
      c.view.revision > revision ||
      c.messages.slice(before).some((m) => m.type === 'error'),
  );
  const error = c.messages.slice(before).find((m) => m.type === 'error');
  if (error) throw Error(JSON.stringify(error));
  await until(() => clients.every((x) => x.view.revision > revision));
}
try {
  assert.equal((await fetch(base + '/training/export')).status, 403);
  const owner = await connect(0);
  const roomId = owner.view.roomId;
  for (let i = 1; i < 6; i++) await connect(i, roomId);
  const spectator = await connect(6, roomId, true);
  await action(owner, { type: 'start' });
  let moves = 0;
  while (!['roundEnd', 'matchEnd'].includes(owner.view.phase)) {
    if (++moves > 2000) throw Error('Round exceeded bound');
    const s = owner.view;
    const seat =
      s.phase === 'grand'
        ? s.ready.findIndex((x) => !x)
        : s.phase === 'exchange'
          ? s.exchangeReady.findIndex((x) => !x)
          : s.phase === 'trick'
            ? s.last
            : s.turn;
    const c = clients.find((x) => x.view.seat === seat),
      hand = c.view.hand;
    let move;
    if (s.phase === 'grand') move = { type: 'grand', call: false };
    else if (s.phase === 'exchange')
      move = { type: 'exchange', ids: hand.slice(0, 2).map((x) => x.id) };
    else if (s.phase === 'trick')
      move = { type: 'collect', target: (seat + 1) % 6 };
    else {
      const wish = s.wish ? legalPlays(hand, s.top, s.wish) : [];
      const options = wish.length ? wish : legalPlays(hand, s.top);
      const chosen =
        options.find((o) => o.cards.length === hand.length) ||
        options.sort(
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
    }
    await action(c, move);
  }
  assert.deepEqual(spectator.view.hand, []);
  assert.equal(JSON.stringify(spectator.messages).includes('recordId'), false);
  const response = await fetch(base + '/training/export', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.schema, 2);
  assert.ok(
    data.sessions.some((session) => typeof session.groupId === 'string'),
  );
  const session = data.sessions.at(-1);
  assert.ok(session?.outcome);
  assert.ok(session.events.length > 0);
  assert.ok(session.events.every((e) => e.seat !== owner.view.seat));
  assert.ok(
    session.events
      .filter((e) => e.action.type === 'grand')
      .every((e) => e.ownHand.length === 10),
  );
  const serialized = JSON.stringify(data);
  for (const forbidden of [
    'Tester',
    'token',
    'hash',
    'createdAt',
    'updatedAt',
    roomId,
  ])
    assert.equal(serialized.includes(forbidden), false);
  await writeFile(
    '/tmp/tichu6-synthetic-training-export.json',
    serialized + '\n',
    { mode: 0o600 },
  );
  console.log(
    `PASS real Worker training: ${moves} accepted decisions, ${session.events.length} retained examples, outcome, non-consenting player excluded, spectator redaction, private authenticated export.`,
  );
} finally {
  for (const c of clients) c.ws.close();
}
