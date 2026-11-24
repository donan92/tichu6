import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { deck, newGame, startRound, act, team } from '../../src/game.js';
import { botAction as baseline } from './baseline.js';
import { candidate } from './candidate.js';

const [
  variant = 'structure',
  seedText = '101',
  pairsText = '5',
  label = 'development',
] = process.argv.slice(2);
const seedStart = Number(seedText),
  pairs = Number(pairsText);
if (
  !['structure', 'calls', 'hybrid'].includes(variant) ||
  !Number.isSafeInteger(seedStart) ||
  !Number.isSafeInteger(pairs) ||
  pairs < 1 ||
  pairs > 30 ||
  !/^[a-z-]+$/.test(label)
)
  throw Error('Invalid experiment arguments');
const ledgerPath = new URL('./ledger.json', import.meta.url);
const ledger = existsSync(ledgerPath)
  ? JSON.parse(readFileSync(ledgerPath, 'utf8'))
  : { limit: 100, reservedTests: 32, contingency: 8, runs: [] };
const used = ledger.runs.reduce((n, r) => n + r.rounds, 0);
if (used + pairs * 2 + ledger.reservedTests + ledger.contingency > ledger.limit)
  throw Error('100-game budget exhausted');
const batch = {
  variant,
  seedStart,
  pairs,
  label,
  rounds: pairs * 2,
  status: 'started',
  results: [],
};
ledger.runs.push(batch);
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
function seededDeck(seed) {
  let x = seed >>> 0;
  const cards = deck();
  for (let i = cards.length - 1; i > 0; i--) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const j = x % (i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
for (let seed = seedStart; seed < seedStart + pairs; seed++)
  for (const candidateTeam of [0, 1]) {
    let s = startRound(newGame(), seededDeck(seed)),
      moves = 0,
      elapsed = 0,
      decisions = 0;
    while (!['roundEnd', 'matchEnd'].includes(s.phase)) {
      if (++moves > 2000) throw Error('Round did not terminate');
      const seat =
        s.phase === 'grand'
          ? s.ready.findIndex((x) => !x)
          : s.phase === 'exchange'
            ? s.exchanges.findIndex((x) => !x)
            : s.phase === 'trick'
              ? s.last
              : s.turn;
      const start = performance.now();
      const action =
        team(seat) === candidateTeam
          ? candidate(s, seat, variant)
          : baseline(s, seat);
      if (team(seat) === candidateTeam) {
        elapsed += performance.now() - start;
        decisions++;
      }
      s = act(s, seat, action);
    }
    const result = {
      seed,
      candidateTeam,
      delta: s.delta,
      margin: s.delta[candidateTeam] - s.delta[1 - candidateTeam],
      firstOut: team(s.finish[0]) === candidateTeam,
      calls: s.calls,
      finish: s.finish,
      moves,
      decisionMs: elapsed / decisions,
    };
    batch.results.push(result);
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
    console.log(JSON.stringify(result));
  }
batch.status = 'complete';
batch.meanMargin =
  batch.results.reduce((n, r) => n + r.margin, 0) / batch.results.length;
batch.firstOutRate =
  batch.results.filter((r) => r.firstOut).length / batch.results.length;
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
console.log(
  JSON.stringify({
    variant,
    meanMargin: batch.meanMargin,
    firstOutRate: batch.firstOutRate,
  }),
);
