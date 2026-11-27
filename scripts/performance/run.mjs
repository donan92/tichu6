import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, open } from 'node:fs/promises';
import path from 'node:path';
const fixture = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
const users = (process.env.PERF_CASES || '20,50,100').split(',').map(Number);
await mkdir(output, { recursive: true });
for (const count of users) {
  const prefix = `${count}-${Date.now()}`;
  const log = await open(path.join(output, prefix + '-worker.log'), 'w');
  const worker = spawn(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'dev',
      '--local',
      '--config',
      path.join(fixture, 'wrangler.json'),
      '--port',
      '8796',
      '--persist-to',
      path.join(output, prefix + '-state'),
    ],
    { stdio: ['ignore', log.fd, log.fd], detached: true },
  );
  const samples = [];
  let sampling;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch('http://127.0.0.1:8796/health');
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {
        /* Retry readiness or skip unavailable process sample. */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!ready) throw Error('Worker did not start');
    sampling = setInterval(() => {
      try {
        const ps = execFileSync(
          'ps',
          ['-axo', 'pid,ppid,pgid,%cpu,rss,command'],
          {
            encoding: 'utf8',
          },
        );
        samples.push({
          at: Date.now(),
          rows: ps
            .split('\n')
            .filter((x) => Number(x.trim().split(/\s+/)[2]) === worker.pid),
        });
      } catch {
        /* Retry readiness or skip unavailable process sample. */
      }
    }, 5000);
    const child = spawn(process.execPath, ['scripts/performance/load.mjs'], {
      env: {
        ...process.env,
        PERF_USERS: String(count),
        TEST_API: 'http://127.0.0.1:8796',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (b) => (stdout += b));
    child.stderr.on('data', (b) => (stderr += b));
    const code = await new Promise((r) => child.on('exit', r));
    await writeFile(
      path.join(output, prefix + (code === 0 ? '.json' : '-failed.txt')),
      stdout,
    );
    await writeFile(path.join(output, prefix + '-error.log'), stderr);
    await writeFile(
      path.join(output, prefix + '-resources.json'),
      JSON.stringify(samples, null, 2),
    );
    if (code !== 0) throw Error('Load failed: ' + stderr);
    console.log(count + ' completed: ' + stdout);
  } finally {
    clearInterval(sampling);
    process.kill(-worker.pid, 'SIGTERM');
    await new Promise((r) => setTimeout(r, 2000));
    await log.close();
  }
}
