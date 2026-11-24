import { readFileSync, writeFileSync } from 'node:fs';
const ledger = JSON.parse(
  readFileSync(new URL('./ledger.json', import.meta.url), 'utf8'),
);
const summaries = ledger.runs.map((run) => {
  const pairs = Array.from(
    { length: run.pairs },
    (_, i) =>
      run.results
        .filter((r) => r.seed === run.seedStart + i)
        .reduce((n, r) => n + r.margin, 0) / 2,
  );
  const mean = pairs.reduce((a, b) => a + b, 0) / pairs.length;
  const sd = Math.sqrt(
    pairs.reduce((n, x) => n + (x - mean) ** 2, 0) / (pairs.length - 1),
  );
  return {
    variant: run.variant,
    label: run.label,
    rounds: run.results.length,
    meanMargin: mean,
    pairedStandardError: sd / Math.sqrt(pairs.length),
    wins: run.results.filter((r) => r.margin > 0).length,
    ties: run.results.filter((r) => r.margin === 0).length,
    firstOutRate: run.firstOutRate,
    meanDecisionMs:
      run.results.reduce((n, r) => n + r.decisionMs, 0) / run.results.length,
  };
});
const report = {
  researchRounds: ledger.runs.reduce((n, r) => n + r.rounds, 0),
  selectedPolicy: 'v0.8.5 baseline',
  reason:
    'Development gains failed to generalize to held-out deals; no evidence to replace production strategy.',
  summaries,
};
writeFileSync(
  new URL('./summary.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
