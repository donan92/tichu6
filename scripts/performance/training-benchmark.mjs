// Same accepted decisions and timestamps on both implementations, no network.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { newGame, startRound, deck } from '../../src/game.js';
const [beforeDir, afterDir] = process.argv.slice(2);
const before = await import(
  pathToFileURL(path.resolve(beforeDir, 'server/training/records.ts'))
);
const after = await import(
  pathToFileURL(path.resolve(afterDir, 'server/training/records.ts'))
);
const state = startRound(newGame(), deck());
const record = after.prepareTrainingDecision(
  state,
  0,
  { type: 'grand', call: false },
  'human',
);
record.recordId = 'fixed';
const results = [];
for (let repeat = 0; repeat < 5; repeat++)
  for (const [label, api] of repeat % 2
    ? [
        ['after', after],
        ['before', before],
      ]
    : [
        ['before', before],
        ['after', after],
      ]) {
    global.gc?.();
    const initial = process.memoryUsage();
    const archive = api.createTrainingArchive();
    // Separate ownership: candidate freezing must not alter baseline fixtures.
    const seedRecord = structuredClone(record);
    const start = performance.now();
    for (let i = 0; i < 2000; i++)
      api.appendTrainingDecision(
        archive,
        'round' + Math.floor(i / 80),
        { ...seedRecord, revision: i },
        1000 + i,
      );
    const elapsed = performance.now() - start;
    const end = process.memoryUsage();
    const encoded = JSON.stringify(archive);
    results.push({
      label,
      repeat,
      elapsedMs: elapsed,
      heapUsedDelta: end.heapUsed - initial.heapUsed,
      serializedBytes: Buffer.byteLength(encoded),
      digest: createHash('sha256').update(encoded).digest('hex'),
    });
  }
assert.equal(
  new Set(results.map((r) => r.digest)).size,
  1,
  'retention/content semantics must match exactly',
);
console.log(
  JSON.stringify(
    {
      results,
      note: 'Identical 2000-decision bounded-archive workload, alternating order. Heap-used delta is affected by intervening GC; it is neither total allocation nor retained leak.',
    },
    null,
    2,
  ),
);
