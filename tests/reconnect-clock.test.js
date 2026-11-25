import test from 'node:test';
import assert from 'node:assert/strict';
import { startRound, newGame } from '../src/game.js';
import { syncReconnectClock } from '../server/game/reconnect-clock.ts';
import { dueAction } from '../src/game-clock.ts';
function room() {
  const state = startRound(newGame());
  state.phase = 'play';
  state.turn = 0;
  return {
    state,
    members: [
      { offlineSince: 1000 },
      ...Array.from({ length: 5 }, () => ({ bot: true })),
    ],
  };
}
test('disconnect waits three minutes then gives thirty seconds; persisted retries do not extend it', () => {
  let r = room();
  syncReconnectClock(r, [false], 2000);
  assert.equal(r.state.deadline, 211000);
  assert.equal(r.reconnectTurn.until, 181000);
  r = structuredClone(r);
  syncReconnectClock(r, [false], 182000);
  assert.equal(r.state.deadline, 211000);
  assert.equal(dueAction(r.state, 210999), null);
  assert.ok(dueAction(r.state, 211000));
});
test('early reconnect starts thirty seconds, flapping does not restart grace, next turn resets the allowance', () => {
  const r = room();
  syncReconnectClock(r, [false], 2000);
  r.members[0].offlineSince = null;
  syncReconnectClock(r, [true], 20000);
  assert.equal(r.state.deadline, 50000);
  r.members[0].offlineSince = 21000;
  syncReconnectClock(r, [false], 21000);
  assert.equal(r.state.deadline, 50000);
  r.state.turn = 1;
  syncReconnectClock(r, [false], 22000);
  assert.equal(r.reconnectTurn, undefined);
});
test('idle seats, bots, expired offline grace and trick collection do not acquire reconnection delay', () => {
  for (const member of [
    { bot: true },
    { idle: true, offlineSince: 1000 },
    { offlineSince: -200000 },
  ]) {
    const r = room();
    r.members[0] = member;
    syncReconnectClock(r, [false], 2000);
    assert.equal(r.state.deadline, 32000);
    assert.equal(r.reconnectTurn, undefined);
  }
  const r = room();
  r.state.phase = 'trick';
  syncReconnectClock(r, [false], 2000);
  assert.equal(r.state.deadline, 7000);
});
