import test from 'node:test';
import assert from 'node:assert/strict';
import {
  act,
  deck,
  newGame,
  startRound,
  view,
  currentTrickStarter,
} from '../src/game.js';
import { publicView } from '../server/room/snapshots.ts';
const cards = deck();
const rank = (n, count = 1) =>
  cards.filter((c) => !c.special && c.rank === n).slice(0, count);
function playing() {
  const s = startRound(newGame(['One', 'Two', 'Three', 'Four', 'Five', 'Six']));
  s.phase = 'play';
  s.turn = 0;
  s.hands = [
    rank(3),
    [...rank(4), ...rank(7)],
    [...rank(8, 4), ...rank(9)],
    rank(10, 2),
    rank(11, 2),
    rank(12, 2),
  ];
  return s;
}
test('starter survives finishing, an overcall, a bomb, pass and reconstruction until collection', () => {
  let s = playing();
  assert.equal(currentTrickStarter(s), null);
  s = act(s, 0, { type: 'play', ids: s.hands[0].map((c) => c.id) });
  assert.equal(s.trickStarter, 0);
  assert.deepEqual(s.finish, [0]);
  s = act(s, 1, { type: 'play', ids: [rank(4)[0].id] });
  s = act(s, 2, { type: 'play', ids: rank(8, 4).map((c) => c.id) });
  assert.equal(s.last, 2);
  assert.equal(s.trickStarter, 0);
  s = JSON.parse(JSON.stringify(s));
  assert.equal(view(s, 1).trickStarter, 0);
  assert.equal(publicView(s).trickStarter, 0);
  for (const seat of [3, 4, 5, 1]) s = act(s, seat, { type: 'pass' });
  assert.equal(s.phase, 'trick');
  assert.equal(s.trickStarter, 0);
  s = act(s, 2, { type: 'collect' });
  assert.equal(view(s, 1).trickStarter, null);
  s = act(s, 2, { type: 'play', ids: [rank(9)[0].id] });
  assert.equal(s.trickStarter, 2);
  s.phase = 'roundEnd';
  assert.equal(publicView(s).trickStarter, null);
  assert.equal(startRound(s).trickStarter, null);
});
test('older saved rooms recover from first play only, not the latest winning play', () => {
  let s = playing();
  s.hands[0].push(...rank(2));
  s = act(s, 0, { type: 'play', ids: [rank(3)[0].id] });
  s = act(s, 1, { type: 'play', ids: [rank(4)[0].id] });
  delete s.trickStarter;
  assert.equal(publicView(s).trickStarter, 0);
  s = act(s, 2, { type: 'pass' });
  for (const seat of [3, 4, 5, 0]) s = act(s, seat, { type: 'pass' });
  assert.ok(s.passed.includes(0));
  assert.equal(s.trickStarter, 0);
  delete s.trickStarter;
  delete s.trickNumber;
  assert.equal(currentTrickStarter(s), null);
});
test('Dog transfers the lead without leaving a starter badge on the Dog sender', () => {
  let s = playing();
  s.hands[0].push(cards.find((c) => c.special === 'dog'));
  s = act(s, 0, { type: 'play', ids: ['dog'], target: 2 });
  assert.equal(currentTrickStarter(s), null);
  s = act(s, 2, { type: 'play', ids: [rank(9)[0].id] });
  assert.equal(s.trickStarter, 2);
});
