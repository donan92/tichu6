import test from 'node:test';
import assert from 'node:assert/strict';
import { act, newGame, startRound, deck, recipientSeats } from '../src/game.js';
import { syncDeadline, dueAction } from '../src/game-clock.ts';
function state() {
  const s = startRound(newGame(), deck());
  s.phase = 'play';
  s.turn = 0;
  s.top = null;
  return s;
}
test('extra time is authenticated by turn, once only, and bounded to final ten seconds', () => {
  let s = state();
  syncDeadline(s);
  s.deadline = Date.now() + 9000;
  assert.throws(() => act(s, 1, { type: 'extendTime' }));
  const before = s.deadline;
  s = act(s, 0, { type: 'extendTime' });
  assert.equal(s.deadline, before + 30000);
  assert.equal(s.extensionUsed, true);
  s.deadline = Date.now() + 9000;
  assert.throws(() => act(s, 0, { type: 'extendTime' }));
  s.extensionUsed = false;
  s.deadline = Date.now() + 11000;
  assert.throws(() => act(s, 0, { type: 'extendTime' }));
  s.deadline = Date.now() - 1;
  assert.throws(() => act(s, 0, { type: 'extendTime' }));
});
test('Small Tichu expands an active ordinary turn to two minutes without reset on sync', () => {
  let s = state();
  syncDeadline(s);
  const now = Date.now();
  s = act(s, 1, { type: 'tichu' });
  assert.ok(s.deadline >= now + 120000);
  assert.equal(s.deadlineDuration, 120000);
  const deadline = s.deadline;
  syncDeadline(s, now + 1000);
  assert.equal(s.deadline, deadline);
  s = act(s, 2, { type: 'tichu' });
  assert.ok(s.deadline >= deadline);
});
test('dog selection gets a new thirty seconds only once and must finish with dog', () => {
  let s = state();
  s.hands[0] = [deck().find((c) => c.special === 'dog'), ...s.hands[0]];
  syncDeadline(s, 1000);
  s = act(s, 0, { type: 'prepareDog' });
  syncDeadline(s, 20000);
  assert.equal(s.deadline, 50000);
  assert.throws(() => act(s, 0, { type: 'prepareDog' }));
  assert.throws(() => act(s, 0, { type: 'extendTime' }));
  const due = dueAction(s, 50000);
  assert.equal(due.action.ids[0], 'dog');
  s = act(s, due.seat, due.action);
  assert.equal(s.dogPending, null);
});
test('finished recipients excluded; dog permits finished partners only when both finished', () => {
  let s = state();
  s.hands[2] = [];
  assert.deepEqual(recipientSeats(s, 0, 'dog'), [4]);
  s.hands[4] = [];
  assert.deepEqual(recipientSeats(s, 0, 'dog'), [2, 4]);
  s.hands[1] = [];
  assert.deepEqual(recipientSeats(s, 0, 'dragon'), [3, 5]);
});

test('dragon may be given to a finished opponent only when all opponents finished', () => {
  let s = state();
  s.hands = [
    [deck().find((c) => c.special === 'dragon')],
    [],
    [deck()[0]],
    [],
    [],
    [],
  ];
  s.finish = [1, 4, 3, 5];
  s.turn = 0;
  s = act(s, 0, { type: 'play', ids: ['dragon'] });
  assert.equal(s.phase, 'trick');
  assert.deepEqual(recipientSeats(s, 0, 'dragon'), [1, 3, 5]);
  s = act(s, 0, { type: 'collect', target: 3 });
  assert.equal(s.delta[1], 25);
});

test('call confirmation adds ten seconds once without declaring, then declaration gives two minutes', () => {
  let s = state();
  syncDeadline(s);
  const original = s.deadline;
  s = act(s, 0, { type: 'prepareCall', call: 100 });
  assert.equal(s.calls[0], 0);
  assert.equal(s.deadline, original + 10000);
  const before = structuredClone(s);
  assert.throws(() => act(s, 0, { type: 'prepareCall', call: 100 }));
  assert.deepEqual(s, before);
  const now = Date.now();
  s = act(s, 0, { type: 'tichu' });
  assert.equal(s.calls[0], 100);
  assert.ok(s.deadline >= now + 120000);
});
test('Large Tichu confirmation does not declare or complete the initial decision', () => {
  let s = startRound(newGame(), deck());
  s = act(s, 0, { type: 'prepareCall', call: 200 });
  assert.equal(s.calls[0], 0);
  assert.equal(s.ready[0], false);
  s = act(s, 0, { type: 'grand', call: true });
  assert.equal(s.calls[0], 200);
});

test('preparation shares three minutes across declarations, exchange and restored state', () => {
  let s = startRound(newGame(), deck());
  const now = Date.now();
  syncDeadline(s, now);
  const deadline = s.deadline;
  assert.equal(deadline, now + 180000);
  s = act(s, 0, { type: 'prepareCall', call: 200 });
  assert.equal(s.deadline, deadline);
  assert.equal(dueAction(s, deadline - 1), null);
  for (let seat = 0; seat < 6; seat++)
    s = act(s, seat, { type: 'grand', call: false });
  s = structuredClone(s);
  syncDeadline(s, now + 120000);
  assert.equal(s.deadline, deadline);
  assert.equal(s.phase, 'exchange');
  for (let i = 0; i < 6; i++) {
    const due = dueAction(s, deadline);
    assert.equal(due.action.type, 'exchange');
    s = act(s, due.seat, due.action);
    syncDeadline(s, deadline);
  }
  assert.equal(s.phase, 'play');
  assert.equal(s.deadline, deadline + 30000);
});
