import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import * as tf from '@tensorflow/tfjs';
import { loadModel } from './policy.mjs';

const base = new URL(
  process.env.MODEL_BENCHMARK_API || 'http://127.0.0.1:18947',
);
assert.ok(
  base.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(base.hostname),
  'Local-only benchmark',
);
const modelPath = new URL(
  process.env.MODEL_BENCHMARK_CHECKPOINT || './run/initial-model.json',
  import.meta.url,
);
const model = await loadModel(fileURLToPath(modelPath));
const featureCount = model.inputs[0].shape.at(-1);
const measurements = [];
try {
  for (const rows of [1, 16, 64, 256, 512]) {
    const input = Array.from({ length: rows }, (_, row) =>
      Array.from(
        { length: featureCount },
        (_, column) => ((row * 7 + column * 3) % 17) / 17,
      ),
    );
    const expected = tf.tidy(() =>
      Array.from(model.predict(tf.tensor2d(input)).dataSync()),
    );
    const timings = [];
    let maxAbsoluteError = 0,
      tensorBytes,
      tensors;
    for (let trial = 0; trial < 8; trial++) {
      const iterations = trial === 0 ? 1 : 20;
      const url = new URL(`/?rows=${rows}&iterations=${iterations}`, base);
      const start = performance.now();
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200, await response.clone().text());
      const result = await response.json();
      const elapsed = performance.now() - start;
      assert.equal(result.backend, 'cpu');
      assert.equal(result.scores.length, rows);
      assert.equal(result.tensorsBefore, result.tensorsAfter);
      assert.equal(result.tensorsAfter, 8);
      for (let i = 0; i < rows; i++) {
        assert.ok(Number.isFinite(result.scores[i]));
        const error = Math.abs(result.scores[i] - expected[i]);
        maxAbsoluteError = Math.max(maxAbsoluteError, error);
        assert.ok(error < 1e-5, 'Node/workerd scores differ');
      }
      tensorBytes = result.tensorBytes;
      tensors = result.tensorsAfter;
      if (trial > 0) timings.push(elapsed / iterations);
    }
    timings.sort((a, b) => a - b);
    measurements.push({
      rows,
      iterationsPerRequest: 20,
      requests: timings.length,
      amortizedWallMsMedian: timings[Math.floor(timings.length / 2)],
      amortizedWallMsMax: timings.at(-1),
      maxAbsoluteError,
      tensorBytes,
      tensors,
    });
  }
  const report = {
    featureCount,
    parameters: model.countParams(),
    modelHash: createHash('sha256')
      .update(await readFile(modelPath))
      .digest('hex'),
    runtime: 'local workerd, TensorFlow.js CPU backend',
    limitations: [
      'Synthetic feature rows, not complete gameplay latency',
      'Local request wall time includes transport; not Cloudflare production CPU accounting',
      'Tensor bytes exclude runtime/native heap and transient allocations',
      'Does not prove free-tier capacity or multi-room responsiveness',
    ],
    measurements,
  };
  await writeFile(
    new URL(
      process.env.MODEL_BENCHMARK_OUTPUT || './run/worker-benchmark.json',
      import.meta.url,
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  model.dispose();
}
