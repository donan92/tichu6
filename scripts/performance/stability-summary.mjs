import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
const root = path.resolve(process.argv[2]);
const output = process.argv[3] || 'docs/stability-results.json';
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const lines = async (file) =>
  (await readFile(file, 'utf8'))
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(JSON.parse);
async function storage(directory) {
  const result = { storedKeys: 0, storedValueBytes: 0, sqliteFileBytes: 0 };
  for (const name of await readdir(directory, { recursive: true })) {
    if (!/-(Lounge|RoomEngine)\//.test(name)) continue;
    const file = path.join(directory, name);
    if (/\.sqlite(?:-wal|-shm)?$/.test(name))
      result.sqliteFileBytes += (await stat(file)).size;
    if (!name.endsWith('.sqlite')) continue;
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name='_cf_KV'").get())
        continue;
      const row = db
        .prepare(
          'SELECT COUNT(*) AS keys, SUM(length(value)) AS bytes FROM _cf_KV',
        )
        .get();
      result.storedKeys += Number(row.keys);
      result.storedValueBytes += Number(row.bytes || 0);
    } finally {
      db.close();
    }
  }
  return result;
}
const runs = [];
for (const [folder, variant, consent] of [
  ['baseline-off-v2', 'before', false],
  ['baseline-on-v2', 'before', true],
  ['candidate-off', 'after', false],
  ['candidate-on', 'after', true],
]) {
  const dir = path.join(root, folder),
    result = await json(path.join(dir, 'result.json')),
    run = await json(path.join(dir, 'run.json'));
  if (
    result.result !== 'PASS' ||
    run.code !== 0 ||
    run.errors.length ||
    result.durationSeconds < 7200
  )
    throw Error('Incomplete or failed run: ' + folder);
  const clients = await lines(path.join(dir, 'client-minute.jsonl'));
  const server = await lines(path.join(dir, 'server-minute.jsonl'));
  if (new Set(server.map((s) => s.diagnostic.epoch)).size !== 1)
    throw Error('Metrics isolate reset: ' + folder);
  if (
    clients.some(
      (s) =>
        s.openSockets < 100 ||
        s.openSockets > 120 ||
        Object.values(s.counters).some((v) => v < 0),
    )
  )
    throw Error('Invalid sample: ' + folder);
  runs.push({
    ...result,
    variant,
    consent,
    kind: 'two-hour churn',
    reconnectOverlapSamples: clients
      .filter((sample) => sample.openSockets > 100)
      .map(({ elapsedSeconds, openSockets }) => ({
        elapsedSeconds,
        openSockets,
      })),
    run,
    storage: await storage(path.join(dir, 'state')),
    clientSamples: clients,
    serverSamples: server.map(
      ({
        at,
        index,
        label,
        diagnostic,
        memory,
        processes,
        collectorMemory,
      }) => ({
        at,
        index,
        label,
        diagnostic: { ...diagnostic, epoch: undefined },
        memory: {
          heapUsed: memory.usage.usedSize,
          heapTotal: memory.usage.totalSize,
          embedderHeapUsed: memory.usage.embedderHeapUsedSize,
          backingStorage: memory.usage.backingStorageSize,
          external: null,
          afterSnapshot: memory.afterSnapshot,
        },
        runtimeProcesses: processes.map((p) => ({
          role: p.command.includes('workerd serve')
            ? p.command.includes('--inspector-addr')
              ? 'user-workerd'
              : 'proxy-workerd'
            : p.command.includes('esbuild')
              ? 'esbuild'
              : 'wrangler-node',
          cpu: p.cpu,
          rssBytes: p.rssBytes,
        })),
        collectorMemory,
      }),
    ),
  });
}
for (const variant of ['before', 'after'])
  for (const consent of [false, true]) {
    const dir = path.join(root, `short-${variant}-${consent ? 'on' : 'off'}`);
    for (const name of await readdir(dir))
      if (/^\d+-\d+\.json$/.test(name)) {
        const result = await json(path.join(dir, name));
        if (result.result !== 'PASS') throw Error(name);
        runs.push({
          ...result,
          variant,
          consent,
          kind: '120s steady',
          storage: await storage(
            path.join(dir, name.replace('.json', '-state')),
          ),
        });
      }
  }
const controlDirectory = path.join(root, 'no-profiler-control');
const controlFile = (await readdir(controlDirectory)).find((name) =>
  /^100-\d+\.json$/.test(name),
);
if (!controlFile) throw Error('Missing unprofiled control');
const control = await json(path.join(controlDirectory, controlFile));
if (control.result !== 'PASS' || control.durationSeconds < 3600)
  throw Error('Incomplete unprofiled control');
control.resources = (
  await json(
    path.join(
      controlDirectory,
      controlFile.replace('.json', '-resources.json'),
    ),
  )
).map(({ at, rows }) => ({
  at,
  processes: rows.map((line) => {
    const [, , , cpu, rss, ...command] = line.trim().split(/\s+/);
    const text = command.join(' ');
    return {
      cpu: Number(cpu),
      rssBytes: Number(rss) * 1024,
      role: text.includes('workerd serve')
        ? text.includes('--inspector-addr')
          ? 'user-workerd'
          : 'proxy-workerd'
        : text.includes('esbuild')
          ? 'esbuild'
          : 'wrangler-node',
    };
  }),
}));
const over = (used, limit, unit, price) =>
  Math.ceil(Math.max(0, used - limit) / unit) * price;
