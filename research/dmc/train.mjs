// Isolated Deep Monte-Carlo pilot. This is research code, not a game runtime.
import * as tf from '@tensorflow/tfjs';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { act, deck, newGame, startRound, team } from '../../src/game.js';
import { botAction as baseline } from '../bots/baseline.js';
import { decide, makeModel, saveModel, trainBatch } from './policy.mjs';

const MODEL_SEEDS = [101, 202, 303];
const VALIDATION_SEEDS = Array.from({ length: 32 }, (_, i) => 810000000 + i);
const SMOKE_SEEDS = Array.from({ length: 4 }, (_, i) => 910000000 + i);
const MAX_MOVES = 2000;
const SAMPLE_LIMIT = 32;
const EPSILON = 0.1;

const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const roundsArg = args.find((arg) => arg.startsWith('--rounds='));
const requestedRounds = roundsArg ? Number(roundsArg.slice(9)) : null;
if (
  requestedRounds !== null &&
  (!Number.isSafeInteger(requestedRounds) || requestedRounds < 1)
)
  throw Error('--rounds must be a positive integer');
const outputArg = args.find((arg) => arg.startsWith('--out='));
const outputDir = resolve(
  outputArg?.slice(6) ||
    (smoke ? 'research/dmc/smoke-run' : 'research/dmc/run'),
);
const statusPath = resolve(outputDir, 'status.json');
if (existsSync(statusPath))
  throw Error(`Existing DMC output status: ${statusPath}`);
mkdirSync(outputDir, { recursive: true });

const enduranceStatus = JSON.parse(
  readFileSync(
    new URL('../bots/endurance/status.json', import.meta.url),
    'utf8',
  ),
);
const deadline = Date.parse(enduranceStatus.deadline);
const stopAt = deadline - 15 * 60 * 1000;
if (!smoke && (!Number.isFinite(deadline) || Date.now() >= stopAt))
  throw Error('The endurance deadline leaves no DMC pilot window');

function uint32Stream(namespace, seed) {
  let counter = 0;
  return () =>
    createHash('sha256')
      .update(`${namespace}:${seed}:${counter++}`)
      .digest()
      .readUInt32LE(0);
}

function rng(namespace, seed) {
  const next = uint32Stream(namespace, seed);
  return () => next() / 4294967296;
}

function shuffledDeck(namespace, seed) {
  const result = deck();
  const next = uint32Stream(namespace, seed);
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
  // Deliberately omits exchange and all hidden card identities.
  if (action.type === 'exchange') return null;
  const entry = {
    phase,
    seat,
    type: action.type,
    count: Array.isArray(action.ids) ? action.ids.length : 0,
    target: action.type === 'collect' ? (action.target ?? null) : null,
  };
  if (action.type === 'play') {
    entry.cards = action.ids.map((id) => {
      const card = before.hands[seat].find((value) => value.id === id);
      if (!card) throw Error('Accepted play referenced a hidden card');
      return {
        rank: card.rank,
        suit: card.suit,
        ...(card.special ? { special: card.special } : {}),
      };
    });
  }
  return entry;
}

function reservoirPush(samples, sample, seen, random) {
  if (!sample) return seen;
  seen++;
  if (samples.length < SAMPLE_LIMIT) samples.push(sample);
  else {
    const index = Math.floor(random() * seen);
    if (index < SAMPLE_LIMIT) samples[index] = sample;
  }
  return seen;
}

