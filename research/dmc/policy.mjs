import * as tf from '@tensorflow/tfjs';
import { legalPlays, partners, points, team } from '../../src/game.js';
import { botAction as baseline } from '../bots/baseline.js';

// E1 pilot only: candidate generation still uses the engine's representative
// legalPlays set and is not a claim of exhaustive action enumeration.
const RANKS = 13;
const SUITS = 4;
const SPECIALS = ['mahjong', 'dog', 'phoenix', 'dragon'];
const KINDS = [
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
export const FEATURE_COUNT =
  SUITS * RANKS * 2 +
  SPECIALS.length +
  6 +
  6 +
  1 +
  3 +
  1 +
  1 +
  (SUITS * RANKS + SPECIALS.length + 6) +
  6 +
  1 +
  1 +
  6 +
  6 +
  KINDS.length +
  4;

function cardMatrix(hand) {
  return Array.from({ length: SUITS }, (_, suit) =>
    Array.from(
      { length: RANKS },
      (_, index) =>
        hand.filter(
          (card) =>
            !card.special && card.suit === suit && card.rank === index + 2,
        ).length / 2,
    ),
  ).flat();
}

function specialFeatures(hand, remaining) {
  return SPECIALS.map(
    (name) =>
      Number(hand.some((card) => card.special === name)) +
      Number(remaining.some((card) => card.special === name)) * 0.5,
  );
}

function relativeSeats(s, seat) {
  return Array.from({ length: 6 }, (_, offset) => (seat + offset) % 6);
}

function historyFeatures(history, seat) {
  const played = Array(52 + SPECIALS.length).fill(0);
  const passes = Array(6).fill(0);
  for (const entry of (Array.isArray(history) ? history : []).slice(-128)) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.type === 'pass' && Number.isInteger(entry.seat))
      passes[(entry.seat - seat + 6) % 6]++;
    if (entry.type !== 'play' || !Array.isArray(entry.cards)) continue;
    for (const card of entry.cards) {
      if (SPECIALS.includes(card?.special)) {
        played[52 + SPECIALS.indexOf(card.special)]++;
      } else if (
        Number.isInteger(card?.suit) &&
        card.suit >= 0 &&
        card.suit < SUITS &&
        Number.isInteger(card?.rank) &&
        card.rank >= 2 &&
        card.rank <= 14
      ) {
        played[card.suit * RANKS + card.rank - 2]++;
      }
    }
  }
  return [
    ...played.map((count, index) =>
      index < 52 ? Math.min(count, 2) / 2 : Math.min(count, 1),
    ),
    ...passes.map((count) => count / 128),
  ];
}

function topFeatures(top) {
  return [(top?.power ?? 0) / 16, (top?.size ?? 0) / 18, (top?.bomb ?? 0) / 2];
}

function actionFeatures(option) {
  return [
    ...KINDS.map((kind) => Number(kind === option.play.kind)),
    (option.play.power ?? 0) / 16,
    (option.play.size ?? 0) / 18,
    (option.play.bomb ?? 0) / 2,
    (option.play.phoenixRank ?? 0) / 14,
  ];
}

/** Build a fixed, seat-relative state/action row from visible information. */
export function features(s, seat, option, history = []) {
  const allHand = s.hands[seat] || [];
  const hand =
    s.phase === 'grand'
      ? allHand.filter((card) => s.first?.[seat]?.includes(card.id))
      : allHand;
  const used = new Set(option.cards.map((card) => card.id));
  const remaining = hand.filter((card) => !used.has(card.id));
  const seats = relativeSeats(s, seat);
  const relativeTurn =
    s.turn == null
      ? 0
      : 1 - (seats.indexOf(s.turn) < 0 ? 0 : seats.indexOf(s.turn)) / 5;
  const scoreDiff =
    ((s.scores?.[team(seat)] ?? 0) - (s.scores?.[1 - team(seat)] ?? 0)) / 1000;
  const lastFeatures = relativeSeats(s, seat).map((index) =>
    Number(s.last === index),
  );
  const finish = relativeSeats(s, seat).map((index) => {
    const place = s.finish?.indexOf(index) ?? -1;
    return place < 0 ? 0 : 1 / (place + 1);
  });
  const passed = relativeSeats(s, seat).map((index) =>
    Number(s.passed?.includes(index)),
  );
  const row = [
    ...cardMatrix(hand),
    ...cardMatrix(remaining),
    ...specialFeatures(hand, remaining),
    ...seats.map((index) => (s.hands[index]?.length || 0) / 18),
    ...seats.map((index) => (s.calls?.[index] ?? 0) / 200),
    relativeTurn,
    ...topFeatures(s.top),
    (s.wish ?? 0) / 14,
    scoreDiff,
    ...historyFeatures(history, seat),
    ...lastFeatures,
    s.last == null ? 0 : team(s.last) === team(seat) ? 1 : -1,
    points(s.pile || []) / 200,
    ...finish,
    ...passed,
    ...actionFeatures(option),
  ];
  if (
    row.length !== FEATURE_COUNT ||
    row.some((value) => !Number.isFinite(value))
  )
    throw Error('Invalid DMC feature row');
  return row;
}

