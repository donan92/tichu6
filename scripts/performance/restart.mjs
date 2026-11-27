// Real SQLite persistence across a full local Worker process restart; no metrics hooks.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, open } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';
const dir = await mkdtemp('/tmp/tichu-perf-restore-');
const base = 'http://127.0.0.1:8798';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  for (let i = 0; i < 300; i++) {
    if (await fn()) return;
    await pause(100);
  }
  throw Error('Timeout');
}
const log = await open(dir + '/worker.log', 'w');
let worker;
async function start() {
  worker = spawn(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'dev',
      '--local',
      '--port',
      '8798',
      '--inspector-port',
      '0',
      '--persist-to',
      dir + '/state',
    ],
    { detached: true, stdio: ['ignore', log.fd, log.fd] },
  );
  await until(async () => {
    try {
      return (await fetch(base + '/health')).ok;
    } catch {
      return false;
    }
  });
}
async function stop() {
  process.kill(-worker.pid, 'SIGTERM');
  await new Promise((r) => worker.once('exit', r));
  await pause(1000);
}
const token = randomBytes(32).toString('hex');
async function client(roomId) {
  const c = {};
  c.ws = new WebSocket(base.replace('http', 'ws') + '/lounge', {
    origin: 'http://localhost:5173',
  });
  c.ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.type === 'state') c.state = m.value;
    if (m.type === 'welcome') c.welcome = true;
    if (m.type === 'error') c.error = m.code;
  });
  await new Promise((r) => c.ws.once('open', r));
  c.ws.send(
    JSON.stringify({
      type: 'hello',
      name: 'Restore',
      token,
      ...(roomId ? { roomId } : {}),
    }),
  );
  await until(() => c.welcome);
  return c;
}
try {
  await start();
  const c = await client();
  c.ws.send(
    JSON.stringify({ type: 'create', name: 'Restore', privateRoom: true }),
  );
  await until(() => c.state?.phase === 'lobby');
  c.ws.send(
    JSON.stringify({
      type: 'action',
      revision: c.state.revision,
      action: { type: 'start' },
    }),
  );
  await until(() => c.state?.phase === 'grand');
  const before = structuredClone(c.state);
  c.ws.close();
  await pause(200);
  await stop();
  await start();
  const restored = await client(before.roomId);
  await until(() => restored.state);
  assert.equal(restored.error, undefined);
  assert.equal(restored.state.seat, before.seat);
  assert.deepEqual(restored.state.hand, before.hand);
  assert.equal(restored.state.inviteCode, before.inviteCode);
  assert.equal(restored.state.deadline, before.deadline);
  restored.ws.close();
  console.log(
    'PASS real local Worker restart: SQLite hand, seat, private invite and preparation deadline restored',
  );
} finally {
  if (worker?.exitCode === null) await stop();
  await log.close();
}
