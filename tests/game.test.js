import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deck,
  points,
  newGame,
  startRound,
  act,
  view,
  classify,
  beats,
  legalPlays,
  botAction,
} from '../src/game.js';
const all = deck(),
  pick = (rank, n = 1) =>
    all.filter((c) => !c.special && c.rank === rank).slice(0, n),
  special = (name) => all.find((c) => c.special === name);
const mixed = (ranks) =>
  ranks.map((rank, i) => all.find((c) => c.rank === rank && c.suit === i % 4));
function playing(hands, turn = 0) {
  const s = startRound(newGame());
  s.phase = 'play';
  s.hands = hands;
  s.turn = turn;
  return s;
}
test('108 distinct cards, eight of each ordinary rank, four unique specials, 200 points', () => {
  assert.equal(all.length, 108);
  assert.equal(new Set(all.map((c) => c.id)).size, 108);
  for (let r = 2; r <= 14; r++)
    assert.equal(all.filter((c) => c.rank === r && !c.special).length, 8);
  assert.equal(all.filter((c) => c.special).length, 4);
  assert.equal(points(all), 200);
});
test('18 cards dealt each; only ten are exposed until all grand decisions finish', () => {
  let s = startRound(newGame());
  assert.ok(s.hands.every((h) => h.length === 18));
  for (let i = 0; i < 6; i++) {
    const v = view(s, i);
    assert.equal(v.hand.length, 10);
    for (const key of ['hands', 'first', 'exchanges', 'captured'])
      assert.equal(key in v, false);
  }
  for (let i = 0; i < 6; i++) s = act(s, i, { type: 'grand', call: i === 0 });
  assert.equal(s.phase, 'exchange');
  assert.equal(s.calls[0], 200);
  assert.equal(view(s, 0).hand.length, 18);
});
test('exchange is simultaneous, two cards go to the correct partners', () => {
  let s = startRound(newGame());
  for (let i = 0; i < 6; i++) s = act(s, i, { type: 'grand', call: false });
  const before = structuredClone(s.hands),
    ids = before.map((h) => h.slice(0, 2).map((c) => c.id));
  for (let i = 0; i < 5; i++) s = act(s, i, { type: 'exchange', ids: ids[i] });
  assert.deepEqual(s.hands, before);
  assert.deepEqual(view(s, 0).exchangeReady, [
    true,
    true,
    true,
    true,
    true,
    false,
  ]);
  assert.equal(JSON.stringify(view(s, 5)).includes('exchanges'), false);
  s = act(s, 5, { type: 'exchange', ids: ids[5] });
  assert.equal(s.phase, 'play');
  for (let i = 0; i < 6; i++) {
    assert.equal(s.hands[i].length, 18);
    assert.ok(s.hands[(i + 2) % 6].some((c) => c.id === ids[i][0]));
    assert.ok(s.hands[(i + 4) % 6].some((c) => c.id === ids[i][1]));
  }
  assert.equal(new Set(s.hands.flat().map((c) => c.id)).size, 108);
  assert.ok(s.hands[s.turn].some((c) => c.special === 'mahjong'));
});
test('normal combinations and equal-size comparison', () => {
  assert.equal(classify(pick(5, 2)).kind, 'pair');
  assert.equal(classify(pick(8, 3)).kind, 'triple');
  assert.equal(classify([...pick(5, 3), ...pick(9, 2)]).power, 5);
  assert.equal(classify([...pick(5, 2), ...pick(6, 2)]).kind, 'pairs');
  assert.equal(classify(mixed([3, 4, 5, 6, 7])).kind, 'straight');
  assert.equal(classify(mixed([3, 4, 5, 6])), null);
  assert.equal(beats(classify(pick(7, 3)), classify(pick(6, 2))), false);
  assert.equal(classify([...pick(3, 2), ...pick(5, 2)]), null);
});
test('exactly four identical ranks, including duplicate suits, form bombs', () => {
  assert.equal(classify(pick(9, 4)).kind, 'bomb');
  assert.equal(classify(pick(9, 5)), null);
  assert.equal(classify(pick(9, 8)), null);
  const copies = all.filter(
    (c) => c.rank === 7 && (c.suit === 0 || c.suit === 1),
  );
  assert.equal(classify(copies).kind, 'bomb');
  assert.equal(beats(classify(pick(9, 4)), classify(pick(9, 4))), false);
  assert.equal(beats(classify(pick(10, 4)), classify(pick(9, 4))), true);
});
test('straight bomb beats four-of-a-kind and compares length before rank', () => {
  const flush = (lo, n) =>
    all.filter(
      (c) => c.id.startsWith('0-0-') && c.rank >= lo && c.rank < lo + n,
    );
  assert.ok(beats(classify(flush(2, 5)), classify(pick(14, 4))));
  assert.ok(beats(classify(flush(2, 6)), classify(flush(9, 5))));
  assert.equal(beats(classify(flush(2, 5)), classify(flush(2, 5))), false);
});
test('phoenix: 1.5 lead, half step response, no dragon win or bomb substitution', () => {
  const p = special('phoenix');
  assert.equal(classify([p]).power, 1.5);
  assert.equal(classify([p], classify(pick(14))).power, 14.5);
  assert.equal(
    beats(
      classify([p], classify([special('dragon')])),
      classify([special('dragon')]),
    ),
    false,
  );
  assert.equal(classify([...pick(7, 3), p]), null);
  assert.equal(classify([...pick(7, 2), p]).kind, 'triple');
  assert.equal(classify([...mixed([2, 3, 4, 5]), p]).bomb, 0);
  assert.equal(
    classify([special('mahjong'), ...mixed([2, 3, 4]), p]).kind,
    'straight',
  );
});
test('phoenix can be explicitly assigned in an ambiguous full house', () => {
  const cards = [...pick(7, 2), ...pick(9, 2), special('phoenix')];
  assert.equal(classify(cards, null, 7).power, 7);
  assert.equal(classify(cards, null, 9).power, 9);
  assert.equal(classify(cards, null, 14), null);
});
test('dragon and dog cannot join combinations; mahjong cannot make pairs', () => {
  assert.equal(classify([...pick(4), special('dragon')]), null);
  assert.equal(classify([...pick(4), special('dog')]), null);
  assert.equal(classify([special('mahjong'), special('phoenix')]), null);
  assert.equal(classify([special('dog')], classify(pick(4))), null);
});
test('failed card ownership, duplicate IDs, out-of-turn and invalid wishes are atomic', () => {
  const s = playing([pick(4, 2), pick(5), pick(6), pick(7), pick(8), pick(9)]),
    copy = structuredClone(s);
  assert.throws(() => act(s, 0, { type: 'play', ids: [pick(5)[0].id] }));
  assert.throws(() =>
    act(s, 0, { type: 'play', ids: [pick(4)[0].id, pick(4)[0].id] }),
  );
  assert.throws(() => act(s, 1, { type: 'play', ids: [pick(5)[0].id] }));
  assert.deepEqual(s, copy);
  const m = playing([
    [special('mahjong'), ...pick(4)],
    pick(5),
    pick(6),
    pick(7),
    pick(8),
    pick(9),
  ]);
  assert.throws(() => act(m, 0, { type: 'play', ids: ['mahjong'], wish: 99 }));
  assert.equal(m.hands[0].length, 2);
});
test('wish is mandatory on own turn including phoenix combinations', () => {
  let s = playing([
    pick(3, 2),
    [...pick(8), special('phoenix'), ...pick(10)],
    pick(6),
    pick(7),
    pick(11),
    pick(9),
  ]);
  s = act(s, 0, { type: 'play', ids: pick(3, 2).map((c) => c.id) });
  s.wish = 8;
  assert.throws(() => act(s, 1, { type: 'pass' }));
  assert.throws(() =>
    act(s, 1, {
      type: 'play',
      ids: [...pick(10), special('phoenix')].map((c) => c.id),
    }),
  );
  s = act(s, 1, {
    type: 'play',
    ids: [...pick(8), special('phoenix')].map((c) => c.id),
  });
  assert.equal(s.wish, null);
});
test('wish recognises 1-low phoenix straight and available bombs', () => {
  const hand = [special('mahjong'), ...mixed([2, 3, 4]), special('phoenix')];
  assert.ok(legalPlays(hand, null, 3).length);
  assert.ok(legalPlays(pick(8, 4), classify([special('dragon')]), 8).length);
  assert.equal(legalPlays([special('phoenix')], null, 8).length, 0);
});
test('out-of-turn bombs are allowed without fulfilling the current wish', () => {
  let s = playing([
    [...pick(3), ...pick(4)],
    pick(5),
    [...pick(8, 4), ...pick(9)],
    pick(7),
    pick(11),
    pick(12),
  ]);
  s = act(s, 0, { type: 'play', ids: [pick(3)[0].id] });
  s.wish = 9;
  s = act(s, 2, { type: 'play', ids: pick(8, 4).map((c) => c.id) });
  assert.equal(s.last, 2);
  assert.equal(s.wish, 9);
  assert.equal(s.turn, 3);
});
test('dog transfers the lead to a chosen partner; no bombing on an empty table', () => {
  let s = playing([
    [special('dog'), ...pick(3)],
    pick(5),
    pick(6),
    pick(7),
    pick(8, 4),
    pick(9),
  ]);
  assert.throws(() => act(s, 0, { type: 'play', ids: ['dog'], target: 1 }));
  s = act(s, 0, { type: 'play', ids: ['dog'], target: 2 });
  assert.equal(s.turn, 2);
  assert.equal(s.top, null);
  assert.throws(() =>
    act(s, 4, { type: 'play', ids: pick(8, 4).map((c) => c.id) }),
  );
});
test('passing all opponents opens explicit collect window; bomb can interrupt it', () => {
  let s = playing([
    [...pick(3), ...pick(4)],
    pick(5),
    pick(6),
    pick(7),
    pick(8, 4),
    pick(9),
  ]);
  s = act(s, 0, { type: 'play', ids: [pick(3)[0].id] });
  for (let i = 1; i < 6; i++) s = act(s, i, { type: 'pass' });
  assert.equal(s.phase, 'trick');
  assert.throws(() => act(s, 1, { type: 'collect' }));
  s = act(s, 4, { type: 'play', ids: pick(8, 4).map((c) => c.id) });
  assert.equal(s.phase, 'play');
  assert.equal(s.last, 4);
});
test('finished trick winner passes next lead to next active player', () => {
  let s = playing([pick(3), pick(5), pick(6), pick(7), pick(8), pick(9)]);
  s = act(s, 0, { type: 'play', ids: [pick(3)[0].id] });
  for (let i = 1; i < 6; i++) s = act(s, i, { type: 'pass' });
  s = act(s, 0, { type: 'collect' });
  assert.equal(s.turn, 1);
  assert.equal(s.top, null);
});
test('dragon trick must be given to an opponent; winner keeps the next lead', () => {
  let s = playing([
    [special('dragon'), ...pick(3)],
    pick(5),
    pick(6),
    pick(7),
    pick(8),
    pick(9),
  ]);
  s = act(s, 0, { type: 'play', ids: ['dragon'] });
  for (let i = 1; i < 6; i++) s = act(s, i, { type: 'pass' });
  assert.throws(() => act(s, 0, { type: 'collect', target: 2 }));
  s = act(s, 0, { type: 'collect', target: 3 });
  assert.equal(points(s.captured[3]), 25);
  assert.equal(s.turn, 0);
});
test('bombed dragon is captured by the bomb winner, not donated', () => {
  let s = playing([
    [special('dragon'), ...pick(3)],
    pick(5),
    [...pick(6, 4), ...pick(12)],
    pick(7),
    pick(8),
    pick(9),
  ]);
  s = act(s, 0, { type: 'play', ids: ['dragon'] });
  s = act(s, 2, { type: 'play', ids: pick(6, 4).map((c) => c.id) });
  for (const i of [3, 4, 5, 0, 1]) s = act(s, i, { type: 'pass' });
  s = act(s, 2, { type: 'collect' });
  assert.equal(points(s.captured[2]), 25);
});
test('triple victory immediately scores 300 plus individual declarations', () => {
  let s = playing([[], pick(5), [], pick(7), pick(8), pick(9)], 4);
  s.finish = [0, 2];
  s.calls = [100, 0, 200, 0, 0, 0];
  s = act(s, 4, { type: 'play', ids: [pick(8)[0].id] });
  assert.equal(s.phase, 'roundEnd');
  assert.deepEqual(s.delta, [200, 0]);
});
test('last player transfers hand points to opponents and captures to first finisher', () => {
  let s = playing([[], [], [], [], pick(8), pick(5)], 4);
  s.finish = [0, 1, 2, 3];
  s.captured[5] = pick(13);
  s = act(s, 4, { type: 'play', ids: [pick(8)[0].id] });
  assert.equal(s.phase, 'trick');
  s = act(s, 4, { type: 'collect' });
  assert.equal(s.phase, 'roundEnd');
  assert.deepEqual(s.delta, [15, 0]);
});
test('last finishing dragon still needs donation before scoring', () => {
  let s = playing([[], [], [], [], [special('dragon')], pick(5)], 4);
  s.finish = [0, 1, 2, 3];
  s = act(s, 4, { type: 'play', ids: ['dragon'] });
  assert.equal(s.phase, 'trick');
  assert.throws(() => act(s, 4, { type: 'collect', target: 1 }));
  s = act(s, 4, { type: 'collect', target: 5 });
  assert.deepEqual(s.delta, [30, 0]);
});
test('tichu allowed after passing but not after playing, no double declaration', () => {
  let s = playing([
    [...pick(4), ...pick(3)],
    pick(5),
    pick(6),
    pick(7),
    pick(8),
    pick(9),
  ]);
  s = act(s, 0, { type: 'play', ids: [pick(4)[0].id] });
  s = act(s, 1, { type: 'pass' });
  s = act(s, 1, { type: 'tichu' });
  assert.equal(s.calls[1], 100);
  assert.throws(() => act(s, 1, { type: 'tichu' }));
  assert.throws(() => act(s, 0, { type: 'tichu' }));
});
test('deterministic full rounds finish, conserve cards and award 200 or triple 300', () => {
  for (let seed = 1; seed <= 20; seed++) {
    let x = seed;
    const cards = [...all];
    for (let i = 107; i > 0; i--) {
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      const j = x % (i + 1);
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    let s = startRound(newGame(), cards),
      steps = 0;
    while (!['roundEnd', 'matchEnd'].includes(s.phase) && steps++ < 2000) {
      const i =
        s.phase === 'grand'
          ? s.ready.findIndex((x) => !x)
          : s.phase === 'exchange'
            ? s.exchanges.findIndex((x) => !x)
            : s.phase === 'trick'
              ? s.last
              : s.turn;
      s = act(s, i, botAction(s, i));
      const physical = [...s.hands.flat(), ...s.pile, ...s.captured.flat()];
      assert.equal(physical.length, 108);
      assert.equal(new Set(physical.map((c) => c.id)).size, 108);
    }
    assert.ok(steps < 2000);
    assert.ok([200, 300].includes(s.scores[0] + s.scores[1]));
  }
});
test('1000 point target requires unequal scores', () => {
  let s = playing([[], pick(5), [], pick(7), pick(8), pick(9)], 4);
  s.finish = [0, 2];
  s.scores = [800, 900];
  s = act(s, 4, { type: 'play', ids: [pick(8)[0].id] });
  assert.equal(s.phase, 'matchEnd');
  assert.deepEqual(s.scores, [1100, 900]);
  let tie = playing([[], pick(5), [], pick(7), pick(8), pick(9)], 4);
  tie.finish = [0, 2];
  tie.scores = [700, 1000];
  tie = act(tie, 4, { type: 'play', ids: [pick(8)[0].id] });
  assert.equal(tie.phase, 'roundEnd');
});
test('exchange receipt reveals only own transfers and disappears after own play or first collection', () => {
  let s = startRound(newGame(), deck());
  for (let i = 0; i < 6; i++) s = act(s, i, { type: 'grand', call: false });
  const choices = s.hands.map((h) => h.slice(0, 2).map((c) => c.id));
  s = act(s, 0, { type: 'exchange', ids: choices[0] });
  assert.deepEqual(
    view(s, 0).exchangeReview.map((r) => r.sent.id),
    choices[0],
  );
  assert.ok(view(s, 0).exchangeReview.every((r) => !r.received));
  assert.deepEqual(view(s, 2).exchangeReview, []);
  for (let i = 1; i < 6; i++)
    s = act(s, i, { type: 'exchange', ids: choices[i] });
  assert.deepEqual(
    view(s, 0).exchangeReview.map((r) => [r.partner, r.received.id]),
    [
      [2, choices[2][1]],
      [4, choices[4][0]],
    ],
  );
  const restored = structuredClone(s);
  assert.deepEqual(view(restored, 0).exchangeReview, view(s, 0).exchangeReview);
  restored.turn = 0;
  const c = restored.hands[0].find((c) => !c.special);
  const played = act(restored, 0, { type: 'play', ids: [c.id] });
  assert.deepEqual(view(played, 0).exchangeReview, []);
  assert.equal(view(played, 2).exchangeReview.length, 2);
  played.phase = 'trick';
  played.last = 0;
  const collected = act(played, 0, { type: 'collect' });
  assert.deepEqual(view(collected, 2).exchangeReview, []);
  assert.equal('exchangeReviewClosed' in view(collected, 2), false);
});

test('own-turn wish requires a beating wished bomb, not an unrelated bomb', () => {
  let s = playing([
    [...pick(3, 4), ...pick(4)],
    [...pick(8, 4), ...pick(9, 4), ...pick(10)],
    pick(6),
    pick(7),
    pick(11),
    pick(12),
  ]);
  s = act(s, 0, { type: 'play', ids: pick(3, 4).map((c) => c.id) });
  s.wish = 8;
  const before = structuredClone(s);
  assert.throws(() => act(s, 1, { type: 'pass' }));
  assert.throws(() =>
    act(s, 1, { type: 'play', ids: pick(9, 4).map((c) => c.id) }),
  );
  assert.deepEqual(s, before);
  s = act(s, 1, { type: 'play', ids: pick(8, 4).map((c) => c.id) });
  assert.equal(s.wish, null);
  assert.equal(s.last, 1);
});
test('a weaker wished bomb does not prevent passing a stronger bomb', () => {
  let s = playing([
    [...pick(9, 4), ...pick(4)],
    [...pick(8, 4), ...pick(10)],
    pick(6),
    pick(7),
    pick(11),
    pick(12),
  ]);
  s = act(s, 0, { type: 'play', ids: pick(9, 4).map((c) => c.id) });
  s.wish = 8;
  s = act(s, 1, { type: 'pass' });
  assert.equal(s.wish, 8);
});

test('wish bomb priority rejects interruptions atomically and releases after fulfillment', () => {
  let s = playing([
    [...pick(3, 4), ...pick(4)],
    [...pick(8, 4), ...pick(10)],
    [...pick(9, 4), ...pick(12)],
    pick(7),
    pick(11),
    pick(6),
  ]);
  s = act(s, 0, { type: 'play', ids: pick(3, 4).map((c) => c.id) });
  s.wish = 8;
  const before = structuredClone(s);
  assert.throws(
    () => act(s, 2, { type: 'play', ids: pick(9, 4).map((c) => c.id) }),
    (error) => error.code === 'error.wishBombPriority',
  );
  assert.deepEqual(s, before);
  s = act(s, 1, { type: 'play', ids: pick(8, 4).map((c) => c.id) });
  s = act(s, 2, { type: 'play', ids: pick(9, 4).map((c) => c.id) });
  assert.equal(s.last, 2);
  assert.equal(s.wish, null);
});
test('bomb interruption stays legal when current player cannot beat with the wish', () => {
  let s = playing([
    [...pick(9, 4), ...pick(4)],
    [...pick(8, 4), ...pick(10)],
    [...pick(12, 4), ...pick(2)],
    pick(7),
    pick(11),
    pick(6),
  ]);
  s = act(s, 0, { type: 'play', ids: pick(9, 4).map((c) => c.id) });
  s.wish = 8;
  s = act(s, 2, { type: 'play', ids: pick(12, 4).map((c) => c.id) });
  assert.equal(s.last, 2);
  assert.equal(s.wish, 8);
});