/** Candidate set from legalPlays; it is intentionally not exhaustive. */
export function optionsFor(s, seat) {
  const hand = s.hands[seat] || [];
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
  for (const [index, units] of [128, 128, 64, 1].entries())
    model.add(
      tf.layers.dense({
        units,
        activation: units === 1 ? 'linear' : 'tanh',
        kernelInitializer: tf.initializers.glorotUniform({
          seed: seed + index,
        }),
        ...(index === 0 ? { inputShape: [FEATURE_COUNT] } : {}),
      }),
    );
  return model;
}

function actionForOption(s, seat, option) {
  if (option.play.kind === 'pass') return { type: 'pass' };
  const target =
    partners(seat)
      .filter((index) => s.hands[index]?.length)
      .sort((a, b) => s.hands[a].length - s.hands[b].length)[0] ??
    partners(seat)[0];
  return {
    type: 'play',
    ids: option.cards.map((card) => card.id),
    target,
    wish: option.cards.some((card) => card.special === 'mahjong') ? 14 : null,
    phoenixRank: option.play.phoenixRank ?? null,
  };
}

export function decide(model, s, seat, rng, epsilon = 0.1, history = []) {
  if (s.phase !== 'play') return { action: baseline(s, seat), sample: null };
  const options = optionsFor(s, seat);
  if (!options.length) return { action: baseline(s, seat), sample: null };
  const rows = options.map((option) => features(s, seat, option, history));
  if (
    rows.some(
      (row) =>
        row.length !== FEATURE_COUNT ||
        row.some((value) => !Number.isFinite(value)),
    )
  )
    throw Error('Invalid DMC feature row');
  const values = tf.tidy(() =>
    Array.from(model.predict(tf.tensor2d(rows)).dataSync()),
  );
  if (values.some((value) => !Number.isFinite(value)))
    throw Error('Invalid DMC model output');
  let index = values.indexOf(Math.max(...values));
  if (rng() < epsilon) index = Math.floor(rng() * options.length);
  return {
    action: actionForOption(s, seat, options[index]),
    sample: options.length > 1 ? { row: rows[index], team: team(seat) } : null,
  };
}

export function trainBatch(model, optimizer, samples, delta) {
  if (!samples.length) return 0;
  if (
    !Array.isArray(delta) ||
    delta.length !== 2 ||
    delta.some((value) => !Number.isFinite(value)) ||
    samples.some(
      (sample) =>
        !sample ||
        (sample.team !== 0 && sample.team !== 1) ||
        !Array.isArray(sample.row) ||
        sample.row.length !== FEATURE_COUNT ||
        sample.row.some((value) => !Number.isFinite(value)),
    )
  )
    throw TypeError('Invalid DMC training sample');
  const loss = optimizer.minimize(
    () =>
      tf.tidy(() => {
        const rows = tf.tensor2d(samples.map((sample) => sample.row));
        const targets = tf.tensor1d(
          samples.map(
            (sample) => (delta[sample.team] - delta[1 - sample.team]) / 1000,
          ),
        );
        const predictions = model.apply(rows, { training: true }).reshape([-1]);
        return predictions.sub(targets).square().mean();
      }),
    true,
  );
  const value = loss.dataSync()[0];
  loss.dispose();
  return value;
}

// These utilities are pure checkpoint I/O and have no training side effects.
export { saveModel, loadModel } from '../deep/policy.mjs';
