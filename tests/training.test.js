import test from 'node:test';
import assert from 'node:assert/strict';
import { act, deck, newGame, startRound } from '../src/game.js';
import {
  appendTrainingDecision,
  createTrainingArchive,
  finalizeTrainingSession,
  exportTrainingArchive,
  loadTrainingArchive,
  parseTrainingDecision,
  prepareTrainingDecision,
  pruneTrainingArchive,
  TRAINING_MAX_EVENTS_PER_SESSION,
  TRAINING_MAX_SESSIONS,
  TRAINING_MAX_BYTES,
  TRAINING_RETENTION_MS,
} from '../server/training/records.ts';

function fixture() {
  const state = startRound(newGame(), deck());
  state.phase = 'grand';
  return state;
}

test('training decision is a private-seat/public-state projection', () => {
  const state = fixture();
  state.names = ['secret-name', 'other', 'x', 'y', 'z', 'q'];
  const record = prepareTrainingDecision(
    state,
    0,
    { type: 'grand', call: true },
    'human',
  );
  assert.equal(record.source, 'human');
  assert.equal(record.action.type, 'grand');
  assert.equal(record.ownHand.length, 10);
  assert.equal(record.publicState.counts.length, 6);
  assert.equal('names' in record, false);
  assert.equal('roomId' in record, false);
  assert.equal(JSON.stringify(record).includes('hash'), false);
  assert.equal(JSON.stringify(record).includes('token'), false);
});

test('public top uses an explicit allowlist and never includes hidden grand cards', () => {
  const state = fixture();
  state.top = {
    kind: 'single',
    power: 7,
    size: 1,
    bomb: 0,
    cards: [state.hands[1][0]],
    privateLeak: 'should-not-export',
  };
  const record = prepareTrainingDecision(
    state,
    0,
    { type: 'grand', call: false },
    'human',
  );
  assert.equal(record.publicState.top.cards.length, 1);
  assert.equal('privateLeak' in record.publicState.top, false);
  assert.equal(JSON.stringify(record).includes('should-not-export'), false);
});

test('persisted phoenix top keeps its half-integer power', () => {
  const state = fixture();
  const phoenix = deck().find((card) => card.special === 'phoenix');
  state.top = {
    kind: 'single',
    power: 1.5,
    size: 1,
    bomb: 0,
    cards: [phoenix],
  };
  const record = prepareTrainingDecision(
    state,
    0,
    { type: 'grand', call: false },
    'human',
  );
  const loaded = loadTrainingArchive(
    {
      sessions: [
        { id: 'phoenix', createdAt: 1000, updatedAt: 1000, events: [record] },
      ],
    },
    1000,
  );
  assert.equal(loaded.sessions.length, 1);
  assert.equal(loaded.sessions[0].events[0].publicState.top.power, 1.5);
});

test('grand recording fails closed when the visible first-ten projection is absent', () => {
  const state = fixture();
  delete state.first;
  assert.equal(
    prepareTrainingDecision(state, 0, { type: 'grand', call: false }, 'human'),
    null,
  );
});

test('action normalization rejects cards outside the acting hand', () => {
  const state = fixture();
  const record = prepareTrainingDecision(
    state,
    0,
    {
      type: 'play',
      ids: ['not-in-hand'],
      target: 2,
      wish: 8,
      phoenixRank: null,
    },
    'bot',
    'policy-test',
  );
  assert.equal(record, null);
});

test('archive bounds events and sessions and finalizes outcomes', () => {
  const state = fixture();
  const archive = createTrainingArchive();
  const decision = prepareTrainingDecision(
    state,
    0,
    { type: 'grand', call: false },
    'bot',
  );
  for (let i = 0; i < TRAINING_MAX_EVENTS_PER_SESSION; i++)
    assert.equal(
      appendTrainingDecision(archive, 'round-a', decision, 1000 + i),
      true,
    );
  assert.equal(
    appendTrainingDecision(archive, 'round-a', decision, 4000),
    true,
  );
  assert.ok(
    archive.sessions.find((session) => session.id === 'round-a').events
      .length <= TRAINING_MAX_EVENTS_PER_SESSION,
  );
  assert.equal(
    finalizeTrainingSession(
      archive,
      'round-a',
      {
        scores: [200, 0],
        delta: [200, 0],
        finish: [0, 2, 4],
        winner: 0,
      },
      5000,
    ),
    true,
  );
  assert.equal(
    archive.sessions.find((session) => session.id === 'round-a').outcome.winner,
    0,
  );
  for (let i = 1; i < TRAINING_MAX_SESSIONS; i++)
    assert.equal(
      appendTrainingDecision(archive, `round-${i}`, decision, 6000 + i),
      true,
    );
  assert.equal(
    appendTrainingDecision(archive, 'too-many', decision, 7000),
    true,
  );
  assert.ok(archive.sessions.length <= TRAINING_MAX_SESSIONS);
});

