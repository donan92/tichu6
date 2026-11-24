// LOCAL RESEARCH ONLY. No game binding, player data, credentials or deployment.
import * as tf from '@tensorflow/tfjs';
export function createBenchmark(initial) {
  let pendingModel;
  async function initialize() {
    await tf.setBackend('cpu');
    await tf.ready();
    const bytes = Uint8Array.from(atob(initial.weightData), (char) =>
      char.charCodeAt(0),
    );
    return tf.loadLayersModel(
      tf.io.fromMemory({ ...initial, weightData: bytes.buffer }),
    );
  }
  return {
    async fetch(request) {
      const url = new URL(request.url);
      if (!['localhost', '127.0.0.1'].includes(url.hostname))
        return new Response('Local benchmark only', { status: 403 });
      const rows = Number(url.searchParams.get('rows') ?? 16);
      const iterations = Number(url.searchParams.get('iterations') ?? 1);
      if (
        !Number.isInteger(rows) ||
        rows < 1 ||
        rows > 512 ||
        !Number.isInteger(iterations) ||
        iterations < 1 ||
        iterations > 100
      )
        return new Response('Invalid benchmark dimensions', { status: 400 });
      const model = await (pendingModel ??= initialize());
      const before = tf.memory();
      let scores;
      for (let i = 0; i < iterations; i++) {
        scores = tf.tidy(() => {
          const input = tf.tensor2d(
            Array.from({ length: rows }, (_, row) =>
              Array.from(
                { length: model.inputs[0].shape.at(-1) },
                (_, column) => ((row * 7 + column * 3) % 17) / 17,
              ),
            ),
          );
          return Array.from(model.predict(input).dataSync());
        });
      }
      return Response.json({
        backend: tf.getBackend(),
        rows,
        iterations,
        scores,
        tensorsBefore: before.numTensors,
        tensorsAfter: tf.memory().numTensors,
        tensorBytes: tf.memory().numBytes,
      });
    },
  };
}
