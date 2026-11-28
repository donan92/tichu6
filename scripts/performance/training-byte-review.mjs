// Local differential oracle; imports a supplied baseline checkout, never a service.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { newGame, startRound, deck } from '../../src/game.js';
const baseline = process.argv[2];
if (!baseline)
  throw Error(
    'Usage: node scripts/performance/training-byte-review.mjs BASELINE_DIRECTORY',
  );
const before = await import(
  pathToFileURL(path.resolve(baseline, 'server/training/records.ts'))
);
const after = await import('../../server/training/records.ts');
const stringify = JSON.stringify;
const encoder = new TextEncoder();
const encode = TextEncoder.prototype.encode;
const counts = [
  { calls: 0, bytes: 0, encodes: 0 },
  { calls: 0, bytes: 0, encodes: 0 },
];
function measured(index, fn) {
  JSON.stringify = (...args) => {
    const value = stringify(...args);
    counts[index].calls++;
    counts[index].bytes += value === undefined ? 0 : Buffer.byteLength(value);
    return value;
  };
  TextEncoder.prototype.encode = function (...args) {
    counts[index].encodes++;
    return encode.apply(this, args);
  };
  try {
    return fn();
  } finally {
    JSON.stringify = stringify;
    TextEncoder.prototype.encode = encode;
  }
}
const record = before.prepareTrainingDecision(
  startRound(newGame(), deck()),
  0,
  { type: 'grand', call: false },
  'human',
);
const apis = [before, after];
let archives = apis.map((api) => api.createTrainingArchive());
const outcome = {
  scores: [100, 200],
  delta: [100, 200],
  finish: [1, 3, 5],
  winner: 1,
};
for (let i = 0; i < 3000; i++) {
  const now = 1000 + i + (i >= 2000 ? after.TRAINING_RETENTION_MS : 0);
  const session = i < 1000 ? 'single' : 's' + (Math.floor(i / 13) % 20);
  const returns = apis.map((api, index) =>
    measured(index, () => {
      const event = structuredClone(record);
      event.recordId =
        i % 149 === 0
          ? 'x'.repeat(after.TRAINING_MAX_BYTES * 2)
          : `event-${i}-한😀"\\`;
      event.revision = event.publicState.revision = i;
      const result = api.appendTrainingDecision(
        archives[index],
        session,
        event,
        now,
        i % 17 === 0 ? null : 'group',
      );
      if (i % 23 === 0)
        api.finalizeTrainingSession(archives[index], session, outcome, now + 1);
      if (i % 71 === 0)
        archives[index] = api.loadTrainingArchive(archives[index], now);
      return result;
    }),
  );
  assert.equal(returns[0], returns[1], `return at ${i}`);
  assert.equal(
    stringify(archives[0]),
    stringify(archives[1]),
    `archive at ${i}`,
  );
  assert.deepEqual(
    before.exportTrainingArchive(archives[0], now),
    after.exportTrainingArchive(archives[1], now),
  );
  assert.ok(
    encoder.encode(stringify(archives[1])).length <= after.TRAINING_MAX_BYTES,
  );
}
console.log(
  JSON.stringify(
    {
      operations: 3000,
      checks: 'return/archive/export/byte-cap equivalent after every operation',
      before: counts[0],
      after: counts[1],
      reduction: 1 - counts[1].bytes / counts[0].bytes,
      scope:
        'training mutation and loader JSON only; excludes repository, storage payload, export and oracle checks; not Cloudflare billing',
    },
    null,
    2,
  ),
);
