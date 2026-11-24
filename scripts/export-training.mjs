import { writeFile } from 'node:fs/promises';
const token = process.env.TRAINING_EXPORT_TOKEN;
const endpoint =
  process.env.TRAINING_API ||
  'https://tichu6-server.kelp-swaths-7q.workers.dev';
const output = process.argv[2];
if (!token || !output)
  throw Error('Set TRAINING_EXPORT_TOKEN and provide a local output filename.');
const url = new URL('/training/export', endpoint);
if (
  url.protocol !== 'https:' &&
  !['localhost', '127.0.0.1'].includes(url.hostname)
)
  throw Error('HTTPS required');
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
  redirect: 'error',
});
if (!response.ok) throw Error(`Export failed: HTTP ${response.status}`);
const data = await response.json();
if (![1, 2].includes(data.schema) || !Array.isArray(data.sessions))
  throw Error('Unsupported dataset');
await writeFile(output, JSON.stringify(data) + '\n', {
  mode: 0o600,
  flag: 'wx',
});
console.log(`Exported ${data.sessions.length} rounds to a new private file.`);
