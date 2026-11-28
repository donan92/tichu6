import test from 'node:test';
import assert from 'node:assert/strict';
import { trainingArchiveBytes } from '../server/training/bytes.ts';
import { newGame, startRound, deck } from '../src/game.js';
import {
  prepareTrainingDecision,
  appendTrainingDecision,
  finalizeTrainingSession,
  loadTrainingArchive,
  pruneTrainingArchive,
  TRAINING_RETENTION_MS,
} from '../server/training/records.ts';

const oracle = (archive) =>
  new TextEncoder().encode(JSON.stringify(archive)).length;
const record = () =>
  prepareTrainingDecision(
    startRound(newGame(), deck()),
    0,
    { type: 'grand', call: false },
    'human',
  );
const outcome = {
  scores: [200, -100],
  delta: [200, -100],
  finish: [0, 2, 4],
  winner: 0,
};

test('byte accounting matches JSON UTF-8 across mutable metadata, escaping and cold load', () => {
  let archive = { sessions: [] };
  const strings = ['', '한국어', '😀', '\ud800', '"\\\n\t', '汉字かな'];
  for (let i = 0; i < 180; i++) {
    const event = { ...record(), recordId: strings[i % strings.length] + i };
    appendTrainingDecision(
      archive,
      's' + Math.floor(i / 17),
      event,
      999 + i,
      strings[(i + 1) % strings.length] || null,
    );
    assert.equal(trainingArchiveBytes(archive), oracle(archive));
    if (i % 11 === 0) {
      finalizeTrainingSession(
        archive,
        's' + Math.floor(i / 17),
        outcome,
        10000 + i,
      );
      assert.equal(trainingArchiveBytes(archive), oracle(archive));
    }
    if (i % 19 === 0) {
      archive = loadTrainingArchive(structuredClone(archive), 1200);
      assert.equal(trainingArchiveBytes(archive), oracle(archive));
    }
  }
  for (const session of archive.sessions) {
    delete session.groupId;
    session.updatedAt = -1;
    session.truncated = false;
    assert.equal(trainingArchiveBytes(archive), oracle(archive));
    session.groupId = null;
    delete session.outcome;
    session.truncated = true;
    assert.equal(trainingArchiveBytes(archive), oracle(archive));
  }
  pruneTrainingArchive(archive, TRAINING_RETENTION_MS + 20000);
  assert.equal(trainingArchiveBytes(archive), oracle(archive));
  assert.deepEqual(archive.sessions, []);
});

test('cached event snapshots cannot be invalidated through nested mutations', () => {
  const event = record();
  const archive = {
    sessions: [{ id: 's', createdAt: 1, updatedAt: 1, events: [event] }],
  };
  const bytes = trainingArchiveBytes(archive);
  assert.throws(() => {
    event.ownHand[0].id = 'changed';
  }, TypeError);
  assert.throws(() => {
    event.publicState.scores.push(100);
  }, TypeError);
  assert.throws(() => {
    event.action.call = true;
  }, TypeError);
  assert.equal(trainingArchiveBytes(archive), bytes);
  assert.equal(bytes, oracle(archive));
  // A shallow-frozen input must not bypass recursive immutability.
  const shallow = Object.freeze(structuredClone(event));
  archive.sessions[0].events = [shallow];
  assert.equal(trainingArchiveBytes(archive), oracle(archive));
  assert.ok(Object.isFrozen(shallow.ownHand[0]));
});

test('frozen decisions survive failed persistence and cold repository restoration', async () => {
  const { RoomRepository } =
    await import('../server/persistence/room.repository.ts');
  const values = new Map();
  let fail = false;
  const storage = {
    get: async (key) => structuredClone(values.get(key)),
    put: async (batch) => {
      if (fail) throw Error('storage unavailable');
      for (const [key, value] of Object.entries(batch))
        values.set(key, structuredClone(value));
    },
  };
  const repo = new RoomRepository(storage);
  await repo.load();
  const now = Date.now();
  appendTrainingDecision(repo.training, 'session', record(), now, 'group');
  finalizeTrainingSession(repo.training, 'session', outcome, now);
  repo.markTrainingDirty();
  repo.data.activity.test = now;
  const pending = structuredClone(repo.training);
  fail = true;
  await assert.rejects(repo.save(), /storage unavailable/);
  assert.equal(values.size, 0);
  fail = false;
  await repo.save();
  assert.deepEqual(values.get('training-v1'), pending);
  const restored = new RoomRepository(storage);
  await restored.load(now);
  assert.deepEqual(restored.training, pending);
  assert.equal(trainingArchiveBytes(restored.training), oracle(pending));
});
