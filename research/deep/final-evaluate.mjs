// Run once after BOTH E0 jobs end. Never feed this final test back into training.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { deck, newGame, startRound, act, team } from '../../src/game.js';
import { botAction as baseline } from '../bots/baseline.js';
import { candidate } from '../bots/candidate.js';
import { pairedStatistics } from '../bots/paired-statistics.mjs';
import { decide, loadModel } from './policy.mjs';

const directory = new URL('./run/', import.meta.url);
const read = async (name) =>
  JSON.parse(await readFile(new URL(name, directory), 'utf8'));
const training = await read('status.json');
const validation = await read('validation.json');
const endurance = JSON.parse(
  await readFile(
    new URL('../bots/endurance/status.json', import.meta.url),
    'utf8',
  ),
);
if (
  training.status !== 'complete' ||
  validation.status !== 'complete' ||
  endurance.status !== 'complete' ||
  training.errors ||
  endurance.errors
)
  throw Error(
    'All original experiments must complete successfully before final evaluation',
  );
const checkpoint = await readFile(
  new URL('best-validation-model.json', directory),
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
if (hash(checkpoint) !== validation.best?.hash || !endurance.selected)
  throw Error(
    'Selected checkpoint or heuristic does not match selection evidence',
  );

// Atomic directory creation prevents reruns from silently reusing the test set.
const output = new URL('final-evaluation/', directory);
await mkdir(output);
const modelPath = new URL('frozen-model.json', output);
await writeFile(modelPath, checkpoint, { flag: 'wx' });
const configurations = [
  {
    id: 'model3-vs-baseline',
    policy: 'model',
    candidateSeats: 3,
    opponent: 'baseline',
  },
  {
    id: 'model3-vs-selected-heuristic',
    policy: 'model',
    candidateSeats: 3,
    opponent: 'selected',
  },
  {
    id: 'model1-baseline2-vs-baseline',
    policy: 'model',
    candidateSeats: 1,
    opponent: 'baseline',
  },
  {
    id: 'model2-baseline1-vs-baseline',
    policy: 'model',
    candidateSeats: 2,
    opponent: 'baseline',
  },
  {
    id: 'heuristic3-vs-baseline',
    policy: 'selected',
    candidateSeats: 3,
    opponent: 'baseline',
  },
  {
    id: 'heuristic3-vs-caller',
    policy: 'selected',
    candidateSeats: 3,
    opponent: 'calls',
  },
  {
    id: 'heuristic1-baseline2-vs-baseline',
    policy: 'selected',
    candidateSeats: 1,
    opponent: 'baseline',
  },
  {
    id: 'heuristic2-baseline1-vs-baseline',
    policy: 'selected',
    candidateSeats: 2,
    opponent: 'baseline',
  },
  {
    id: 'model3-vs-caller',
    policy: 'model',
    candidateSeats: 3,
    opponent: 'calls',
  },
];
const manifest = {
  schema: 1,
  modelHash: hash(checkpoint),
  selectedHeuristic: endurance.selected,
  pairsPerConfiguration: 1000,
  seedRange: [700000000, 700000999],
  shuffleNamespace: 'deep-final-v1',
  configurations,
  callingOpponent: {
    variant: 'calls',
    config: { grandThreshold: 5.5, smallThreshold: 7 },
  },
  sources: Object.fromEntries(
    await Promise.all(
      [
        '../../src/game.js',
        './policy.mjs',
        './final-evaluate.mjs',
        '../bots/baseline.js',
        '../bots/candidate.js',
      ].map(async (path) => [
        path,
        hash(await readFile(new URL(path, import.meta.url))),
      ]),
    ),
  ),
  limitations: [
    'One training seed',
    'Round scoring only; does not establish full-match win rate',
    'No off-turn bomb decisions in E0',
    'Human collaboration untested',
  ],
};
await writeFile(
  new URL('manifest.json', output),
  JSON.stringify(manifest, null, 2),
  { flag: 'wx' },
);
const progress = {
  status: 'running',
  pid: process.pid,
  completedPairs: 0,
  errors: 0,
};
const saveProgress = () =>
  writeFile(new URL('status.json', output), JSON.stringify(progress, null, 2));
await saveProgress();
function cards(seed) {
  const result = deck();
  let counter = 0;
  for (let i = result.length - 1; i > 0; i--) {
    const bound = Math.floor(4294967296 / (i + 1)) * (i + 1);
    let value;
    do {
      value = createHash('sha256')
        .update(`${manifest.shuffleNamespace}:${seed}:${counter++}`)
        .digest()
        .readUInt32LE(0);
    } while (value >= bound);
    const j = value % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
let model;
try {
  model = await loadModel(fileURLToPath(modelPath));
  const choose = (policy, state, seat) => {
    if (policy === 'model')
      return decide(model, state, seat, () => 0, false).action;
    if (policy === 'selected')
      return candidate(
        state,
        seat,
        endurance.selected.variant,
        endurance.selected.config,
      );
    if (policy === 'calls')
      return candidate(
        state,
        seat,
        manifest.callingOpponent.variant,
        manifest.callingOpponent.config,
      );
    return baseline(state, seat);
  };
  const report = {};
  for (const configuration of configurations) {
    const results = [];
    for (let offset = 0; offset < manifest.pairsPerConfiguration; offset++) {
      const seed = manifest.seedRange[0] + offset,
        pair = [],
        games = [];
      for (const modelTeam of [0, 1]) {
        let state = startRound(newGame(), cards(seed)),
          moves = 0;
        // Rotate candidate-controlled seats; remaining teammates use baseline.
        const seats = new Set(
          Array.from(
            { length: configuration.candidateSeats },
            (_, i) => modelTeam + 2 * ((offset + i) % 3),
          ),
        );
        while (!['roundEnd', 'matchEnd'].includes(state.phase)) {
          if (++moves > 2000)
            throw Error('Final evaluation round exceeded move limit');
          const seat =
            state.phase === 'grand'
              ? state.ready.findIndex((x) => !x)
              : state.phase === 'exchange'
                ? state.exchanges.findIndex((x) => !x)
                : state.phase === 'trick'
                  ? state.last
                  : state.turn;
          const policy = seats.has(seat)
            ? configuration.policy
            : team(seat) !== modelTeam
              ? configuration.opponent
              : 'baseline';
          const action = choose(policy, state, seat);
          state = act(state, seat, action);
        }
        pair.push(state.delta[modelTeam] - state.delta[1 - modelTeam]);
        games.push({
          candidateTeam: modelTeam,
          delta: state.delta,
          calls: state.calls,
          finish: state.finish,
          moves,
        });
      }
      results.push({ seed, margins: pair, games });
      progress.completedPairs++;
      if (progress.completedPairs % 100 === 0) await saveProgress();
    }
    await writeFile(
      new URL(`${configuration.id}.json`, output),
      JSON.stringify(results),
      { flag: 'wx' },
    );
    report[configuration.id] = pairedStatistics(
      results.map((result) => result.margins),
    );
  }
  await writeFile(
    new URL('report.json', output),
    JSON.stringify(
      { unit: 'team-score-margin-per-round', manifest, configurations: report },
      null,
      2,
    ),
    { flag: 'wx' },
  );
  progress.status = 'complete';
  await saveProgress();
} catch (error) {
  progress.status = 'failed';
  progress.errors++;
  progress.error = String(error);
  await saveProgress();
  throw error;
} finally {
  model?.dispose();
}
