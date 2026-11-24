import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  renameSync,
} from 'node:fs';
import { performance } from 'node:perf_hooks';
import { deck, newGame, startRound, act, team } from '../../src/game.js';
import { candidate } from './candidate.js';
import { botAction as baseline } from './baseline.js';

const minutes = Number(process.argv[2] ?? 120);
if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 120)
  throw Error('Duration must be within 120 minutes');
const output = new URL('./endurance/', import.meta.url);
mkdirSync(output, { recursive: true });
const statusFile = new URL('status.json', output);
if (existsSync(statusFile))
  throw Error(
    'Existing endurance run: inspect status; do not overwrite/restart',
  );
const variants = [
  { id: 'structure', variant: 'structure', config: {} },
  { id: 'hybrid', variant: 'hybrid', config: {} },
  { id: 'gentle', variant: 'structure', config: { structureWeight: 15 } },
  {
    id: 'shed',
    variant: 'structure',
    config: { structureWeight: 80, breakBomb: 50 },
  },
  {
    id: 'protect',
    variant: 'structure',
    config: { breakBomb: 300, leadBomb: 80, responseBomb: 80 },
  },
  {
    id: 'control',
    variant: 'structure',
    config: { powerWeight: 2, urgentPower: -4 },
  },
  {
    id: 'hybrid-gentle',
    variant: 'hybrid',
    config: { structureWeight: 15, powerWeight: 2 },
  },
  {
    id: 'hybrid-shed',
    variant: 'hybrid',
    config: { structureWeight: 80, breakBomb: 50 },
  },
  {
    id: 'calls-conservative',
    variant: 'calls',
    config: { grandThreshold: 8, smallThreshold: 10 },
  },
  {
    id: 'calls-moderate',
    variant: 'calls',
    config: { grandThreshold: 7, smallThreshold: 9 },
  },
];
const started = performance.now(),
  deadline = started + minutes * 60000;
const state = {
  status: 'running',
  pid: process.pid,
  startedAt: new Date().toISOString(),
  durationMinutes: minutes,
  deadline: new Date(Date.now() + minutes * 60000).toISOString(),
  phase: 'development',
  pairs: 0,
  matches: 0,
  rounds: 0,
  moves: 0,
  variants,
  statistics: {},
  selected: null,
  holdout: {},
  errors: 0,
};
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
function save() {
  state.elapsedSeconds = (performance.now() - started) / 1000;
  const tmp = new URL('status.tmp', output);
  writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  renameSync(tmp, statusFile);
}
function cards(seed, round) {
  const result = deck();
  let counter = 0;
  for (let i = result.length - 1; i > 0; i--) {
    const bound = Math.floor(4294967296 / (i + 1)) * (i + 1);
    let x;
    do {
      x = createHash('sha256')
        .update(`tichu6-endurance-v1:${seed}:${round}:${counter++}`)
        .digest()
        .readUInt32LE(0);
    } while (x >= bound);
    const j = x % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function match(policy, seed, candidateTeam) {
  let s = newGame(),
    rounds = 0,
    moves = 0,
    decisionMs = 0,
    decisions = 0;
  while (s.phase !== 'matchEnd') {
    if (++rounds > 200) throw Error('Match exceeded 200 rounds');
    s = startRound(s, cards(seed, rounds));
    let roundMoves = 0;
    while (!['roundEnd', 'matchEnd'].includes(s.phase)) {
      if (++roundMoves > 2000) throw Error('Round exceeded 2000 moves');
      const seat =
        s.phase === 'grand'
          ? s.ready.findIndex((x) => !x)
          : s.phase === 'exchange'
            ? s.exchanges.findIndex((x) => !x)
            : s.phase === 'trick'
              ? s.last
              : s.turn;
      const t = performance.now();
      const action =
        team(seat) === candidateTeam
          ? candidate(s, seat, policy.variant, policy.config)
          : baseline(s, seat);
      if (team(seat) === candidateTeam) {
        decisionMs += performance.now() - t;
        decisions++;
      }
      s = act(s, seat, action);
      moves++;
    }
  }
  return {
    candidateTeam,
    scores: s.scores,
    margin: s.scores[candidateTeam] - s.scores[1 - candidateTeam],
    win: s.scores[candidateTeam] > s.scores[1 - candidateTeam],
    rounds,
    moves,
    decisionMs: decisionMs / decisions,
  };
}
function update(table, id, results) {
  const v = (table[id] ??= {
    pairs: 0,
    matches: 0,
    wins: 0,
    mean: 0,
    m2: 0,
    rounds: 0,
  });
  const value = (results[0].margin + results[1].margin) / 2;
  v.pairs++;
  v.matches += 2;
  v.wins += results.filter((x) => x.win).length;
  v.rounds += results.reduce((n, x) => n + x.rounds, 0);
  const d = value - v.mean;
  v.mean += d / v.pairs;
  v.m2 += d * (value - v.mean);
  v.standardError =
    v.pairs > 1 ? Math.sqrt(v.m2 / (v.pairs - 1) / v.pairs) : null;
}
save();
try {
  while (performance.now() < deadline && !stopping) {
    if (
      state.phase === 'development' &&
      performance.now() - started >= minutes * 60000 * 0.75
    ) {
      const ranked = variants
        .filter((v) => (state.statistics[v.id]?.pairs ?? 0) >= 5)
        .sort((a, b) => {
          const x = state.statistics[a.id],
            y = state.statistics[b.id];
          return y.mean - 2 * y.standardError - (x.mean - 2 * x.standardError);
        });
      state.selected = ranked[0] ?? variants[0];
      state.phase = 'holdout';
      save();
    }
    const policy =
      state.phase === 'holdout'
        ? state.selected
        : variants[state.pairs % variants.length];
    const seed =
      (state.phase === 'holdout' ? 200000000 : 100000000) + state.pairs;
    const results = [match(policy, seed, 0), match(policy, seed, 1)];
    state.pairs++;
    state.matches += 2;
    state.rounds += results.reduce((n, r) => n + r.rounds, 0);
    state.moves += results.reduce((n, r) => n + r.moves, 0);
    update(
      state.phase === 'holdout' ? state.holdout : state.statistics,
      policy.id,
      results,
    );
    appendFileSync(
      new URL('results.jsonl', output),
      JSON.stringify({
        pair: state.pairs,
        phase: state.phase,
        policy: policy.id,
        seed,
        results,
      }) + '\n',
    );
    save();
    if (state.pairs % 10 === 0)
      console.log(
        JSON.stringify({
          phase: state.phase,
          pairs: state.pairs,
          matches: state.matches,
          rounds: state.rounds,
          elapsedSeconds: state.elapsedSeconds,
        }),
      );
  }
  state.status = stopping ? 'stopped' : 'complete';
  save();
} catch (error) {
  state.status = 'failed';
  state.errors++;
  state.error = String(error);
  save();
  throw error;
}
console.log(JSON.stringify(state));
