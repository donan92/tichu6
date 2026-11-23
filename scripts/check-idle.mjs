// Starts a fresh, local-only Worker with a test clock-aging endpoint.
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
const dir = await mkdtemp(join(tmpdir(), 'tichu-idle-'));
const listener = createServer();
await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const base = `http://127.0.0.1:${port}`;
await writeFile(
  join(dir, 'wrangler.json'),
  JSON.stringify({
    name: 'tichu-idle-test',
    main: resolve('scripts/fixtures/idle-worker.js'),
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
  const owner = await connect('Idle');
  owner.ws.send(JSON.stringify({ type: 'create', name: 'Idle' }));
  await until(() => owner.state?.phase === 'lobby');
  const roomId = owner.state.roomId;
  const watcher = await connect('Watcher');
  watcher.ws.send(
    JSON.stringify({ type: 'join', name: 'Watcher', roomId, watch: true }),
  );
  await until(() => watcher.state?.spectator);
  owner.ws.send(
    JSON.stringify({
      type: 'action',
      revision: owner.state.revision,
      action: { type: 'start' },
    }),
  );
  await until(() => owner.state?.phase === 'grand');
  const seat = owner.state.seat;
  assert.equal((await fetch(base + '/__age', { method: 'POST' })).status, 200);
  const heartbeat = setInterval(() => {
    if (owner.ws.readyState === WebSocket.OPEN) owner.ws.send('ping');
  }, 100);
  try {
    await until(() => owner.close === 4009);
  } finally {
    clearInterval(heartbeat);
  }
  assert.ok(
    owner.pongs > 0,
    'auto-response pings must not keep idle users logged in',
  );
  await until(
    () => watcher.state?.bots[seat] && watcher.state.phase === 'exchange',
  );
  assert.equal(watcher.state.hand.length, 0);
  assert.equal(
    watcher.messages.filter((m) => m.type === 'directory').at(-1).count,
    1,
  );
  const retry = await connect('Idle', owner.token, { roomId });
  assert.equal(retry.close, 4009);
  const manual = await connect('Idle', owner.token, { roomId, manual: true });
  await until(() => manual.state?.seat === seat);
  assert.equal(manual.state.bots[seat], false);
  assert.equal(manual.state.hand.length, 18);
  console.log(
    'PASS real Worker: ping-resistant idle logout, immediate bot takeover, spectator privacy, capacity release, no automatic retry, explicit same-seat return',
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
