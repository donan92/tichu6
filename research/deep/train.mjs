import * as tf from '@tensorflow/tfjs';
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  appendFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { deck, newGame, startRound, act, team } from '../../src/game.js';
import { botAction as baseline } from '../bots/baseline.js';
import { makeModel, decide, learn, saveModel } from './policy.mjs';

const end = Date.parse(
  JSON.parse(
    readFileSync(
      new URL('../bots/endurance/status.json', import.meta.url),
      'utf8',
    ),
  ).deadline,
);
if (!Number.isFinite(end) || end <= Date.now() || end - Date.now() > 7200000)
  throw Error('No active two-hour experiment deadline');
const directory = new URL('./run/', import.meta.url);
mkdirSync(directory, { recursive: true });
const statusPath = new URL('status.json', directory);
if (existsSync(statusPath))
  throw Error('Existing training run; inspect live handle before resuming');
await tf.setBackend('cpu');
await tf.ready();
const model = makeModel(),
  optimizer = tf.train.adam(0.0003);
const checksum = () =>
  createHash('sha256')
    .update(
      Buffer.concat(
        model.getWeights().map((w) => Buffer.from(w.dataSync().buffer)),
      ),
    )
    .digest('hex');
const status = {
  status: 'running',
  pid: process.pid,
  startedAt: new Date().toISOString(),
  deadline: new Date(end).toISOString(),
  phase: 'initial-evaluation',
  trainRounds: 0,
  evaluationRounds: 0,
  gradientUpdates: 0,
  moves: 0,
  initialHash: checksum(),
  initial: [],
  holdout: [],
  errors: 0,
};
let stopped = false;
process.on('SIGTERM', () => {
  stopped = true;
});
process.on('SIGINT', () => {
  stopped = true;
});
function persist() {
  writeFileSync(
    new URL('status.tmp', directory),
    JSON.stringify(status, null, 2) + '\n',
  );
  renameSync(new URL('status.tmp', directory), statusPath);
}
function random(seed) {
  let n = 0;
  return () =>
    createHash('sha256')
      .update(`deep-v1:${seed}:${n++}`)
      .digest()
      .readUInt32LE(0) / 4294967296;
}
function cards(seed) {
  const rng = random(seed),
    d = deck();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
function round(seed, modelTeam, training) {
  const rng = random(`${seed}-policy`);
  let s = startRound(newGame(), cards(seed)),
    moves = 0,
    seen = 0;
  const samples = [];
  while (!['roundEnd', 'matchEnd'].includes(s.phase)) {
    if (++moves > 2000) throw Error('Nonterminating round');
    const seat =
      s.phase === 'grand'
        ? s.ready.findIndex((x) => !x)
        : s.phase === 'exchange'
          ? s.exchanges.findIndex((x) => !x)
          : s.phase === 'trick'
            ? s.last
            : s.turn;
    let action;
    if (modelTeam === null || team(seat) === modelTeam) {
      const result = decide(model, s, seat, rng, training);
      action = result.action;
      if (training && result.sample) {
        seen++;
        if (samples.length < 32) samples.push(result.sample);
        else {
          const j = Math.floor(rng() * seen);
          if (j < 32) samples[j] = result.sample;
        }
      }
    } else action = baseline(s, seat);
    s = act(s, seat, action);
  }
  status.moves += moves;
  return { delta: s.delta, moves, samples };
}
function evaluate(seed, target) {
  const results = [];
  for (const t of [0, 1]) {
    const r = round(seed, t, false);
    results.push({
      team: t,
      margin: r.delta[t] - r.delta[1 - t],
      delta: r.delta,
    });
    status.evaluationRounds++;
  }
  target.push({
    seed,
    results,
    margin: (results[0].margin + results[1].margin) / 2,
  });
}
persist();
try {
  await saveModel(
    model,
    fileURLToPath(new URL('initial-model.json', directory)),
  );
  for (let i = 0; i < 5 && !stopped; i++) {
    evaluate(300000000 + i, status.initial);
    persist();
  }
  status.phase = 'training';
  persist();
  const trainingEnd = end - 15 * 60000;
  while (Date.now() < trainingEnd && !stopped) {
    const n = status.trainRounds,
      r = round(400000000 + n, n % 2 === 0 ? null : n % 4 === 1 ? 0 : 1, true);
    const before = performance.now();
    const loss = learn(model, optimizer, r.samples, r.delta);
    if (!Number.isFinite(loss)) throw Error('Nonfinite loss');
    status.trainRounds++;
    status.gradientUpdates++;
    status.lastLoss = loss;
    status.lastUpdateMs = performance.now() - before;
    if (status.trainRounds % 10 === 0) {
      status.currentHash = checksum();
      status.tensorCount = tf.memory().numTensors;
      await saveModel(
        model,
        fileURLToPath(new URL('latest-model.json', directory)),
      );
      appendFileSync(
        new URL('learning.jsonl', directory),
        JSON.stringify({
          round: status.trainRounds,
          loss,
          delta: r.delta,
          hash: status.currentHash,
          tensors: status.tensorCount,
        }) + '\n',
      );
      persist();
      console.log(
        JSON.stringify({
          trainRounds: status.trainRounds,
          loss,
          tensors: status.tensorCount,
        }),
      );
    }
  }
  status.currentHash = checksum();
  await saveModel(
    model,
    fileURLToPath(new URL('latest-model.json', directory)),
  );
  status.phase = 'holdout';
  persist();
  for (let i = 0; Date.now() < end && !stopped; i++) {
    evaluate(500000000 + i, status.holdout);
    persist();
  }
  status.status = stopped ? 'stopped' : 'complete';
  persist();
} catch (error) {
  status.status = 'failed';
  status.errors++;
  status.error = String(error);
  persist();
  throw error;
} finally {
  optimizer.dispose();
  model.dispose();
}
