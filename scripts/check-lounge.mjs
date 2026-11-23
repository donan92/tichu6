import WebSocket from 'ws';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
const base = process.env.TEST_API || 'http://localhost:8787';
if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(base))
  throw new Error('Capacity test is local-only.');
const all = [];
async function until(fn, ms = 10000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('Timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}
async function user(token = randomBytes(32).toString('hex'), extra = {}) {
  const ws = new WebSocket(base.replace('http', 'ws') + '/lounge', {
    origin: 'http://localhost:5173',
  });
  all.push(ws);
  const c = { ws, token, messages: [], state: null, directory: null };
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    c.messages.push(m);
    if (m.type === 'state') c.state = m.value;
    if (m.type === 'directory') c.directory = m;
  });
  await new Promise((r, j) => {
    ws.once('open', r);
    ws.once('error', j);
  });
  ws.send(JSON.stringify({ type: 'hello', token, name: 'Check', ...extra }));
  await until(() =>
    c.messages.some((m) => ['welcome', 'error'].includes(m.type)),
  );
  return c;
}
async function request(c, m, verify) {
  const count = c.messages.length;
  c.ws.send(JSON.stringify(m));
  // Broadcasts from other requests are not acknowledgements for this request.
  await until(() => verify(c.messages.slice(count)));
  return c.messages.slice(count);
}
try {
  const users = await Promise.all(Array.from({ length: 31 }, () => user()));
  const admitted = users.filter((c) =>
    c.messages.some((m) => m.type === 'welcome'),
  );
  assert.equal(admitted.length, 30);
  assert.equal(
    users.filter((c) => c.messages.some((m) => m.type === 'error')).length,
    1,
  );
  await until(() => admitted.every((c) => c.directory?.count === 30));
  assert.equal(
    admitted[0].directory.rooms.length,
    0,
    'Use fresh local persistence for capacity test',
  );
  await Promise.all(
    admitted
      .slice(0, 6)
      .map((c) =>
        request(c, { type: 'create', name: 'Test' }, (messages) =>
          messages.some(
            (message) =>
              message.type === 'error' ||
              (message.type === 'state' && message.value.seat >= 0),
          ),
        ),
      ),
  );
  await until(() => admitted[0].directory.rooms.length === 5);
  assert.equal(
    admitted
      .slice(0, 6)
      .filter((c) => c.messages.some((m) => m.type === 'error')).length,
    1,
  );
  const owner = admitted.find((c) => c.state?.roomId),
    id = owner.state.roomId;
  const players = [owner, ...admitted.filter((c) => c !== owner).slice(0, 5)];
  for (const c of players.slice(1))
    await request(
      c,
      {
        type: 'join',
        roomId: id,
        watch: false,
        name: 'Player',
      },
      () => c.state?.roomId === id && c.state.seat >= 0 && !c.state.spectator,
    );
  const spectator = admitted.find((c) => !players.includes(c));
  await request(
    spectator,
    {
      type: 'join',
      roomId: id,
      watch: true,
      name: 'Watcher',
    },
    () => spectator.state?.roomId === id && spectator.state.spectator,
  );
  await request(
    owner,
    {
      type: 'action',
      revision: owner.state.revision,
      action: { type: 'start' },
    },
    () => owner.state?.phase === 'grand',
  );
  await until(() => spectator.state?.phase === 'grand');
  assert.equal(owner.state.hand.length, 8);
  assert.deepEqual(spectator.state.hand, []);
  assert.equal(spectator.state.seat, -1);
  for (const key of ['hands', 'exchanges', 'first', 'members'])
    assert.equal(key in spectator.state, false);
  const denied = await request(
    spectator,
    {
      type: 'action',
      seat: 0,
      revision: spectator.state.revision,
      action: { type: 'grand', call: true },
    },
    (messages) => messages.some((message) => message.type === 'error'),
  );
  assert.ok(denied.some((m) => m.type === 'error'));
  assert.equal(owner.state.revision, 1);
  const original = owner.state.hand;
  owner.ws.close();
  await until(() => spectator.directory.count === 29);
  const restored = await user(owner.token, { roomId: id });
  await until(() => restored.state?.phase === 'grand');
  assert.equal(restored.state.seat, 0);
  assert.deepEqual(restored.state.hand, original);
  assert.equal(restored.directory.count, 30);
  console.log(
    'PASS real Worker: 30/31 identities, 5/6 room race, six seats, spectators counted, no hidden cards, spectator action spoof rejected, reconnect at full capacity',
  );
  const foreign = await fetch(base + '/lounge', {
    headers: { Origin: 'https://evil.example' },
  });
  assert.equal(foreign.status, 403);
  const old = await fetch(base + '/rooms', { method: 'POST' });
  assert.equal(old.status, 410);
  console.log(
    'PASS origin validation and legacy capacity-bypass endpoint disabled',
  );
} finally {
  for (const ws of all) ws.close();
}
