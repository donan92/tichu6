import WebSocket from 'ws';
import { writeFile } from 'node:fs/promises';
// Short-lived inspector sessions: no remote object handles or retained console values.
export async function heap(inspector, snapshotPath, wakeURL) {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(inspector))
    throw Error('Local inspector only');
  const targets = await (await fetch(inspector + '/json/list')).json();
  const target =
    targets.find((t) => t.id.startsWith('core:user:')) || targets[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.once('open', r);
    ws.once('error', j);
  });
  let id = 0,
    contextId;
  const pending = new Map();
  const chunks = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.method === 'Runtime.executionContextCreated')
      contextId = m.params.context.id;
    if (m.method === 'HeapProfiler.addHeapSnapshotChunk')
      chunks.push(m.params.chunk);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m);
  });
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const key = ++id;
      const timeout = setTimeout(() => {
        pending.delete(key);
        reject(Error('Inspector timeout: ' + method));
      }, 20000);
      pending.set(key, (m) => {
        clearTimeout(timeout);
        pending.delete(key);
        if (m.error) reject(Error(m.error.message));
        else resolve(m.result);
      });
      ws.send(JSON.stringify({ id: key, method, params }));
    });
  const wake = wakeURL
    ? setInterval(() => {
        void fetch(wakeURL + '/__diagnostics').catch(() => {});
      }, 100)
    : undefined;
  try {
    await call('Runtime.enable');
    const usage = await call('Runtime.getHeapUsage');
    const evaluated = await call('Runtime.evaluate', {
      expression: 'JSON.stringify(process.memoryUsage())',
      contextId,
      returnByValue: true,
    });
    const nodeMemory = evaluated.exceptionDetails
      ? null
      : JSON.parse(evaluated.result.value);
    if (snapshotPath) {
      await call('HeapProfiler.enable');
      await call('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
      const raw = chunks.join('');
      const parsed = JSON.parse(raw);
      if (!parsed.nodes?.length) throw Error('Incomplete snapshot');
      await writeFile(snapshotPath, raw);
    }
    return {
      usage,
      nodeMemory,
      ...(snapshotPath
        ? { afterSnapshot: await call('Runtime.getHeapUsage') }
        : {}),
    };
  } finally {
    clearInterval(wake);
    ws.terminate();
  }
}
if (process.argv[1]?.endsWith('/heap.mjs'))
  console.log(JSON.stringify(await heap(process.argv[2], process.argv[3])));
