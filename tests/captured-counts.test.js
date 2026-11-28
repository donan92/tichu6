import test from 'node:test';
import assert from 'node:assert/strict';
import { deck, newGame, startRound, view } from '../src/game.js';
import { publicView } from '../server/room/snapshots.ts';

test('captured counts include zero-point cards, exclude the current pile and expose no captured cards', () => {
  const state = startRound(newGame());
  const cards = deck();
  state.captured[1] = cards.filter((c) => c.rank === 2).slice(0, 3);
  state.captured[3] = cards.filter((c) => c.special === 'dragon');
  state.pile = cards.filter((c) => c.rank === 5);
  const personal = view(state, 0),
    spectator = publicView(state);
  for (const snapshot of [personal, spectator]) {
    assert.deepEqual(snapshot.capturedCounts, [0, 3, 0, 1, 0, 0]);
    assert.equal(snapshot.capturedPoints[1], 0);
    assert.equal(snapshot.capturedPoints[3], 25);
    for (const key of ['captured', 'hands', 'first', 'exchanges'])
      assert.equal(key in snapshot, false);
  }
  assert.equal(personal.hand.length, 10);
  assert.deepEqual(spectator.hand, []);
  state.phase = 'roundEnd';
  assert.deepEqual(
    publicView(startRound(state)).capturedCounts,
    [0, 0, 0, 0, 0, 0],
  );
  assert.deepEqual(publicView(newGame()).capturedCounts, [0, 0, 0, 0, 0, 0]);
});
