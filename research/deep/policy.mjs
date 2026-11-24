import * as tf from '@tensorflow/tfjs';
import { legalPlays, partners, points, team } from '../../src/game.js';
import { botAction as baseline } from '../bots/baseline.js';

export const FEATURE_COUNT = 62;
const kinds = [
  'single',
  'pair',
  'triple',
  'fullhouse',
  'straight',
  'pairs',
  'bomb',
  'dog',
  'pass',
];
function histogram(hand) {
  return [
    ...Array.from(
      { length: 13 },
      (_, i) => hand.filter((c) => !c.special && c.rank === i + 2).length / 8,
    ),
    ...['mahjong', 'dog', 'phoenix', 'dragon'].map((name) =>
      Number(hand.some((c) => c.special === name)),
    ),
  ];
}
export function features(s, seat, option) {
  const used = new Set(option.cards.map((c) => c.id));
  const remaining = s.hands[seat].filter((c) => !used.has(c.id));
  return [
    ...histogram(s.hands[seat]),
    ...histogram(remaining),
    ...Array.from({ length: 6 }, (_, i) => s.hands[(seat + i) % 6].length / 18),
    ...kinds.map((k) => Number(k === option.play.kind)),
    option.play.power / 16,
    option.cards.length / 18,
    (option.play.bomb || 0) / 2,
    points(option.cards) / 50,
    (s.top?.power || 0) / 16,
    (s.top?.size || 0) / 18,
    (s.top?.bomb || 0) / 2,
    s.last == null ? 0 : team(s.last) === team(seat) ? 1 : -1,
    points(s.pile) / 200,
    (s.wish || 0) / 14,
    (s.calls[seat] || 0) / 200,
    remaining.length / 18,
    s.finish.length / 6,
  ];
}
export function optionsFor(s, seat) {
  const hand = s.hands[seat];
  const wished = s.wish ? legalPlays(hand, s.top, s.wish) : [];
  const options = wished.length ? wished : legalPlays(hand, s.top);
  if (s.top && !wished.length)
    options.push({
      cards: [],
      play: { kind: 'pass', power: 0, size: 0, bomb: 0 },
    });
  return options;
}
export function makeModel(seed = 401) {
  const model = tf.sequential();
  for (const [i, units] of [64, 64, 32, 1].entries())
    model.add(
      tf.layers.dense({
        units,
        activation: units === 1 ? 'linear' : 'tanh',
        kernelInitializer: tf.initializers.glorotUniform({ seed: seed + i }),
        ...(i === 0 ? { inputShape: [FEATURE_COUNT] } : {}),
      }),
    );
  return model;
}
export function decide(model, s, seat, rng, explore = true) {
  if (s.phase !== 'play') return { action: baseline(s, seat), sample: null };
  const options = optionsFor(s, seat);
  if (!options.length) throw Error('No legal actions');
  const rows = options.map((o) => features(s, seat, o));
  if (
    rows.some(
      (r) => r.length !== FEATURE_COUNT || r.some((x) => !Number.isFinite(x)),
    )
  )
    throw Error('Invalid observation');
  const logits = tf.tidy(() =>
    Array.from(model.predict(tf.tensor2d(rows)).dataSync()),
  );
  const max = Math.max(...logits),
    weights = logits.map((x) => Math.exp(x - max));
  const total = weights.reduce((a, b) => a + b, 0);
  let index = 0;
  if (explore) {
    let draw = rng() * total;
    for (let i = 0; i < weights.length; i++) {
      draw -= weights[i];
      if (draw <= 0) {
        index = i;
        break;
      }
    }
  } else index = logits.indexOf(max);
  const option = options[index];
  const target =
    partners(seat)
      .filter((i) => s.hands[i].length)
      .sort((a, b) => s.hands[a].length - s.hands[b].length)[0] ??
    partners(seat)[0];
  return {
    action:
      option.play.kind === 'pass'
        ? { type: 'pass' }
        : {
            type: 'play',
            ids: option.cards.map((c) => c.id),
            target,
            wish: 14,
          },
    sample: options.length > 1 ? { rows, index, team: team(seat) } : null,
  };
}
export async function saveModel(model, path) {
  const { writeFile, rename } = await import('node:fs/promises');
  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      const serial = {
        ...artifacts,
        weightData: Buffer.from(artifacts.weightData).toString('base64'),
      };
      await writeFile(path + '.tmp', JSON.stringify(serial));
      await rename(path + '.tmp', path);
      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: 'JSON',
        },
      };
    }),
  );
}
export async function loadModel(path) {
  const { readFile } = await import('node:fs/promises');
  const data = JSON.parse(await readFile(path, 'utf8'));
  const bytes = Buffer.from(data.weightData, 'base64');
  data.weightData = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  return tf.loadLayersModel(tf.io.fromMemory(data));
}
export function learn(model, optimizer, samples, delta, baselineReward = 0) {
  // On-policy REINFORCE: each legal-action softmax receives its team's final score margin.
  if (!samples.length) return 0;
  const loss = optimizer.minimize(
    () =>
      tf.tidy(() => {
        const terms = samples.map((sample) => {
          const reward =
            Math.max(
              -1,
              Math.min(1, (delta[sample.team] - delta[1 - sample.team]) / 300),
            ) - baselineReward;
          const logits = model
            .apply(tf.tensor2d(sample.rows), { training: true })
            .reshape([sample.rows.length]);
          const logp = tf.logSoftmax(logits);
          const chosen = logp.slice([sample.index], [1]).sum();
          const entropy = tf.softmax(logits).mul(logp).sum();
          return chosen.mul(-reward).add(entropy.mul(0.01));
        });
        return tf.stack(terms).mean();
      }),
    true,
  );
  const value = loss.dataSync()[0];
  loss.dispose();
  return value;
}