const costs = [];
for (const run of runs) {
  const c = run.counters;
  const reference = runs.find(
    (candidate) =>
      candidate.variant === 'before' &&
      candidate.identities === run.identities &&
      candidate.consent === run.consent,
  );
  const seconds = reference.durationSeconds;
  const actionsPerSecond = reference.acceptedHumanMoves / seconds;
  // Equal accepted play/pass workload for each before/after cost comparison.
  // Keep measured random-deal differences visible; this is normalization, not
  // a claim that both games had identical hands or transition sequences.
  const rate = (k) => ((c[k] || 0) / run.acceptedHumanMoves) * actionsPerSecond;
  const recycledRate = (reference.recycledRooms || 0) / seconds;
  const reconnectRate = (reference.reconnects || 0) / seconds;
  const dataRate =
    (Object.entries(c)
      .filter(([k]) => k.startsWith('write.'))
      .reduce((n, [, v]) => n + v, 0) /
      run.acceptedHumanMoves) *
    actionsPerSecond;
  const alarmRate = rate('storage.setAlarm') + rate('storage.deleteAlarm');
  for (const hours of [2, 24]) {
    const time = hours * 3600;
    const newRooms = run.activeRooms + recycledRate * time;
    // Additional post-retention work is not observed in a 2-hour run: conservative
    // two alarm callbacks, two reads, one reschedule and one KV delete per room.
    const retentionRequests = 2 * newRooms,
      retentionReads = 2 * newRooms,
      retentionWriteRows = 2 * newRooms;
    const upgrades = run.identities + reconnectRate * time;
    const requests =
      (rate('engine.requests') +
        rate('alarm.fired') +
        rate('ws.incoming') / 20) *
        time +
      upgrades +
      retentionRequests;
    const dataKeyWrites = dataRate * time,
      alarmWrites = alarmRate * time;
    const rowsWritten = dataKeyWrites + alarmWrites + retentionWriteRows;
    const rowsRead =
      (rate('storage.get') + rate('storage.getAlarm')) * time + retentionReads;
    const fees = {
      base: 5,
      requests: over(requests * 30, 1e6, 1e6, 0.15),
      reads: over(rowsRead * 30, 25e9, 1e6, 0.001),
      writes: over(rowsWritten * 30, 50e6, 1e6, 1),
      storage: 0,
    };
    const duration = Object.fromEntries(
      [0.01, 0.1, 1].map((duty) => {
        const GBs = (1 + run.activeRooms) * 0.128 * time * duty;
        return [
          String(duty),
          { dailyGBs: GBs, monthlyUSD: over(GBs * 30, 400000, 1e6, 12.5) },
        ];
      }),
    );
    const freeHoursToWriteQuota =
      Math.max(0, 100000 - 2 * run.activeRooms) /
      ((dataRate + alarmRate + 2 * recycledRate) * 3600);
    costs.push({
      variant: run.variant,
      consent: run.consent,
      users: run.identities,
      hours,
      basis: run.kind,
      normalizedActionsPerSecond: actionsPerSecond,
      requests,
      rowsRead,
      dataKeyWrites,
      alarmWrites,
      retentionWriteRows,
      modeledRowsWritten: rowsWritten,
      newRooms,
      upgrades,
      freeHoursToWriteQuota,
      freeHoursToRequestQuota:
        Math.max(0, 100000 - run.identities - 2 * run.activeRooms) /
        ((rate('engine.requests') +
          rate('alarm.fired') +
          rate('ws.incoming') / 20 +
          reconnectRate +
          2 * recycledRate) *
          3600),
      duration,
      monthlyUSD: {
        ...fees,
        totalAtDuty: Object.fromEntries(
          Object.entries(duration).map(([k, v]) => [
            k,
            Object.values(fees).reduce((a, b) => a + b, 0) + v.monthlyUSD,
          ]),
        ),
      },
    });
  }
}
await writeFile(
  output,
  JSON.stringify(
    {
      baseline: '3245b51',
      localOnly: true,
      pricingChecked: '2026-11-28',
      runs,
      unprofiledControl: control,
      costs,
      notes: [
        'API logical keys + alarms + separately modeled 24h retention cleanup are not observed billed SQLite rows.',
        'Workerd process.memoryUsage returned zeros, so external is unavailable, not zero; backingStorage/embedder are inspector fields, not Node external.',
        'Four long cases ran concurrently on a 16-core/64GiB Mac; a fifth unprofiled 100-user control ran during the final hour. Snapshots trigger GC and profiling adds overhead.',
        'Paid assumes storage below 5GB-month and Workers upgrade requests/CPU within included allowance; no billed Duration measured.',
        '20/50 cases are steady 120s samples; 100-user cases include 10min reconnect and 15min room churn. Random deals are not seeded.',
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log(output);
