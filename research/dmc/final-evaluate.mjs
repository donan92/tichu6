// Sealed final evaluation for the DMC pilot. Never use its results for training.
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { act, deck, newGame, startRound, team } from '../../src/game.js';
import { botAction as baseline } from '../bots/baseline.js';
import { candidate } from '../bots/candidate.js';
import { pairedStatistics } from '../bots/paired-statistics.mjs';
import { loadModel, decide } from './policy.mjs';

const ROOT = new URL('./', import.meta.url);
const DMC_RUN = new URL('./run/', ROOT);
const OUTPUT_PATH = resolve(fileURLToPath(ROOT), 'final-evaluation');
const FINAL_SEEDS = Array.from({ length: 1000 }, (_, i) => 820000000 + i);
const PAIRS = 1000;
const MAX_MOVES = 2000;
const HISTORY_LIMIT = 128;
const SECONDARY_CASES = [
  { id: 'primary-vs-selected', modelSeats: 3, opponent: 'selected' },
  { id: 'primary-vs-calls-5.5-7', modelSeats: 3, opponent: 'calls' },
  { id: 'primary-mixed1-vs-baseline', modelSeats: 1, opponent: 'baseline' },
  { id: 'primary-mixed2-vs-baseline', modelSeats: 2, opponent: 'baseline' },
];

