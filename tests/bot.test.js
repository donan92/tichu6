import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deck,
  newGame,
  startRound,
  act,
  botAction,
  classify,
  partners,
} from '../src/game.js';
import { candidate } from '../research/bots/candidate.js';
const cards = deck();
const rank = (r, n = 1) =>
  cards.filter((c) => !c.special && c.rank === r).slice(0, n);
const special = (name) => cards.find((c) => c.special === name);
function state(hand, phase = 'play') {
  const s = startRound(newGame());
  s.phase = phase;
  s.hands[0] = hand;
  s.turn = 0;
  return s;
}
function top(s, cs, last = 1) {
  s.top = { ...classify(cs), cards: cs };
  s.pile = cs;
  s.last = last;
  return s;
}
const chosen = (s) => botAction(s, 0).ids;
test('exchange prefers singleton ranks and keeps rank bombs intact', () => {
  const s = state(
    [...rank(2, 4), ...rank(3, 2), ...rank(8), ...rank(11)],
    'exchange',
  );
  assert.deepEqual(
    chosen(s),
    [...rank(8), ...rank(11)].map((c) => c.id),
  );
});
test('caller in either partner position receives strongest non-bomb card', () => {
  for (const to of partners(0))
    for (const call of [100, 200]) {
      const s = state(
        [...rank(14, 4), special('phoenix'), special('dragon'), ...rank(2)],
        'exchange',
      );
      s.calls[to] = call;
      assert.equal(chosen(s)[partners(0).indexOf(to)], 'phoenix');
      assert.ok(chosen(s).every((id) => !rank(14, 4).some((c) => c.id === id)));
    }
});
test('support ordering is phoenix, ace, dragon, king, queen', () => {
  let hand = [
    special('phoenix'),
    ...rank(14),
    special('dragon'),
    ...rank(13),
    ...rank(12),
    ...rank(2),
    ...rank(3),
  ];
  for (const expected of [
    'phoenix',
    rank(14)[0].id,
    'dragon',
    rank(13)[0].id,
    rank(12)[0].id,
  ]) {
    const s = state(hand, 'exchange');
    s.calls[2] = 100;
    assert.equal(chosen(s)[0], expected);
    hand = hand.filter((c) => c.id !== expected);
  }
});
test('straight flush bomb cards are protected in exchange', () => {
  const bomb = [2, 3, 4, 5, 6].map((r) =>
    cards.find((c) => c.rank === r && c.suit === 0),
  );
  const s = state([...bomb, ...rank(9), ...rank(12)], 'exchange');
  assert.deepEqual(
    chosen(s),
    [...rank(9), ...rank(12)].map((c) => c.id),
  );
});
test('mahjong wishes for an ordinary card received from a partner; old states fall back', () => {
  const s = state([special('mahjong'), ...rank(8), ...rank(12)]);
  s.exchanges[2] = [rank(3)[0].id, rank(8)[0].id];
  assert.equal(botAction(s, 0).wish, 8);
  assert.deepEqual(chosen(s), ['mahjong']);
  delete s.exchanges;
  assert.equal(botAction(s, 0).wish, 14);
});
test('lead sheds low loose cards and keeps a short route through remaining combinations', () => {
  const s = state([...rank(2), ...rank(7, 2), ...rank(14, 2)]);
  assert.deepEqual(chosen(s), [rank(2)[0].id]);
  s.hands[0] = [...rank(14, 2), ...rank(13, 2), special('dragon')];
  assert.deepEqual(
    chosen(s),
    [...rank(13, 2), ...rank(14, 2)].map((c) => c.id),
  );
  for (const r of [11, 12]) {
    s.hands[0] = [...rank(r), ...rank(7, 2)];
    assert.deepEqual(
      chosen(s),
      rank(7, 2).map((c) => c.id),
    );
  }
});
test('low singles preserve control cards until an opponent is about to finish', () => {
  const s = state([...rank(5), ...rank(6), ...rank(14)]);
  assert.deepEqual(chosen(s), [rank(5)[0].id]);
  top(s, rank(10));
  s.hands[0] = [...rank(11), ...rank(14), ...rank(2)];
  assert.deepEqual(chosen(s), [rank(11)[0].id]);
  s.hands[1] = rank(2);
  assert.deepEqual(chosen(s), [rank(14)[0].id]);
});
test('bombs wait for an opposing valuable trick; partner leads are respected', () => {
  const s = state([...rank(7, 4), ...rank(3)]);
  assert.deepEqual(chosen(s), [rank(3)[0].id]);
  top(s, rank(14));
  assert.equal(botAction(s, 0).type, 'pass');
  s.pile.push(...rank(10));
  assert.deepEqual(
    chosen(s),
    rank(7, 4).map((c) => c.id),
  );
  s.last = 2;
  assert.equal(botAction(s, 0).type, 'pass');
});
test('mandatory wishes override preservation and finishing overrides teammate pass', () => {
  const s = state([...rank(7, 4), ...rank(3)]);
  top(s, rank(2), 2);
  s.wish = 7;
  const action = botAction(s, 0);
  assert.ok(action.ids.includes(rank(7)[0].id));
  assert.doesNotThrow(() => act(s, 0, action));
  s.wish = null;
  s.hands[0] = rank(14);
  assert.deepEqual(chosen(s), [rank(14)[0].id]);
});
test('decisions do not depend on other players private card identities', () => {
  const s = state([...rank(2), ...rank(8), ...rank(14)]);
  const before = botAction(s, 0);
  for (const i of [1, 2, 3, 4, 5])
    s.hands[i] = Array.from({ length: 18 }, () => special('dragon'));
  assert.deepEqual(botAction(s, 0), before);
});
test('complete bot rounds terminate with only legal actions', () => {
  for (let round = 0; round < 12; round++) {
    let s = startRound(newGame());
    for (let i = 0; i < 6; i++) s = act(s, i, botAction(s, i));
    for (let i = 0; i < 6; i++) s = act(s, i, botAction(s, i));
    let moves = 0;
    while (['play', 'trick'].includes(s.phase) && moves++ < 1500) {
      const seat = s.phase === 'trick' ? s.last : s.turn;
      s = act(s, seat, botAction(s, seat));
    }
    assert.equal(s.phase, 'roundEnd');
  }
});
test('production actions match the frozen evaluated gentle policy throughout a round', () => {
  let s = startRound(newGame(), deck());
  let moves = 0;
  while (!['roundEnd', 'matchEnd'].includes(s.phase) && moves++ < 1500) {
    const seat =
      s.phase === 'grand'
        ? s.ready.findIndex((ready) => !ready)
        : s.phase === 'exchange'
          ? s.exchanges.findIndex((exchange) => !exchange)
          : s.phase === 'trick'
            ? s.last
            : s.turn;
    const action = botAction(s, seat);
    assert.deepEqual(
      action,
      candidate(s, seat, 'structure', { structureWeight: 15 }),
    );
    s = act(s, seat, action);
  }
  assert.equal(s.phase, 'roundEnd');
});
test('two callers receive distinct best cards without breaking a bomb', () => {
  const s = state(
    [...rank(2, 4), special('phoenix'), ...rank(14), special('dragon')],
    'exchange',
  );
  s.calls[2] = 200;
  s.calls[4] = 100;
  assert.deepEqual(chosen(s), ['phoenix', rank(14)[0].id]);
});
test('mandatory exchange remains possible when every card belongs to a bomb', () => {
  const s = state(
    [
      ...rank(2, 4),
      ...rank(3, 4),
      ...rank(6, 4),
      ...rank(9, 4),
      ...rank(12, 2),
    ],
    'exchange',
  );
  // Only the pair is outside bombs; both of its cards must be used.
  assert.deepEqual(
    chosen(s),
    rank(12, 2).map((c) => c.id),
  );
  s.hands[0] = [...rank(2, 4), ...rank(3, 4), ...rank(6, 4), ...rank(9, 6)];
  const action = botAction(s, 0);
  assert.equal(new Set(action.ids).size, 2);
  assert.doesNotThrow(() => act(s, 0, action));
});
