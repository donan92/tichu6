import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '/tmp/tichu-perf-results');
const output = path.resolve(process.argv[3] || 'docs/performance-results.json');
const runs = [];
async function storedSize(directory) {
  const result = { sqliteFileBytes: 0, storedValueBytes: 0, storedKeys: 0 };
  const files = await readdir(directory, { recursive: true });
  for (const name of files) {
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
      result.storedValueBytes += Number(row.bytes || 0);
      result.storedKeys += Number(row.keys);
    } finally {
      db.close();
    }
  }
  return result;
}
for (const group of await readdir(root)) {
  if (!/^(before|after|consent|bots|soak)/.test(group)) continue;
  for (const name of await readdir(path.join(root, group))) {
    if (!/^\d+-\d+\.json$/.test(name)) continue;
    const file = path.join(root, group, name),
      data = JSON.parse(await readFile(file, 'utf8'));
    if (data.result !== 'PASS') throw Error(file);
    const resources = JSON.parse(
      await readFile(file.replace('.json', '-resources.json'), 'utf8'),
    );
    const samples = resources.map((sample) =>
      sample.rows.reduce(
        (a, row) => {
          const fields = row.trim().split(/\s+/);
          a.cpu += Number(fields[3]);
          a.rssMiB += Number(fields[4]) / 1024;
          return a;
        },
        { cpu: 0, rssMiB: 0 },
      ),
    );
    const counters = data.counters;
    for (const key of [
      'storage.get',
      'storage.put',
      'storage.delete',
      'storage.deleteAll',
      'storage.getAlarm',
      'storage.setAlarm',
      'storage.deleteAlarm',
      'write.lounge',
      'write.training-v1',
      'write.last',
      'engine.requests',
      'broadcast',
      'ws.incoming',
      'ws.messages',
      'ws.bytes',
      'bot.compute',
      'alarm.fired',
    ])
      counters[key] ??= 0;
    const keyWrites = Object.entries(counters)
      .filter(([key]) => key.startsWith('write.'))
      .reduce((n, [, v]) => n + v, 0);
    runs.push({
      group,
      ...data,
      logicalKeyWrites: keyWrites,
      modeledWrittenRows:
        keyWrites +
        (counters['storage.setAlarm'] || 0) +
        (counters['storage.deleteAlarm'] || 0),
      localStorageAfterRun: await storedSize(file.replace('.json', '-state')),
      resources: {
        samples: samples.length,
        meanProcessCpuPercent:
          samples.reduce((n, s) => n + s.cpu, 0) / samples.length,
        peakProcessRssMiB: Math.max(...samples.map((s) => s.rssMiB)),
        firstProcessRssMiB: samples[0]?.rssMiB,
        lastProcessRssMiB: samples.at(-1)?.rssMiB,
      },
    });
  }
}
const ceilOver = (used, included, unit, price) =>
  Math.ceil(Math.max(0, used - included) / unit) * price;
const costs = [];
for (const label of ['before', 'after', 'consent-before', 'consent-after'])
  for (const users of [20, 50, 100]) {
    const selected = runs.filter(
      (r) =>
        (label.startsWith('consent-')
          ? r.group === label
          : r.group.startsWith(label + '-')) && r.identities === users,
    );
    if (!selected.length) continue;
    const seconds = selected.reduce((n, r) => n + r.durationSeconds, 0);
    const rate = (key) =>
      selected.reduce((n, r) => n + (r.counters[key] || 0), 0) / seconds;
    const writes =
      selected.reduce((n, r) => n + r.modeledWrittenRows, 0) / seconds;
    for (const hours of [2, 24]) {
      const time = hours * 3600;
      const requests =
        (rate('ws.incoming') / 20 +
          rate('engine.requests') +
          rate('alarm.fired')) *
          time +
        users +
        20;
      const rowsRead = (rate('storage.get') + rate('storage.getAlarm')) * time;
      const rowsWritten = writes * time;
      const durationUpper = (1 + users / 5) * 0.128 * time;
      const requestCharge = ceilOver(requests * 30, 1e6, 1e6, 0.15);
      const readCharge = ceilOver(rowsRead * 30, 25e9, 1e6, 0.001);
      const writeCharge = ceilOver(rowsWritten * 30, 50e6, 1e6, 1);
      const durationCharges = Object.fromEntries(
        [0.01, 0.1, 1].map((duty) => [
          String(duty),
          ceilOver(durationUpper * duty * 30, 400000, 1e6, 12.5),
        ]),
      );
      // Code-derived upper bound: training changes on every lounge write.
      // This preserves the measured workload rate, not an assertion about paid rows.
      const trainingUpperWrites =
        writes + Math.max(0, rate('write.lounge') - rate('write.training-v1'));
      const upperWriteCharge = ceilOver(
        trainingUpperWrites * time * 30,
        50e6,
        1e6,
        1,
      );
      costs.push({
        label,
        trainingEnabledUpper: {
          rowsWritten: trainingUpperWrites * time,
          freeHoursToWrittenRowLimit: 1e5 / trainingUpperWrites / 3600,
          monthlyWriteUSD: upperWriteCharge,
          monthlyTotalAtDuty: Object.fromEntries(
            Object.entries(durationCharges).map(([duty, fee]) => [
              duty,
              5 + requestCharge + readCharge + upperWriteCharge + fee,
            ]),
          ),
        },
        users,
        hours,
        rowsRead,
        rowsWritten,
        requests,
        durationGBsAtDuty: Object.fromEntries(
          [0.01, 0.1, 1].map((duty) => [String(duty), durationUpper * duty]),
        ),
        freeHoursToWrittenRowLimit: 1e5 / writes / 3600,
        freeHoursToRequestLimit:
          1e5 /
          (rate('ws.incoming') / 20 +
            rate('engine.requests') +
            rate('alarm.fired')) /
          3600,
        monthlyUSD: {
          base: 5,
          requests: requestCharge,
          reads: readCharge,
          writes: writeCharge,
          storage: 0,
          duration: durationCharges,
          totalAtDuty: Object.fromEntries(
            Object.entries(durationCharges).map(([duty, fee]) => [
              duty,
              5 + requestCharge + readCharge + writeCharge + fee,
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
      baselineCommit: 'c4c43d5',
      localOnly: true,
      measurementDate: '2026-11-28',
      runs,
      costs,
      costAssumptions: [
        '30-day month; one initial connection per user and 20 reconnects per day',
        'before/after use consent-off repeated runs; consent-before/after use observed 100-person consent-on runs; trainingEnabledUpper is a code-derived extra-write bound at each measured workload rate',
        'Constant sampled workload during active hours; no workload outside that window',
        'Logical storage calls/keys model rows, not Cloudflare billing measurements; metadata/retention cleanup and churn excluded',
        'Duration is an assumed 1%, 10%, or 100% active duty across Lounge + rooms, not measured local elapsed time',
        'Storage assumed below 5 GB-month; Workers upgrade requests assumed within included quotas; other account traffic, taxes and exchange rates excluded',
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log(output);