async function json(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
async function fileHash(url) {
  return sha256(await readFile(url));
}
function stream(namespace, seed) {
  let counter = 0;
  return () =>
    createHash('sha256')
      .update(`${namespace}:${seed}:${counter++}`)
      .digest()
      .readUInt32LE(0);
}
function cards(namespace, seed) {
  const result = deck();
  const next = stream(namespace, seed);
  for (let i = result.length - 1; i > 0; i--) {
    const bound = Math.floor(4294967296 / (i + 1)) * (i + 1);
    let value;
    do value = next();
    while (value >= bound);
    const j = value % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function actionSeat(state) {
  return state.phase === 'grand'
    ? state.ready.findIndex((value) => !value)
    : state.phase === 'exchange'
      ? state.exchanges.findIndex((value) => !value)
      : state.phase === 'trick'
        ? state.last
        : state.turn;
}
function publicHistoryEntry(phase, seat, action, before) {
  if (action.type === 'exchange') return null;
  const entry = {
    phase,
    seat,
    type: action.type,
    count: Array.isArray(action.ids) ? action.ids.length : 0,
    target: action.type === 'collect' ? (action.target ?? null) : null,
  };
  if (action.type === 'play')
    entry.cards = action.ids.map((id) => {
      const card = before.hands[seat].find((value) => value.id === id);
      if (!card) throw Error('Accepted play referenced an unavailable card');
      return {
        rank: card.rank,
        suit: card.suit,
        ...(card.special ? { special: card.special } : {}),
      };
    });
  return entry;
}
function pushHistory(history, phase, seat, action, before) {
  const event = publicHistoryEntry(phase, seat, action, before);
  if (!event) return;
  history.push(event);
  if (history.length > HISTORY_LIMIT) history.shift();
}
function modelSeats(candidateTeam, count, offset) {
  return new Set(
    Array.from(
      { length: count },
      (_, i) => candidateTeam + 2 * ((offset + i) % 3),
    ),
  );
}
function heuristicAction(state, seat, kind, selected) {
  if (kind === 'baseline') return baseline(state, seat);
  if (kind === 'selected')
    return candidate(state, seat, selected.variant, selected.config);
  return candidate(state, seat, 'calls', {
    grandThreshold: 5.5,
    smallThreshold: 7,
  });
}
function play(model, config, seed, candidateTeam, selected, namespace, offset) {
  let state = startRound(newGame(), cards(namespace, seed));
  const history = [];
  const seats = model
    ? modelSeats(candidateTeam, config.modelSeats, offset)
    : new Set();
  let moves = 0;
  while (!['roundEnd', 'matchEnd'].includes(state.phase)) {
    if (++moves > MAX_MOVES)
      throw Error('Final evaluation exceeded move bound');
    const seat = actionSeat(state);
    const before = state;
    const ownTeam = team(seat) === candidateTeam;
    const action =
      ownTeam && seats.has(seat)
        ? decide(model, state, seat, () => 0, 0, history).action
        : ownTeam
          ? baseline(state, seat)
          : heuristicAction(state, seat, config.opponent, selected);
    state = act(before, seat, action);
    pushHistory(history, before.phase, seat, action, before);
  }
  if (
    !Array.isArray(state.delta) ||
    state.delta.length !== 2 ||
    state.delta.some((value) => !Number.isFinite(value))
  )
    throw Error('Final evaluation ended without a valid terminal delta');
  return {
    candidateTeam,
    delta: state.delta,
    calls: state.calls,
    finish: state.finish,
    moves,
  };
}
function stats(results) {
  if (results.length < 2) return null;
  return pairedStatistics(
    results.map((result) => result.margins),
    { resamples: 5000 },
  );
}
async function saveAtomic(path, value) {
  await writeFile(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  await rename(`${path}.tmp`, path);
}

const dmc = await json(new URL('status.json', DMC_RUN));
const endurance = await json(new URL('../bots/endurance/status.json', ROOT));
const e0 = await json(new URL('../deep/run/status.json', ROOT));
if (
  dmc.status !== 'complete' ||
  endurance.status !== 'complete' ||
  e0.status !== 'complete' ||
  dmc.errors ||
  endurance.errors ||
  e0.errors
)
  throw Error(
    'DMC, endurance, and original E0 jobs must complete successfully first',
  );
if (
  !endurance.selected?.variant ||
  typeof endurance.selected.config !== 'object' ||
  Array.isArray(endurance.selected.config)
)
  throw Error('Endurance selected heuristic is missing or malformed');

const models = [];
for (const entry of dmc.models || []) {
  if (
    !Number.isSafeInteger(entry.seed) ||
    !entry.validationBest ||
    !Number.isFinite(entry.validationBest.mean)
  )
    throw Error('DMC model lacks validation-best metadata');
  const source = new URL(`model-${entry.seed}-validation-best.json`, DMC_RUN);
  const bytes = await readFile(source);
  const artifactHash = sha256(bytes);
  if (artifactHash !== entry.validationBest.artifactHash)
    throw Error(
      `Validation-best artifact hash mismatch for seed ${entry.seed}`,
    );
  models.push({
    seed: entry.seed,
    mean: entry.validationBest.mean,
    source,
    bytes,
    artifactHash,
  });
}
if (
  models.length !== 3 ||
  new Set(models.map((model) => model.seed)).size !== 3
)
  throw Error('Expected exactly three DMC validation-best models');
models.sort((a, b) => b.mean - a.mean || a.seed - b.seed);
const primary = models[0];
const selected = endurance.selected;

// This intentionally fails if the sealed directory already exists.
await mkdir(OUTPUT_PATH);
for (const model of models) {
  const frozenPath = resolve(OUTPUT_PATH, `frozen-model-${model.seed}.json`);
  await writeFile(frozenPath, model.bytes, { flag: 'wx', mode: 0o600 });
  if ((await fileHash(pathToFileURL(frozenPath))) !== model.artifactHash)
    throw Error(`Frozen artifact hash mismatch for seed ${model.seed}`);
}
const sources = {};
for (const path of [
  '../../src/game.js',
  './policy.mjs',
  './final-evaluate.mjs',
  '../bots/baseline.js',
  '../bots/candidate.js',
  '../bots/paired-statistics.mjs',
])
  sources[path] = await fileHash(new URL(path, import.meta.url));
const manifest = {
  schema: 1,
  modelSeeds: models.map((model) => model.seed),
  validationBestMeans: Object.fromEntries(
    models.map((model) => [model.seed, model.mean]),
  ),
  primarySeed: primary.seed,
  primarySelection: 'highest validationBest.mean; ties choose lower seed',
  primaryThreshold: { meanAtLeast: 10, lower95GreaterThan: 0 },
  secondaryConfigurations: SECONDARY_CASES,
  stageA: {
    namespace: 'dmc-final-v1',
    seedRange: [820000000, 820000999],
    pairs: PAIRS,
  },
  stageB: {
    namespace: 'dmc-final-secondary-v1',
    seedRange: [820000000, 820000999],
    pairs: PAIRS,
  },
  selectedHeuristic: selected,
  callingHeuristic: {
    variant: 'calls',
    config: { grandThreshold: 5.5, smallThreshold: 7 },
  },
  baselineId: 'baseline-v0.8.5',
  candidateId: 'candidate-structure-ledger',
  sources,
  artifactHashes: Object.fromEntries(
    models.map((model) => [model.seed, model.artifactHash]),
  ),
  limitations: [
    'Round-score margins, not full-match win rates',
    'No human play or teammate behavior validation',
  ],
};
await writeFile(
  resolve(OUTPUT_PATH, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { flag: 'wx', mode: 0o600 },
);
const progress = {
  status: 'running',
  pid: process.pid,
  primarySeed: primary.seed,
  stage: 'stage-a',
  completedPairs: 0,
  errors: 0,
};
const progressPath = resolve(OUTPUT_PATH, 'status.json');
await saveAtomic(progressPath, progress);
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});

async function evaluateModel(modelInfo) {
  const model = await loadModel(
    resolve(OUTPUT_PATH, `frozen-model-${modelInfo.seed}.json`),
  );
  try {
    const results = [];
    for (let offset = 0; offset < PAIRS; offset++) {
      if (stopping) break;
      const seed = FINAL_SEEDS[offset];
      const games = [0, 1].map((candidateTeam) =>
        play(
          model,
          { modelSeats: 3, opponent: 'baseline' },
          seed,
          candidateTeam,
          selected,
          'dmc-final-v1',
          offset,
        ),
      );
      const result = {
        seed,
        margins: games.map(
          (game) =>
            game.delta[game.candidateTeam] - game.delta[1 - game.candidateTeam],
        ),
        games,
      };
      results.push(result);
      await appendFile(
        resolve(OUTPUT_PATH, 'stage-a-results.jsonl'),
        `${JSON.stringify({ modelSeed: modelInfo.seed, ...result })}\n`,
        { mode: 0o600 },
      );
      progress.completedPairs++;
      if (progress.completedPairs % 10 === 0)
        await saveAtomic(progressPath, progress);
    }
    return { results, statistics: stats(results) };
  } finally {
    model.dispose();
  }
}

try {
  progress.stageA = {};
  for (const model of models) {
    const evaluation = await evaluateModel(model);
    progress.stageA[model.seed] = evaluation.statistics;
    await saveAtomic(progressPath, progress);
    if (stopping) break;
  }
  if (stopping) {
    progress.status = 'stopped';
  } else {
    const primaryStats = progress.stageA[primary.seed];
    progress.primaryPass =
      primaryStats.meanMargin >= 10 && primaryStats.meanMargin95[0] > 0;
    if (!progress.primaryPass) {
      progress.stage = 'stage-b-skipped';
      progress.note =
        'Primary failed the pre-registered threshold; no alternate model was promoted.';
    } else {
      progress.stage = 'stage-b';
      const model = await loadModel(
        resolve(OUTPUT_PATH, `frozen-model-${primary.seed}.json`),
      );
      try {
        progress.stageB = {};
        for (const config of SECONDARY_CASES) {
          const results = [];
          for (let offset = 0; offset < PAIRS; offset++) {
            if (stopping) break;
            const seed = FINAL_SEEDS[offset];
            const games = [0, 1].map((candidateTeam) =>
              play(
                model,
                config,
                seed,
                candidateTeam,
                selected,
                'dmc-final-secondary-v1',
                offset,
              ),
            );
            const result = {
              seed,
              margins: games.map(
                (game) =>
                  game.delta[game.candidateTeam] -
                  game.delta[1 - game.candidateTeam],
              ),
              games,
            };
            results.push(result);
            await appendFile(
              resolve(OUTPUT_PATH, `stage-b-${config.id}.jsonl`),
              `${JSON.stringify(result)}\n`,
              { mode: 0o600 },
            );
            progress.completedPairs++;
            if (progress.completedPairs % 10 === 0)
              await saveAtomic(progressPath, progress);
          }
          progress.stageB[config.id] = stats(results);
          await saveAtomic(progressPath, progress);
        }
      } finally {
        model.dispose();
      }
    }
  }
  progress.status = stopping ? 'stopped' : 'complete';
  if (progress.status === 'complete')
    await saveAtomic(resolve(OUTPUT_PATH, 'report.json'), {
      schema: 1,
      unit: 'team-score-margin-per-round',
      manifest,
      stageA: progress.stageA,
      stageB: progress.stageB || null,
      primaryPass: progress.primaryPass ?? null,
    });
  await saveAtomic(progressPath, progress);
} catch (error) {
  progress.status = 'failed';
  progress.errors++;
  progress.error = String(error);
  await saveAtomic(progressPath, progress);
  throw error;
}
