import test from 'node:test';
import assert from 'node:assert/strict';
import * as tf from '@tensorflow/tfjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FEATURE_COUNT,
  makeModel,
  learn,
  saveModel,
  loadModel,
  features,
  optionsFor,
} from '../research/deep/policy.mjs';
import { newGame, startRound, deck, classify } from '../src/game.js';

test('policy gradient changes learned action preference and checkpoint preserves outputs', async () => {
  await tf.setBackend('cpu');
  const model = makeModel(901),
    optimizer = tf.train.adam(0.01);
  const a = Array(FEATURE_COUNT).fill(0),
    b = [...a];
  b[0] = 1;
  const scores = () =>
    tf.tidy(() => Array.from(model.predict(tf.tensor2d([a, b])).dataSync()));
  const before = scores();
  for (let i = 0; i < 10; i++)
    learn(model, optimizer, [{ rows: [a, b], index: 1, team: 0 }], [300, 0]);
  const after = scores();
  assert.ok(after[1] - after[0] > before[1] - before[0]);
  const folder = await mkdtemp(join(tmpdir(), 'tichu6-model-'));
  try {
    await saveModel(model, join(folder, 'model.json'));
    const restored = await loadModel(join(folder, 'model.json'));
    const values = tf.tidy(() =>
      Array.from(restored.predict(tf.tensor2d([a, b])).dataSync()),
    );
    assert.deepEqual(values, after);
    restored.dispose();
  } finally {
    model.dispose();
    optimizer.dispose();
    await rm(folder, { recursive: true, force: true });
  }
});

test('candidate action features ignore others private identities and enforce a playable wish', () => {
  const s = startRound(newGame(), deck());
  s.phase = 'play';
  s.turn = 0;
  s.hands[0] = deck()
    .filter((c) => c.suit === 0 && [6, 8, 14].includes(c.rank))
    .slice(0, 3);
  const low = deck().find((c) => c.rank === 2);
  s.top = { ...classify([low]), cards: [low] };
  s.last = 1;
  s.wish = 6;
  const options = optionsFor(s, 0);
  assert.ok(options.every((o) => o.cards.some((c) => c.rank === 6)));
  const before = features(s, 0, options[0]);
  assert.equal(before.length, FEATURE_COUNT);
  for (let i = 1; i < 6; i++)
    s.hands[i] = s.hands[i].map(() => ({
      id: 'private',
      rank: 16,
      suit: -1,
      special: 'dragon',
    }));
  assert.deepEqual(features(s, 0, options[0]), before);
});
