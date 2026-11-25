import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { randomBytes } from 'node:crypto';
const base = process.env.TEST_API || 'http://localhost:8787';
if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(base))
  throw new Error('Local only');
const clients = [];
async function until(fn, ms = 15000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('Timeout');
    await new Promise((r) => setTimeout(r, 20));
  }
}
async function user(i) {
  const ws = new WebSocket(base.replace('http', 'ws') + '/lounge', {
    origin: 'http://localhost:5173',
  });
  const c = { ws, messages: [], state: null };
  clients.push(c);
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    c.messages.push(m);
    if (m.type === 'state') c.state = m.value;
  });
  await new Promise((r, j) => {
    ws.once('open', r);
    ws.once('error', j);
  });
  ws.send(
    JSON.stringify({
      type: 'hello',
      token: randomBytes(32).toString('hex'),
      name: `Lobby${i}`,
    }),
  );
  await until(() => c.messages.some((m) => m.type === 'welcome'));
  return c;
}
async function action(c, a) {
  const revision = c.state.revision;
  c.ws.send(JSON.stringify({ type: 'action', revision, action: a }));
  await until(() => c.state.revision > revision);
  await until(() =>
    clients
      .filter((u) => u.state?.roomId === c.state.roomId)
      .every((u) => u.state.revision === c.state.revision),
  );
}
try {
  for (let i = 0; i < 7; i++) await user(i);
  clients[0].ws.send(JSON.stringify({ type: 'create', name: 'Lobby0' }));
  await until(() => clients[0].state?.roomId);
  const roomId = clients[0].state.roomId;
  await action(clients[0], { type: 'teamMode', mode: 'manual' });
  for (let i = 1; i < 6; i++) {
    clients[i].ws.send(
      JSON.stringify({ type: 'join', roomId, watch: false, name: `Lobby${i}` }),
    );
    await until(() => clients[i].state?.roomId === roomId);
  }
  assert.equal(clients[0].state.waitingPlayers.length, 6);
  assert.deepEqual(clients[0].state.names, Array(6).fill(''));
  clients[6].ws.send(
    JSON.stringify({ type: 'join', roomId, watch: false, name: 'Lobby6' }),
  );
  await until(() =>
    clients[6].messages.some((m) => m.code === 'error.seatsFull'),
  );
  for (let i = 0; i < 6; i++)
    await action(clients[i], { type: 'chooseSeat', target: i });
  assert.ok(clients[0].state.autoStartAt > Date.now());
  await action(clients[0], { type: 'chooseSeat', target: -1 });
  assert.equal(clients[0].state.autoStartAt, null);
  await action(clients[0], { type: 'chooseSeat', target: 0 });
  const deadline = clients[0].state.autoStartAt;
  await until(
    () => clients.slice(0, 6).every((c) => c.state.phase === 'grand'),
    15000,
  );
  assert.ok(Date.now() >= deadline);
  for (let i = 0; i < 6; i++) {
    assert.equal(clients[i].state.seat % 2, i % 2);
    assert.equal(clients[i].state.names[clients[i].state.seat], `Lobby${i}`);
    assert.equal(clients[i].state.hand.length, 10);
    assert.equal('hostHash' in clients[i].state, false);
  }
  console.log(
    'PASS real Worker: six waiting participants, seventh rejected, seat assignment, countdown cancellation, automatic start, within-team shuffle and identity pairing',
  );
} finally {
  for (const c of clients) c.ws.close();
}
