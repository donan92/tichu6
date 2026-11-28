import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomEngine } from '../server/game/room-engine.ts';
import { newGame, startRound, deck, botAction, act } from '../src/game.js';
import {
  appendTrainingDecision,
  createTrainingArchive,
  prepareTrainingDecision,
  TRAINING_MAX_BYTES,
} from '../server/training/records.ts';

test('bot queries stay pure and deterministic across all phases and reconstruct without writes', async () => {
  let writes = 0;
  const ctx = {
    blockConcurrencyWhile: async (fn) => fn(),
    storage: {
      get: async () => undefined,
      put: async () => {
        writes++;
      },
      getAlarm: async () => null,
      setAlarm: async () => {
        throw Error('read-only query scheduled an alarm');
      },
    },
  };
  let actor = new RoomEngine(ctx),
    state = startRound(newGame(), deck()),
    steps = 0;
  const phases = new Set();
  while (!['roundEnd', 'matchEnd'].includes(state.phase) && steps < 1000) {
    const seat =
      state.phase === 'grand'
        ? state.ready.findIndex((v) => !v)
        : state.phase === 'exchange'
          ? state.exchanges.findIndex((v) => !v)
          : state.phase === 'trick'
            ? state.last
            : state.turn;
    const original = structuredClone(state);
    const expected = botAction(state, seat);
    assert.deepEqual(state, original, 'policy query must not mutate state');
    const request = () =>
      new Request('https://internal/transition', {
        method: 'POST',
        body: JSON.stringify({ operation: 'bot', state, seat }),
      });
    assert.deepEqual(
      (await (await actor.fetch(request())).json()).action,
      expected,
    );
    actor = new RoomEngine(ctx);
    assert.deepEqual(
      (await (await actor.fetch(request())).json()).action,
      expected,
    );
    phases.add(state.phase);
    state = act(state, seat, expected);
    steps++;
  }
  assert.ok(steps < 1000);
  assert.deepEqual([...phases].sort(), ['exchange', 'grand', 'play', 'trick']);
  assert.equal(writes, 0);
});

test('training byte-cap rollback restores all containers without cloning immutable decisions', () => {
  const state = startRound(newGame(), deck());
  const record = prepareTrainingDecision(
    state,
    0,
    { type: 'grand', call: false },
    'human',
  );
  const archive = createTrainingArchive();
  appendTrainingDecision(archive, 'old', record, 1000);
  appendTrainingDecision(archive, 'recent', record, 1001);
  const before = structuredClone(archive);
  // A deliberately oversized internal decision causes the oldest (target)
  // session to be evicted; rejection must restore the complete archive.
  assert.equal(
    appendTrainingDecision(
      archive,
      'old',
      { ...record, recordId: 'x'.repeat(TRAINING_MAX_BYTES * 2) },
      1002,
    ),
    false,
  );
  assert.deepEqual(archive, before);
  assert.equal(
    archive.sessions[0].events[0],
    record,
    'immutable accepted decisions need no deep copy',
  );
});
