import { readFile, writeFile } from 'node:fs/promises';
import { pairedStatistics } from './paired-statistics.mjs';

const directory = new URL('./endurance/', import.meta.url);
const status = JSON.parse(
  await readFile(new URL('status.json', directory), 'utf8'),
);
if (status.status !== 'complete' || status.errors !== 0)
  throw Error(
    'A successful terminal endurance run is required; never restart it here',
  );
const rows = (await readFile(new URL('results.jsonl', directory), 'utf8'))
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
const groups = new Map(),
  seeds = new Set();
let rounds = 0,
  moves = 0;
for (const [index, row] of rows.entries()) {
  if (
    row.pair !== index + 1 ||
    seeds.has(row.seed) ||
    !['development', 'holdout'].includes(row.phase) ||
    !status.variants.some((variant) => variant.id === row.policy) ||
    row.results.length !== 2 ||
    (row.phase === 'holdout' && row.policy !== status.selected?.id)
  )
    throw Error('Invalid or duplicate evaluation pair');
  seeds.add(row.seed);
  for (const [team, result] of row.results.entries()) {
    if (
      result.candidateTeam !== team ||
      result.scores.length !== 2 ||
      result.margin !== result.scores[team] - result.scores[1 - team] ||
      result.win !== result.margin > 0 ||
      !Number.isInteger(result.rounds) ||
      result.rounds < 1 ||
      !Number.isInteger(result.moves) ||
      result.moves < 1
    )
      throw Error('Inconsistent game outcome');
    rounds += result.rounds;
    moves += result.moves;
  }
  const key = `${row.phase}/${row.policy}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row.results.map((result) => result.margin));
}
if (
  rows.length !== status.pairs ||
  rows.length * 2 !== status.matches ||
  rounds !== status.rounds ||
  moves !== status.moves
)
  throw Error('Status totals do not match the append-only results');
if (![...groups.keys()].some((key) => key.startsWith('holdout/')))
  throw Error('No frozen-candidate holdout pairs');
const report = {
  unit: 'final-team-score-margin-per-full-match',
  limitations: [
    'One baseline opponent; not evidence against arbitrary strategies or humans',
    'Bootstrap intervals cover deck sampling, not algorithm selection or training-seed variance',
    'Development variants used different seed samples; only team-swapped games within a pair share a deck stream',
    'Calls variants also change hand decomposition; declaration effects are not isolated',
    'The baseline never declares Tichu; performance against strong callers is untested',
  ],
  selected: status.selected,
  matches: status.matches,
  rounds,
  moves,
  elapsedSeconds: status.elapsedSeconds,
  groups: Object.fromEntries(
    [...groups].map(([key, pairs]) => [key, pairedStatistics(pairs)]),
  ),
};
await writeFile(
  new URL('report.json', directory),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