function playRound(modelState, roundNumber, namespace) {
  const selfPlay = roundNumber % 2 === 0;
  const modelTeam = selfPlay ? null : roundNumber % 4 === 1 ? 0 : 1;
  const random = rng(`${namespace}:policy:${modelState.seed}`, roundNumber);
  let state = startRound(
    newGame(),
    shuffledDeck(
      `${namespace}:deck:${modelState.seed}`,
      400000000 + roundNumber,
    ),
  );
  const history = [];
  const samples = [];
  let seen = 0;
  let moves = 0;
  while (!['roundEnd', 'matchEnd'].includes(state.phase)) {
    if (++moves > MAX_MOVES) throw Error('DMC round exceeded move bound');
    const seat = actionSeat(state);
    const candidate = modelTeam === null || team(seat) === modelTeam;
    let action;
    let sample = null;
    if (candidate) {
      const result = decide(
        modelState.model,
        state,
        seat,
        random,
        EPSILON,
        history,
      );
      action = result.action;
      sample = result.sample;
    } else action = baseline(state, seat);
    const phase = state.phase;
    const before = state;
    state = act(before, seat, action);
    seen = reservoirPush(samples, sample, seen, random);
    const publicEvent = publicHistoryEntry(phase, seat, action, before);
    if (publicEvent) {
      history.push(publicEvent);
      if (history.length > 128) history.shift();
    }
  }
  if (
    !Array.isArray(state.delta) ||
    state.delta.length !== 2 ||
    state.delta.some((value) => !Number.isFinite(value))
  )
    throw Error('DMC round ended without a valid terminal delta');
  const delta = state.delta;
  const loss = trainBatch(
    modelState.model,
    modelState.optimizer,
    samples,
    delta,
  );
  modelState.rounds++;
  modelState.updates++;
  modelState.moves += moves;
  modelState.lastLoss = loss;
  modelState.lastDelta = delta;
  return { delta, moves, samples: samples.length, selfPlay };
}

function evaluate(modelState, seeds, namespace) {
  const margins = [];
  for (const seed of seeds) {
    const pair = [];
    for (const candidateTeam of [0, 1]) {
      let state = startRound(
        newGame(),
        shuffledDeck(`${namespace}:deck`, seed),
      );
      const history = [];
      let moves = 0;
      while (!['roundEnd', 'matchEnd'].includes(state.phase)) {
        if (++moves > MAX_MOVES)
          throw Error('DMC validation exceeded move bound');
        const seat = actionSeat(state);
        const action =
          team(seat) === candidateTeam
            ? decide(modelState.model, state, seat, () => 0, 0, history).action
            : baseline(state, seat);
        const phase = state.phase;
        const before = state;
        state = act(before, seat, action);
        const publicEvent = publicHistoryEntry(phase, seat, action, before);
        if (publicEvent) {
          history.push(publicEvent);
          if (history.length > 128) history.shift();
        }
      }
      if (
        !Array.isArray(state.delta) ||
        state.delta.length !== 2 ||
        state.delta.some((value) => !Number.isFinite(value))
      )
        throw Error('DMC validation ended without a valid terminal delta');
      pair.push(state.delta[candidateTeam] - state.delta[1 - candidateTeam]);
    }
    margins.push((pair[0] + pair[1]) / 2);
  }
  return margins.reduce((sum, value) => sum + value, 0) / margins.length;
}

function modelHash(model) {
  const hash = createHash('sha256');
  for (const weight of model.getWeights())
    hash.update(Buffer.from(weight.dataSync().buffer));
  return hash.digest('hex');
}

function artifactHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function atomicStatus(status) {
  writeFileSync(`${statusPath}.tmp`, `${JSON.stringify(status, null, 2)}\n`);
  renameSync(`${statusPath}.tmp`, statusPath);
}

async function checkpoint(modelState, best = false) {
  const suffix = best ? 'validation-best' : 'latest';
  await saveModel(
    modelState.model,
    resolve(outputDir, `model-${modelState.seed}-${suffix}.json`),
  );
  modelState.hash = modelHash(modelState.model);
  modelState.state.hash = modelState.hash;
  const path = resolve(outputDir, `model-${modelState.seed}-${suffix}.json`);
  modelState.state[best ? 'validationBestArtifactHash' : 'latestArtifactHash'] =
    artifactHash(path);
}

