// Local-only 2h+ lifecycle soak, minute metrics and workerd retained-heap snapshots.
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, open, appendFile, writeFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { heap } from './heap.mjs';
const [fixtureArg, outputArg, port = '8898', inspectorPort = '9339'] =
  process.argv.slice(2);
const fixture = path.resolve(fixtureArg),
  output = path.resolve(outputArg);
if (
  !/^\/(private\/)?tmp\//.test(fixture) ||
  !/^\/(private\/)?tmp\//.test(output)
)
  throw Error('Temporary paths required');
for (const value of [port, inspectorPort]) {
  if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535)
    throw Error('Explicit unprivileged local ports required');
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(Number(value), '127.0.0.1', () => probe.close(resolve));
  });
}
await mkdir(output, { recursive: true });
if ((await readdir(output)).length)
  throw Error('Output must be empty; preserve prior evidence');
const log = await open(path.join(output, 'worker.log'), 'w');
const worker = spawn(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'dev',
    '--local',
    '--config',
    path.join(fixture, 'wrangler.json'),
    '--port',
    port,
    '--inspector-port',
    inspectorPort,
    '--persist-to',
    path.join(output, 'state'),
  ],
  { stdio: ['ignore', log.fd, log.fd], detached: true },
);
const base = 'http://127.0.0.1:' + port;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
function processes() {
  return execFileSync('ps', ['-axo', 'pid,ppid,pgid,%cpu,rss,command'], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const [pid, ppid, pgid, cpu, rss, ...command] = line.trim().split(/\s+/);
      return {
        pid: +pid,
        ppid: +ppid,
        pgid: +pgid,
        cpu: +cpu,
        rssBytes: +rss * 1024,
        command: command.join(' '),
      };
    })
    .filter((p) => p.pgid === worker.pid);
}
async function inspector() {
  const runtime = processes().find(
    (p) =>
      p.command.includes('workerd serve') &&
      p.command.includes('--inspector-addr'),
  );
  if (!runtime) throw Error('Inspector workerd process not found');
  const rows = execFileSync(
    'lsof',
    ['-Pan', '-p', String(runtime.pid), '-iTCP', '-sTCP:LISTEN'],
    { encoding: 'utf8' },
  );
  for (const match of rows.matchAll(/127\.0\.0\.1:(\d+)/g)) {
    const url = 'http://127.0.0.1:' + match[1];
    try {
      const res = await fetch(url + '/json/list', {
        signal: AbortSignal.timeout(1000),
      });
      const values = await res.json();
      if (
        Array.isArray(values) &&
        values.some((v) => v.id.startsWith('core:user:'))
      )
        return url;
    } catch {
      /* not inspector */
    }
  }
  throw Error('Native inspector endpoint not found');
}
let child, sampling;
let pending = Promise.resolve();
let index = 0;
const errors = [];
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + '/health')).ok) break;
    } catch {
      /* start */
    }
    await pause(1000);
  }
  const inspect = await inspector();
  async function sample(label) {
    const at = Date.now();
    const snapshot =
      label || index % 30 === 0
        ? path.join(output, `heap-${label || index}.heapsnapshot`)
        : undefined;
    const diagnostic = await (await fetch(base + '/__diagnostics')).json();
    const memory = await heap(inspect, snapshot, base);
    await appendFile(
      path.join(output, 'server-minute.jsonl'),
      JSON.stringify({
        at,
        index,
        label,
        diagnostic,
        memory,
        processes: processes(),
        collectorMemory: process.memoryUsage(),
      }) + '\n',
    );
    index++;
  }
  // workerd may take one inspector attach to initialize its context. This
  // warmup is outside the workload window and never included in latency samples.
  await fetch(base + '/__diagnostics');
  try {
    await heap(inspect, undefined, base);
  } catch (error) {
    await appendFile(
      path.join(output, 'inspector-warmup.log'),
      error.message + '\n',
    );
  }
  await sample('cold');
  const stdout = await open(path.join(output, 'result.json'), 'w');
  const stderr = await open(path.join(output, 'client-error.log'), 'w');
  child = spawn(process.execPath, ['scripts/performance/load.mjs'], {
    env: {
      ...process.env,
      TEST_API: base,
      PERF_USERS: '100',
      PERF_SECONDS: process.env.PERF_SECONDS || '7200',
      PERF_CHURN: '1',
      PERF_SAMPLES: path.join(output, 'client-minute.jsonl'),
      PERF_CLEANUP: '1',
    },
    stdio: ['ignore', stdout.fd, stderr.fd],
  });
  sampling = setInterval(() => {
    pending = pending
      .then(() => sample())
      .catch((e) => {
        errors.push({ at: Date.now(), error: e.message });
      });
  }, 60000);
  const code = await new Promise((r) => child.once('exit', r));
  clearInterval(sampling);
  await pending;
  await sample('closed');
  await pause(45000);
  await sample('settled');
  await writeFile(
    path.join(output, 'run.json'),
    JSON.stringify(
      {
        code,
        errors,
        consent: process.env.PERF_CONSENT || 'false',
        seconds: process.env.PERF_SECONDS || 7200,
        finishedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  await stdout.close();
  await stderr.close();
  if (code !== 0 || errors.length) process.exitCode = 1;
} finally {
  clearInterval(sampling);
  child?.kill();
  process.kill(-worker.pid, 'SIGTERM');
  await log.close();
}
