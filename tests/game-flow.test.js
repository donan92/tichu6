import test from 'node:test';
import assert from 'node:assert/strict';
import { deck, startRound, newGame, act, view } from '../src/game.js';
import { syncDeadline, dueAction } from '../src/game-clock.ts';
import { publicView } from '../server/room/snapshots.ts';
const cards = deck();
const pick = (rank, n = 1) =>
  cards.filter((c) => !c.special && c.rank === rank).slice(0, n);
function playing(
  hands = [pick(3), pick(4), pick(5), pick(6), pick(7), pick(8)],
) {
  const state = startRound(newGame());
  state.phase = 'play';
  state.turn = 0;
  state.hands = hands;
  return state;
}
test('each declaration loses its full stake when a teammate finishes first, including triples', () => {
  for (const call of [100, 200]) {
    let s = playing([[], pick(4), [], pick(6), pick(7), pick(8)]);
    s.turn = 4;
    s.finish = [0, 2];
    s.calls[2] = call;
    s = act(s, 4, { type: 'play', ids: [s.hands[4][0].id] });
    assert.deepEqual(s.delta, [300 - call, 0]);
    assert.deepEqual(s.callResults, [
      { seat: 2, call, success: false, delta: -call },
    ]);
    s = playing([[], [], [], [], pick(7), pick(8)]);
    s.turn = 4;
    s.finish = [0, 1, 2, 3];
    s.calls[2] = call;
    s = act(s, 4, { type: 'play', ids: [s.hands[4][0].id] });
    s = act(s, 4, { type: 'collect' });
    assert.equal(s.callResults[0].delta, -call);
    assert.equal(s.delta[0], -call);
  }
});
test('exchange accepts changed unconfirmed selections after a call but never changes a confirmed exchange', () => {
  let s = startRound(newGame());
  for (let i = 0; i < 6; i++) s = act(s, i, { type: 'grand', call: false });
  const first = s.hands[0].slice(0, 2).map((c) => c.id),
    revised = s.hands[0].slice(2, 4).map((c) => c.id);
  s = act(s, 2, { type: 'tichu' });
  s = act(s, 0, { type: 'exchange', ids: revised });
  s = act(s, 4, { type: 'tichu' });
  assert.throws(() => act(s, 0, { type: 'exchange', ids: first }), {
    code: 'error.exchangePhase',
  });
  assert.deepEqual(s.exchanges[0], revised);
});
test('past tricks are absent from player/spectator snapshots until match end and played cards are sorted', () => {
  let s = playing([
    pick(3, 2),
    pick(4, 2),
    pick(5, 2),
    pick(6, 2),
    pick(7, 2),
    pick(8, 2),
  ]);
  s = act(s, 0, { type: 'play', ids: s.hands[0].map((c) => c.id).reverse() });
  assert.deepEqual(
    s.top.cards.map((c) => c.id),
    pick(3, 2).map((c) => c.id),
  );
  for (const i of [1, 2, 3, 4, 5]) s = act(s, i, { type: 'pass' });
  assert.equal(s.log.filter((m) => m.code === 'log.pass').length, 5);
  s = act(s, 0, { type: 'collect' });
  assert.equal(s.trickHistory.length, 1);
  assert.deepEqual(s.log, []);
  for (const snapshot of [view(s, 1), publicView(s)])
    assert.deepEqual(snapshot.trickHistory, []);
  s.phase = 'roundEnd';
  assert.deepEqual(publicView(s).trickHistory, []);
  s.phase = 'matchEnd';
  assert.equal(
    publicView(s).trickHistory[0].entries.filter((m) => m.code === 'log.pass')
      .length,
    5,
  );
  const old = playing();
  delete old.trickNumber;
  old.log = [{ code: 'past-secret-history' }];
  assert.deepEqual(publicView(old).log, []);
});
test('turn deadline is stable across declarations and rehydration, and expired turns pass legally', () => {
  let s = playing();
  s = act(s, 0, { type: 'play', ids: [s.hands[0][0].id] });
  syncDeadline(s, 1000);
  assert.equal(s.deadline, 31000);
  s = act(s, 2, { type: 'tichu' });
  syncDeadline(s, 5000);
  assert.equal(s.deadline, 31000);
  s = structuredClone(s);
  syncDeadline(s, 30000);
  assert.equal(s.deadline, 31000);
  assert.equal(dueAction(s, 30999), null);
  const due = dueAction(s, 31000);
  assert.deepEqual(due, { seat: 1, action: { type: 'pass' } });
  s = act(s, due.seat, due.action);
  syncDeadline(s, 31000);
  assert.equal(s.deadline, 61000);
});
test('timeout leads and mandatory wishes use legal plays instead of invalid passes', () => {
  let s = playing();
  syncDeadline(s, 0);
  let due = dueAction(s, 30000);
  assert.equal(due.action.type, 'play');
  s = act(s, due.seat, due.action);
  s.wish = 4;
  syncDeadline(s, 30000);
  due = dueAction(s, 60000);
  assert.equal(due.action.type, 'play');
  assert.doesNotThrow(() => act(s, due.seat, due.action));
});
test('tricks wait five seconds and only the collector can choose a dragon opponent without extending time', () => {
  let s = playing([
    [cards.find((c) => c.special === 'dragon')],
    pick(4),
    pick(5),
    pick(6),
    pick(7),
    pick(8),
  ]);
  s = act(s, 0, { type: 'play', ids: ['dragon'] });
  for (const i of [1, 2, 3, 4, 5]) s = act(s, i, { type: 'pass' });
  syncDeadline(s, 1000);
  assert.equal(s.deadline, 6000);
  assert.throws(() => act(s, 1, { type: 'dragonTarget', target: 3 }));
  assert.throws(() => act(s, 0, { type: 'dragonTarget', target: 2 }));
  s = act(s, 0, { type: 'dragonTarget', target: 5 });
  syncDeadline(s, 3000);
  assert.equal(s.deadline, 6000);
  assert.equal(dueAction(s, 5999), null);
  const due = dueAction(s, 6000);
  assert.deepEqual(due, { seat: 0, action: { type: 'collect', target: 5 } });
  s = act(s, due.seat, due.action);
  assert.equal(s.captured[5][0].special, 'dragon');
});