const status = {
  status: 'running',
  pid: process.pid,
  mode: smoke ? 'smoke' : 'pilot',
  namespace: smoke ? 'dmc-smoke-v1' : 'dmc-training-v1',
  startedAt: new Date().toISOString(),
  deadline: smoke ? null : new Date(stopAt).toISOString(),
  validationNamespace: smoke ? 'dmc-smoke-validation-v1' : 'dmc-validation-v1',
  validationSeeds: smoke ? SMOKE_SEEDS : VALIDATION_SEEDS,
  warmStart: false,
  exactResume: false,
  note: 'Optimizer state and exact RNG stream are not serialized; restart is forbidden for this output.',
  models: MODEL_SEEDS.map((seed) => ({
    seed,
    rounds: 0,
    updates: 0,
    moves: 0,
    validations: [],
  })),
  errors: 0,
};
atomicStatus(status);

const models = MODEL_SEEDS.map((seed, index) => ({
  seed,
  model: makeModel(seed),
  optimizer: tf.train.adam(0.0003),
  rounds: 0,
  updates: 0,
  moves: 0,
  validations: new Set(),
  bestMean: -Infinity,
  hash: null,
  state: status.models[index],
}));
let stopped = false;
process.on('SIGTERM', () => {
  stopped = true;
});
process.on('SIGINT', () => {
  stopped = true;
});

try {
  for (const modelState of models) {
    modelState.state.initialWeightHash = modelHash(modelState.model);
    await checkpoint(modelState);
  }
  atomicStatus(status);
  const targetRounds = smoke ? requestedRounds || 3 : Infinity;
  let cycle = 0;
  while (!stopped && cycle < targetRounds && (smoke || Date.now() < stopAt)) {
    for (const modelState of models) {
      if (stopped || (!smoke && Date.now() >= stopAt)) break;
      playRound(modelState, cycle, status.namespace);
      modelState.state.rounds = modelState.rounds;
      modelState.state.updates = modelState.updates;
      modelState.state.moves = modelState.moves;
      modelState.state.lastLoss = modelState.lastLoss;
      if (modelState.rounds === 1 || modelState.rounds % 500 === 0) {
        const mean = evaluate(
          modelState,
          status.validationSeeds,
          status.validationNamespace,
        );
        modelState.state.validations.push({
          round: modelState.rounds,
          mean,
          weightHash: modelHash(modelState.model),
        });
        modelState.validations.add(modelState.rounds);
        if (mean > modelState.bestMean) {
          modelState.bestMean = mean;
          await checkpoint(modelState, true);
          modelState.state.validationBest = {
            round: modelState.rounds,
            mean,
            artifactHash: modelState.state.validationBestArtifactHash,
          };
        }
      }
      if (modelState.rounds % 25 === 0) await checkpoint(modelState);
      atomicStatus(status);
    }
    cycle++;
  }
  if (!stopped) {
    for (const modelState of models) {
      const mean = evaluate(
        modelState,
        status.validationSeeds,
        status.validationNamespace,
      );
      modelState.state.validations.push({
        round: modelState.rounds,
        mean,
        final: true,
        weightHash: modelHash(modelState.model),
      });
      if (mean > modelState.bestMean) {
        modelState.bestMean = mean;
        await checkpoint(modelState, true);
        modelState.state.validationBest = {
          round: modelState.rounds,
          mean,
          artifactHash: modelState.state.validationBestArtifactHash,
        };
      }
      await checkpoint(modelState);
    }
  }
  status.status = stopped ? 'stopped' : 'complete';
  status.finishedAt = new Date().toISOString();
  atomicStatus(status);
} catch (error) {
  status.status = 'failed';
  status.errors++;
  status.error = String(error);
  atomicStatus(status);
  throw error;
} finally {
  for (const modelState of models) {
    modelState.optimizer.dispose();
    modelState.model.dispose();
  }
}