test('pruning uses creation time so updates cannot extend retention', () => {
  const state = fixture();
  const archive = createTrainingArchive();
  const decision = prepareTrainingDecision(
    state,
    0,
    { type: 'grand', call: false },
    'human',
  );
  appendTrainingDecision(archive, 'old', decision, 100);
  appendTrainingDecision(archive, 'new', decision, 1000);
  appendTrainingDecision(archive, 'old', decision, 999);
  pruneTrainingArchive(archive, 1000 + TRAINING_RETENTION_MS);
  assert.deepEqual(
    archive.sessions.map((s) => s.id),
    ['new'],
  );
});

test('accepted action can be replayed from the recorded pre-action revision', () => {
  const state = fixture();
  const record = prepareTrainingDecision(
    state,
    0,
    { type: 'grand', call: true },
    'human',
  );
  assert.equal(record.revision, state.revision);
  const next = act(state, 0, record.action);
  assert.equal(next.revision, record.revision + 1);
});

test('archive stays below the serialized Durable Object byte budget', () => {
  const state = fixture();
  const archive = createTrainingArchive();
  const decision = prepareTrainingDecision(
    state,
    0,
    { type: 'grand', call: false },
    'bot',
    'policy-with-a-deliberately-long-but-bounded-name',
  );
  for (let i = 0; i < TRAINING_MAX_EVENTS_PER_SESSION; i++)
    appendTrainingDecision(archive, 'round-bytes', decision, 1000 + i);
  const bytes = new TextEncoder().encode(JSON.stringify(archive)).byteLength;
  assert.ok(bytes <= TRAINING_MAX_BYTES);
  assert.ok(
    archive.sessions[0].events.length < TRAINING_MAX_EVENTS_PER_SESSION,
  );
  finalizeTrainingSession(
    archive,
    'round-bytes',
    { scores: [0, 0], delta: [0, 0], finish: [], winner: null },
    5000,
  );
  assert.equal(
    exportTrainingArchive(archive, 5000).sessions[0].truncated,
    true,
  );
});

test('export includes only completed sessions and no storage timestamps', () => {
  const state = fixture();
  const archive = createTrainingArchive();
  const decision = prepareTrainingDecision(
    state,
    0,
    { type: 'grand', call: false },
    'human',
  );
  appendTrainingDecision(archive, 'incomplete', decision, 1000);
  appendTrainingDecision(archive, 'complete', decision, 1000);
  finalizeTrainingSession(
    archive,
    'complete',
    { scores: [0, 0], delta: [0, 0], finish: [], winner: null },
    1000,
  );
  const exported = exportTrainingArchive(archive, 1000);
  assert.deepEqual(
    exported.sessions.map((s) => s.id),
    ['complete'],
  );
  assert.equal('createdAt' in exported.sessions[0], false);
  assert.equal('updatedAt' in exported.sessions[0], false);
  assert.equal(JSON.stringify(exported).includes('createdAt'), false);
  assert.equal(exported.schema, 2);
  assert.equal(exported.sessions[0].groupId, null);
});

test('malformed stored archive is discarded or reduced to validated records', () => {
  const state = fixture();
  const decision = prepareTrainingDecision(
    state,
    0,
    { type: 'grand', call: false },
    'human',
  );
  const loaded = loadTrainingArchive(
    {
      sessions: [
        { id: 'bad', createdAt: 1, updatedAt: 1, events: [{ nope: true }] },
        {
          id: 'good',
          createdAt: 1000,
          updatedAt: 1000,
          events: [decision, { nope: true }],
        },
        'not-a-session',
      ],
    },
    1000,
  );
  assert.deepEqual(
    loaded.sessions.map((s) => s.id),
    ['good'],
  );
  assert.equal(loaded.sessions[0].events.length, 1);
  assert.equal(loaded.sessions[0].truncated, true);
  assert.equal(
    parseTrainingDecision({
      ...decision,
      action: {
        type: 'play',
        ids: ['bad'],
        target: null,
        wish: null,
        phoenixRank: null,
      },
    }),
    null,
  );
  assert.doesNotThrow(() => loadTrainingArchive(null, 1000));
  assert.deepEqual(loadTrainingArchive(null, 1000), { sessions: [] });
});

test('legacy sessions retain unknown match grouping as null on export', () => {
  const state = fixture();
  const decision = prepareTrainingDecision(
    state,
    0,
    { type: 'grand', call: false },
    'human',
  );
  const archive = loadTrainingArchive(
    {
      sessions: [
        { id: 'legacy', createdAt: 1000, updatedAt: 1000, events: [decision] },
      ],
    },
    1000,
  );
  finalizeTrainingSession(
    archive,
    'legacy',
    { scores: [0, 0], delta: [0, 0], finish: [], winner: null },
    1000,
  );
  const exported = exportTrainingArchive(archive, 1000);
  assert.equal(exported.sessions[0].groupId, null);
});
