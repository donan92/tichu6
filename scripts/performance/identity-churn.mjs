// Local-only distinct-identity churn. The separate fixture may expose a clock-aging
// endpoint for retention tests; this client never changes production settings.
import WebSocket from 'ws';
import { randomBytes } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { appendFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.TEST_API || 'http://127.0.0.1:8916';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error('Local-only');
const output = process.argv[2] || '/tmp/tichu-identity-churn.json';
async function visit(i) {
  const ws = new WebSocket(base.replace('http', 'ws') + '/lounge', {
    origin: 'http://localhost:5173',
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('admission timeout')), 10000);
    ws.once('error', reject);
    ws.once('open', () =>
      ws.send(
        JSON.stringify({
          type: 'hello',
          name: 'Ch' + String(i).padStart(6, '0'),
          token: randomBytes(32).toString('hex'),
          trainingConsent: false,
        }),
      ),
    );
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.type === 'error') {
        clearTimeout(timer);
        reject(Error(m.code));
      }
      if (m.type === 'welcome') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  await new Promise((resolve) => {
    ws.once('close', resolve);
    ws.close(1000);
  });
}
const samples = [];
for (let batch = 0; batch < 50; batch++) {
  await Promise.all(
    Array.from({ length: 20 }, (_, i) => visit(batch * 20 + i)),
  );
  let diagnostic;
  for (let n = 0; n < 100; n++) {
    diagnostic = await (await fetch(base + '/__diagnostics')).json();
    if (diagnostic.sockets === 0) break;
    await pause(50);
  }
  assert.equal(diagnostic.sockets, 0);
  assert.equal(diagnostic.rooms, 0);
  assert.equal(diagnostic.activity, (batch + 1) * 20);
  const sample = { at: Date.now(), admitted: (batch + 1) * 20, diagnostic };
  samples.push(sample);
  await appendFile(output + '.jsonl', JSON.stringify(sample) + '\n');
  if (batch < 49) await pause(12000);
}
await writeFile(
  output,
  JSON.stringify(
    {
      result: 'PASS',
      admitted: 1000,
      samples,
      note: 'Distinct disconnected identities intentionally retain anti-idle reconnect timestamps for 24h; sockets and rooms must return to zero each batch.',
    },
    null,
    2,
  ),
);
