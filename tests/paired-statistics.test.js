import assert from 'node:assert/strict';
import test from 'node:test';
import { pairedStatistics } from '../research/bots/paired-statistics.mjs';

test('bootstrap preserves mirrored dependence and treats ties explicitly', () => {
  const result = pairedStatistics(
    [
      [100, -100],
      [-200, 200],
    ],
    { resamples: 100 },
  );
  assert.deepEqual(result.meanMargin95, [0, 0]);
  assert.deepEqual(result.gameWinRate95, [0.5, 0.5]);
  assert.equal(result.pairTies, 2);
  assert.equal(result.gameTies, 0);
  assert.equal(result.gameWins, 2);
  assert.equal(result.gameLosses, 2);
});

test('paired statistics are deterministic and reject nonfinite or unpaired data', () => {
  const pairs = [
    [10, 20],
    [0, -10],
    [30, 10],
  ];
  assert.deepEqual(pairedStatistics(pairs), pairedStatistics(pairs));
  assert.equal(pairedStatistics(pairs).meanMargin, 10);
  for (const invalid of [
    [],
    [[1, 2]],
    [[1], [2]],
    [
      [1, NaN],
      [1, 2],
    ],
  ])
    assert.throws(() => pairedStatistics(invalid));
});
