import test from 'node:test';
import assert from 'node:assert/strict';
import { deck, newGame, startRound } from '../src/game.js';
import { observe } from '../research/deep/observation.mjs';

function fixture() {
  return startRound(newGame(), deck());
}

test('grand observation exposes only the visible ten cards', () => {
  const state = fixture();
  const observation = observe(state, 0, []);
  assert.equal(
    observation.hand.rankCounts.reduce((a, b) => a + b, 0) +
      Object.values(observation.hand.specialCounts).reduce((a, b) => a + b, 0),
    10,
  );
  state.hands[0].slice(10).forEach((card) => {
    assert.equal(
      JSON.stringify(observation).includes(card.id),
      false,
      'hidden reserve card id leaked',
    );
  });
});

test('hidden opponent and teammate card mutations do not affect observation', () => {
  const state = fixture();
  state.phase = 'play';
  const before = observe(state, 0, []);
  for (const seat of [1, 2, 3, 4, 5]) {
    state.hands[seat].forEach((card, index) => {
      card.id = `secret-${seat}-${index}`;
      card.rank = 14 - (index % 13);
      card.suit = (index + 1) % 4;
    });
  }
  assert.deepEqual(observe(state, 0, []), before);
});

test('same ranks with different suits remain distinguishable without copy IDs', () => {
  const state = fixture();
  state.phase = 'play';
  state.hands[0] = [
    { id: 'a', rank: 7, suit: 0 },
    { id: 'b', rank: 7, suit: 1 },
  ];
  const observation = observe(state, 0, []);
  assert.equal(observation.hand.rankCounts[5], 2);
  assert.equal(observation.hand.suitRankCounts[0][5], 1);
  assert.equal(observation.hand.suitRankCounts[1][5], 1);
  assert.equal('id' in observation.hand, false);
  assert.equal(JSON.stringify(observation).includes('"a"'), false);
  assert.equal(JSON.stringify(observation).includes('"b"'), false);
});

test('allowlists public history, top, pile, and own exchange evidence', () => {
  const state = fixture();
  state.phase = 'play';
  state.exchanges[0] = [state.hands[0][0].id, state.hands[0][1].id];
  state.exchanges[2] = [state.hands[2][0].id, state.hands[2][1].id];
  state.hands[0].push(state.hands[2][1]);
  state.top = {
    kind: 'single',
    power: 7,
    size: 1,
    bomb: 0,
    cards: [state.hands[1][0]],
    unknown: 'no',
  };
  state.pile = [state.hands[1][1]];
  const observation = observe(state, 0, [
    {
      type: 'play',
      seat: 1,
      count: 1,
      kind: 'secret-kind',
      cards: [{ id: 'public-id', rank: 7, suit: 2, secret: 'no' }],
      name: 'secret',
      token: 'secret',
    },
    { type: 'exchange', cards: [{ rank: 2, suit: 0, secret: 'no' }] },
  ]);
  assert.deepEqual(observation.exchange.sent[0], {
    rank: state.hands[0][0].rank,
    suit: state.hands[0][0].suit,
  });
  assert.equal(observation.exchange.received.length, 1);
  assert.equal('unknown' in observation.public.top, false);
  assert.equal('name' in observation.public.moves[0], false);
  assert.equal('kind' in observation.public.moves[0], false);
  assert.equal(observation.public.moves[0].cards[0].rank, 7);
  assert.equal('id' in observation.public.moves[0].cards[0], false);
  assert.equal(observation.public.moves.length, 1);
  assert.equal(JSON.stringify(observation).includes('secret'), false);
  assert.equal(
    JSON.stringify(observation).includes(state.hands[2][0].id),
    false,
  );
});

test('history keeps only public action types and caps to the latest 128 moves', () => {
  const state = fixture();
  state.phase = 'play';
  const history = Array.from({ length: 140 }, (_, index) => ({
    type: index % 2 ? 'pass' : 'exchange',
    seat: index % 6,
    hidden: 'not-public',
  }));
  const observation = observe(state, 0, history);
  assert.equal(observation.public.moves.length, 70);
  assert.equal(observation.public.movesTruncated, false);
  const publicHistory = Array.from({ length: 140 }, (_, index) => ({
    type: 'pass',
    seat: index % 6,
  }));
  const capped = observe(state, 0, publicHistory);
  assert.equal(capped.public.moves.length, 128);
  assert.equal(capped.public.movesTruncated, true);
  assert.equal(capped.public.moves[0].seat, 12 % 6);
  assert.equal(JSON.stringify(capped).includes('hidden'), false);
});

test('grand and lobby observations never expose stale exchange evidence', () => {
  const state = fixture();
  state.exchanges[0] = [state.hands[0][0].id, state.hands[0][1].id];
  assert.deepEqual(observe(state, 0).exchange, { sent: [], received: [] });
  state.phase = 'lobby';
  assert.deepEqual(observe(state, 0).exchange, { sent: [], received: [] });
});

test('observation is deeply frozen and does not share mutable references', () => {
  const state = fixture();
  state.phase = 'play';
  const observation = observe(state, 0, []);
  assert.equal(Object.isFrozen(observation), true);
  assert.equal(Object.isFrozen(observation.hand.suitRankCounts[0]), true);
  assert.equal(Object.isFrozen(observation.public), true);
  assert.notEqual(
    observation.public.counts,
    state.hands.map((hand) => hand.length),
  );
  assert.throws(() => observation.public.counts.push(99), TypeError);
});
