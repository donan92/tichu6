import test from 'node:test';
import assert from 'node:assert/strict';
import * as tf from '@tensorflow/tfjs';
import { deck, newGame, startRound } from '../src/game.js';
import {
  FEATURE_COUNT,
  decide,
  features,
  loadModel,
  makeModel,
  optionsFor,
  saveModel,
  trainBatch,
} from '../research/dmc/policy.mjs';

function state() {
  const value = startRound(newGame(), deck());
  value.phase = 'play';
  value.turn = 0;
  return value;
}

test('training one seed does not change another model or retain per-step tensors', () => {
  const model = makeModel(101),
    other = makeModel(202);
  const optimizer = tf.train.adam(0.0003);
  const before = other
    .getWeights()
    .map((weight) => Array.from(weight.dataSync()));
  const value = state();
  const sample = { row: features(value, 0, optionsFor(value, 0)[0]), team: 0 };
  try {
    trainBatch(model, optimizer, [sample], [300, 0]);
    const retained = tf.memory().numTensors;
    for (let step = 0; step < 5; step++)
      trainBatch(model, optimizer, [sample], [300, 0]);
    assert.equal(tf.memory().numTensors, retained);
    assert.deepEqual(
      other.getWeights().map((weight) => Array.from(weight.dataSync())),
      before,
    );
  } finally {
    optimizer.dispose();
    model.dispose();
    other.dispose();
  }
});

test('features ignore hidden card identities and preserve suit differences', () => {
  const value = state();
  const option = optionsFor(value, 0)[0];
  const before = features(value, 0, option, []);
  for (const seat of [1, 2, 3, 4, 5])
    value.hands[seat].forEach((card, index) => {
      card.id = `hidden-${seat}-${index}`;
      card.rank = 14 - (index % 13);
    });
  assert.deepEqual(features(value, 0, option, []), before);
  value.hands[0] = [
    { id: 's0', rank: 7, suit: 0 },
    { id: 's1', rank: 7, suit: 1 },
  ];
  const row = features(value, 0, optionsFor(value, 0)[0], []);
  assert.equal(row.length, FEATURE_COUNT);
  assert.notEqual(row[5], row[6]);
  assert.notEqual(row[18], row[19]);
});

test('grand features exclude the hidden reserve and options honor wishes/pass', () => {
  const value = startRound(newGame(), deck());
  value.phase = 'grand';
  const option = {
    cards: [],
    play: { kind: 'pass', power: 0, size: 0, bomb: 0 },
  };
  const row = features(value, 0, option, []);
  assert.equal(
    row.slice(0, 104).reduce((sum, item) => sum + item, 0) <= 10,
    true,
  );
  value.phase = 'play';
  value.top = { kind: 'single', power: 14, size: 1, bomb: 0, cards: [] };
  value.wish = null;
  assert.ok(optionsFor(value, 0).some((item) => item.play.kind === 'pass'));
});

test('history suit counts and last controller are represented', () => {
  const value = state();
  const option = optionsFor(value, 0)[0];
  const first = features(value, 0, option, [
    { type: 'play', seat: 1, cards: [{ rank: 7, suit: 0 }] },
  ]);
  const second = features(value, 0, option, [
    { type: 'play', seat: 1, cards: [{ rank: 7, suit: 1 }] },
  ]);
  assert.notDeepEqual(first, second);
  value.last = 1;
  const teammateController = features(value, 0, option, []);
  value.last = 2;
  const opponentController = features(value, 0, option, []);
  assert.notDeepEqual(teammateController, opponentController);
});

test('decision returns phoenixRank and samples only legal candidates', () => {
  const value = state();
  value.hands[0] = [
    { id: 'phoenix', rank: 15, suit: -1, special: 'phoenix' },
    { id: 'two', rank: 2, suit: 0 },
  ];
  const model = makeModel(19);
  const result = decide(model, value, 0, () => 0.9, 0, []);
  assert.equal(result.action.type, 'play');
  assert.ok('phoenixRank' in result.action);
  assert.ok(
    result.sample === null || result.sample.row.length === FEATURE_COUNT,
  );
  model.dispose();
});

test('gradient training moves Q toward the un-clipped signed team target', () => {
  const model = makeModel(23);
  const optimizer = tf.train.sgd(0.2);
  const row = Array(FEATURE_COUNT).fill(0);
  const sample = { row, team: 0 };
  const before = model.predict(tf.tensor2d([row])).dataSync()[0];
  for (let i = 0; i < 8; i++) trainBatch(model, optimizer, [sample], [500, 0]);
  const after = model.predict(tf.tensor2d([row])).dataSync()[0];
  assert.ok(after > before);
  model.dispose();
  optimizer.dispose();
});

test('non-finite rows, outputs, and missing targets fail fast', () => {
  const value = state();
  const option = optionsFor(value, 0)[0];
  value.scores[0] = Number.NaN;
  assert.throws(
    () => features(value, 0, option, []),
    /Invalid DMC feature row/,
  );
  const model = makeModel(29);
  const badModel = { predict: () => tf.tensor([Number.NaN]) };
  value.scores[0] = 0;
  assert.throws(
    () => decide(badModel, value, 0, () => 0.9, 0, []),
    /Invalid DMC model output/,
  );
  assert.throws(
    () =>
      trainBatch(
        model,
        tf.train.sgd(0.1),
        [{ row: Array(FEATURE_COUNT).fill(0), team: 0 }],
        [100],
      ),
    /Invalid DMC training sample/,
  );
  model.dispose();
});

test('checkpoint round trip preserves predictions', async () => {
  const model = makeModel(31);
  const row = Array(FEATURE_COUNT).fill(0.25);
  const before = Array.from(model.predict(tf.tensor2d([row])).dataSync());
  const path = `/tmp/tichu6-dmc-${process.pid}.json`;
  await saveModel(model, path);
  const restored = await loadModel(path);
  const after = Array.from(restored.predict(tf.tensor2d([row])).dataSync());
  assert.deepEqual(after, before);
  model.dispose();
  restored.dispose();
});
