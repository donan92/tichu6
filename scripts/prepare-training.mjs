import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareDataset } from './training-dataset.mjs';

// Offline conversion: split whole rounds, never individual decisions from one round.
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw Error(
    'Usage: node scripts/prepare-training.mjs export.json output-directory',
  );
const data = JSON.parse(await readFile(input, 'utf8'));
const { partitions, ignoredBots, legacyRounds } = prepareDataset(data);
// An existing directory might contain a different split or incomplete prior run.
// Refuse it instead of mixing datasets or changing its permissions.
await mkdir(output, { mode: 0o700 });
for (const [name, rows] of Object.entries(partitions))
  await writeFile(
    join(output, `${name}.jsonl`),
    rows.map((row) => JSON.stringify(row)).join('\n') +
      (rows.length ? '\n' : ''),
    { mode: 0o600, flag: 'wx' },
  );
console.log(
  JSON.stringify({
    examples: Object.fromEntries(
      Object.entries(partitions).map(([key, rows]) => [key, rows.length]),
    ),
    ignoredBots,
    legacyRounds,
  }),
);
