// Starts a fresh, local-only Worker with a test clock-aging endpoint.
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
const dir = await mkdtemp(join(tmpdir(), 'tichu-flow-'));
const listener = createServer();
await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const base = `http://127.0.0.1:${port}`;
await writeFile(
  join(dir, 'wrangler.json'),
  JSON.stringify({
    name: 'tichu-flow-test',
    main: resolve('scripts/fixtures/flow-worker.js'),
    compatibility_date: '2026-11-01',
    durable_objects: {
      bindings: [
        { name: 'LOUNGE', class_name: 'TestLounge' },
        { name: 'ROOMS', class_name: 'GameRoom' },
      ],
    },
    migrations: [{ tag: 'v1', new_sqlite_classes: ['TestLounge', 'GameRoom'] }],
  }),
);
const process = spawn(
  globalThis.process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'dev',
    '--local',
    '--config',
    join(dir, 'wrangler.json'),
    '--port',
    String(port),
    '--inspector-port',
    '0',
    '--persist-to',
    join(dir, 'state'),
  ],
  {
    env: {
      ...globalThis.process.env,
      WRANGLER_LOG_PATH: join(dir, 'worker.log'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let logs = '';
process.stdout.on('data', (s) => {
  logs += s;
});
process.stderr.on('data', (s) => {
  logs += s;
});
const sockets = [];
async function until(fn, ms = 20000) {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error('Timed out');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
async function connect(
  name,
  token = randomBytes(32).toString('hex'),
  extra = {},
) {
  const ws = new WebSocket(base.replace('http', 'ws') + '/lounge', {
    origin: 'http://localhost:5173',
  });
  sockets.push(ws);
  const client = {
    ws,
    token,
    messages: [],
    state: null,
    close: null,
    pongs: 0,
  };
  ws.on('message', (raw) => {
    if (raw.toString() === 'pong') {
      client.pongs++;
      return;
    }
    const m = JSON.parse(raw);
    client.messages.push(m);
    if (m.type === 'state') client.state = m.value;
  });
  ws.on('close', (code) => {
    client.close = code;
  });
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  ws.send(JSON.stringify({ type: 'hello', name, token, ...extra }));
  await until(
    () => client.close || client.messages.some((m) => m.type === 'welcome'),
  );
  return client;
}
try {
  await until(async () => {
    try {
      return (await fetch(base + '/health')).ok;
    } catch {
      return false;
    }
  });
  const owner = await connect('Clock');
  owner.ws.send(JSON.stringify({ type: 'create', name: 'Clock' }));
  await until(() => owner.state?.phase === 'lobby');
  const roomId = owner.state.roomId;
  await fetch(base + '/__flow-play');
  await until(() => owner.state?.phase === 'play');
  const deadline = owner.state.deadline;
  assert.ok(deadline - Date.now() > 28000 && deadline - Date.now() <= 30000);
  assert.deepEqual(owner.state.trickHistory, []);
  const returned = await connect('Clock', owner.token, { roomId });
  await until(() => returned.state?.phase === 'play');
  assert.equal(returned.state.deadline, deadline);
  await fetch(base + '/__flow-age');
  await until(() => returned.state?.passed.includes(0));
  assert.equal(returned.state.turn, 1);
  assert.ok(returned.state.deadline > Date.now());
  const watcher = await connect('Watcher');
  watcher.ws.send(
    JSON.stringify({ type: 'join', roomId, watch: true, name: 'Watcher' }),
  );
  await until(() => watcher.state?.spectator === true);
  await fetch(base + '/__flow-trick');
  await until(() => returned.state?.phase === 'trick');
  const collectAt = returned.state.deadline;
  assert.ok(collectAt - Date.now() > 4000 && collectAt - Date.now() <= 5000);
  watcher.ws.send(
    JSON.stringify({
      type: 'action',
      revision: watcher.state.revision,
      action: { type: 'dragonTarget', target: 3 },
    }),
  );
  await until(() =>
    watcher.messages.some(
      (m) => m.type === 'error' && m.code === 'error.spectator',
    ),
  );
  returned.ws.send(
    JSON.stringify({
      type: 'action',
      revision: returned.state.revision,
      action: { type: 'dragonTarget', target: 3 },
    }),
  );
  await until(() => returned.state?.dragonTarget === 3);
  assert.equal(returned.state.deadline, collectAt);
  assert.equal(returned.state.phase, 'trick');
  await until(() => returned.state?.phase === 'play');
  assert.ok(Date.now() >= collectAt);
  assert.equal(returned.state.capturedPoints[3], 25);
  assert.deepEqual(returned.state.trickHistory, []);
  assert.deepEqual(watcher.state.trickHistory, []);
  assert.deepEqual(returned.state.log, []);
  await fetch(base + '/__flow-play');
  await until(
    () => watcher.state?.phase === 'play' && watcher.state?.turn === 0,
  );
  returned.ws.close();
  await until(() => watcher.state?.reconnectUntil > Date.now());
  const waitUntil = watcher.state.reconnectUntil;
  assert.ok(
    waitUntil - Date.now() > 175000 && waitUntil - Date.now() <= 180000,
  );
  assert.equal(watcher.state.deadline, waitUntil + 30000);
  const rejoined = await connect('Clock', owner.token, { roomId });
  await until(() => rejoined.state?.phase === 'play');
  assert.equal(rejoined.state.reconnectUntil, null);
  assert.ok(rejoined.state.deadline - Date.now() <= 30000);
  const resumedDeadline = rejoined.state.deadline;
  rejoined.ws.close();
  await until(
    () => watcher.state?.offline[0] && watcher.state.reconnectUntil == null,
  );
  assert.equal(watcher.state.deadline, resumedDeadline);
  await fetch(base + '/__flow-age');
  await until(() => watcher.state?.passed.includes(0));
  console.log(
    'PASS real Worker: disconnect grace, early reconnect, repeated disconnect cannot extend deadline, offline timeout pass',
  );
  console.log(
    'PASS real Worker: persistent 30s deadline, reconnect unchanged, alarm auto-pass, five-second dragon collection, authenticated target, no previous-trick disclosure',
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  for (const ws of sockets) ws.close();
  if (process.exitCode === null && process.signalCode === null) {
    const exited = new Promise((resolve) => process.once('exit', resolve));
    process.kill('SIGTERM');
    await exited;
  }
  await rm(dir, { recursive: true, force: true });
}
