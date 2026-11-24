import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  statSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { act, deck, newGame, startRound } from '../src/game.js';
import { prepareTrainingDecision } from '../server/training/records.ts';
import { prepareDataset } from '../scripts/training-dataset.mjs';

function fixture() {
  let state = startRound(newGame(), deck());
  const events = [];
  for (let seat = 0; seat < 3; seat++) {
    const action = { type: 'grand', call: false };
    events.push(
      prepareTrainingDecision(
        state,
        seat,
        action,
        seat === 2 ? 'bot' : 'human',
      ),
    );
    state = act(state, seat, action);
  }
  return {
    schema: 2,
    sessions: [
      {
        id: 'test-round',
        groupId: 'test-match',
        events,
        truncated: true,
        outcome: {
          scores: [20, 80],
          delta: [20, 80],
          finish: [1, 0, 3],
          winner: 1,
        },
      },
    ],
  };
}

test('dataset preserves whole-round split, excludes takeover bots and strips extra private fields', () => {
  const data = fixture();
  data.sessions[0].events[0].publicState.names = ['secret'];
  data.sessions[0].events[0].ownHand[0].token = 'secret';
  data.sessions[0].outcome.hash = 'secret';
  const result = prepareDataset(data);
  assert.equal(result.ignoredBots, 1);
  const filled = Object.values(result.partitions).filter((rows) => rows.length);
  assert.equal(filled.length, 1);
  assert.equal(filled[0].length, 2);
  assert.ok(
    filled[0].every(
      (row) => row.truncated && row.observation.ownHand.length === 10,
    ),
  );
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.deepEqual(prepareDataset(data), result);
});

test('different rounds of one anonymous match stay in the same split', () => {
  const sessions = Array.from({ length: 20 }, (_, index) => {
    const session = fixture().sessions[0];
    session.id = `round-${index}`;
    return session;
  });
  const result = prepareDataset({ schema: 2, sessions });
  const filled = Object.values(result.partitions).filter((rows) => rows.length);
  assert.equal(filled.length, 1);
  assert.equal(filled[0].length, 40);
  assert.ok(filled[0].every((row) => row.matchGroup === 'test-match'));
  assert.equal(result.legacyRounds, 0);
});

test('legacy records without match boundaries are excluded from evaluation', () => {
  for (const schema of [1, 2]) {
    const data = fixture();
    data.schema = schema;
    if (schema === 1) delete data.sessions[0].groupId;
    else data.sessions[0].groupId = null;
    const result = prepareDataset(data);
    assert.equal(result.partitions.train.length, 2);
    assert.equal(result.partitions.validation.length, 0);
    assert.equal(result.partitions.test.length, 0);
    assert.equal(result.legacyRounds, 1);
    assert.ok(result.partitions.train.every((row) => row.matchGroup === null));
  }
});

test('dataset rejects duplicates, incomplete labels and malformed events instead of silently training', () => {
  const mutations = [
    (data) => {
      delete data.sessions[0].groupId;
    },
    (data) => data.sessions.push(structuredClone(data.sessions[0])),
    (data) =>
      data.sessions[0].events.push(structuredClone(data.sessions[0].events[0])),
    (data) => {
      data.sessions[0].outcome.delta = null;
    },
    (data) => {
      data.sessions[0].events[0].source = 'unknown';
    },
    (data) => {
      data.sessions[0].events[0].seat = 6;
    },
    (data) => {
      data.sessions[0].events[0].publicState.counts = [];
    },
    (data) => {
      data.sessions[0].events[1].round++;
    },
  ];
  for (const mutate of mutations) {
    const data = fixture();
    mutate(data);
    assert.throws(() => prepareDataset(data));
  }
});

test('converter validates before writing, creates private files and refuses existing output', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tichu6-dataset-test-'));
  const input = join(directory, 'input.json'),
    output = join(directory, 'dataset');
  const script = new URL('../scripts/prepare-training.mjs', import.meta.url);
  const run = () =>
    spawnSync(process.execPath, [script.pathname, input, output], {
      encoding: 'utf8',
    });
  try {
    writeFileSync(
      input,
      JSON.stringify({ schema: 1, sessions: [{ id: 'incomplete' }] }),
      { mode: 0o600 },
    );
    assert.notEqual(run().status, 0);
    assert.equal(existsSync(output), false);
    writeFileSync(input, JSON.stringify(fixture()));
    const summary = JSON.parse(
      execFileSync(process.execPath, [script.pathname, input, output], {
        encoding: 'utf8',
      }),
    );
    assert.equal(
      Object.values(summary.examples).reduce((a, b) => a + b, 0),
      2,
    );
    const files = ['train', 'validation', 'test'].map((name) =>
      join(output, `${name}.jsonl`),
    );
    const before = files.map((file) => readFileSync(file, 'utf8'));
    if (process.platform !== 'win32') {
      assert.equal(statSync(output).mode & 0o777, 0o700);
      for (const file of files)
        assert.equal(statSync(file).mode & 0o777, 0o600);
    }
    assert.notEqual(run().status, 0);
    assert.deepEqual(
      files.map((file) => readFileSync(file, 'utf8')),
      before,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
