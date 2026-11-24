import test from 'node:test';
import assert from 'node:assert/strict';
import { beats, classify, deck, legalPlays } from '../src/game.js';
import {
  canonicalActionKey,
  enumerateLegalCardSubsets,
} from '../research/deep/actions.mjs';

const brute = (hand, top = null, wish = null) => {
  const result = [];
  for (let mask = 1; mask < 2 ** hand.length; mask++) {
    const cards = hand.filter((_, i) => mask & (1 << i));
    if (
      wish != null &&
      !cards.some((card) => !card.special && card.rank === wish)
    )
      continue;
    const ranks = cards.some((card) => card.special === 'phoenix')
      ? Array.from({ length: 13 }, (_, i) => i + 2)
      : [null];
    for (const phoenixRank of ranks) {
      const play = classify(cards, top, phoenixRank);
      if (play && beats(play, top)) result.push({ cards, play });
    }
  }
  return new Set(result.map(canonicalActionKey));
};

test('exhaustive oracle matches classify semantics on a small hand', () => {
  const cards = deck();
  const hand = [
    cards.find((c) => c.id === 'mahjong'),
    cards.find((c) => c.id === 'phoenix'),
    cards.find((c) => c.id === '0-0-4'),
    cards.find((c) => c.id === '0-0-5'),
    cards.find((c) => c.id === '0-0-6'),
    cards.find((c) => c.id === '0-1-4'),
    cards.find((c) => c.id === '0-1-5'),
    cards.find((c) => c.id === '0-1-6'),
  ];
  const actual = new Set(
    enumerateLegalCardSubsets({ hand }).map(canonicalActionKey),
  );
  assert.deepEqual(actual, brute(hand));
});

test('wish filtering is identical to legalPlays semantics', () => {
  const cards = deck();
  const hand = [
    cards.find((c) => c.id === '0-0-4'),
    cards.find((c) => c.id === '0-0-5'),
    cards.find((c) => c.id === '0-0-6'),
    cards.find((c) => c.id === '0-1-8'),
  ];
  const actual = new Set(
    enumerateLegalCardSubsets({ hand, wish: 8 }).map(canonicalActionKey),
  );
  const expected = new Set(legalPlays(hand, null, 8).map(canonicalActionKey));
  assert.deepEqual(actual, expected);
});

test('same-rank copy swaps collapse but suit-aware alternatives remain', () => {
  const cards = deck();
  const hand = [
    cards.find((c) => c.id === '0-0-4'),
    cards.find((c) => c.id === '0-1-4'),
    cards.find((c) => c.id === '0-0-5'),
    cards.find((c) => c.id === '0-0-6'),
    cards.find((c) => c.id === '0-0-7'),
    cards.find((c) => c.id === '0-0-8'),
  ];
  const oracle = enumerateLegalCardSubsets({ hand });
  const keys = new Set(oracle.map(canonicalActionKey));
  assert.equal(
    oracle.filter((candidate) => candidate.play.kind === 'single').length,
    6,
  );
  assert.ok(
    [...keys].some((key) => key.includes('4:1|5:0|6:0|7:0|8:0|straight')),
  );
  assert.ok([...keys].some((key) => key.includes('4:0|5:0|6:0|7:0|8:0|bomb')));
  assert.equal(keys.size, oracle.length);
});

test('oracle does not accept hidden opponent/state inputs', () => {
  const hand = [deck().find((c) => c.id === '0-0-4')];
  const result = enumerateLegalCardSubsets({ hand, top: null, wish: null });
  assert.equal(result.length, 1);
  assert.equal('state' in result[0], false);
  assert.equal('opponents' in result[0], false);
});
