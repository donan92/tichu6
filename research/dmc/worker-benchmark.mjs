import frozen from './run/runtime-probe-model.json';
import { createBenchmark } from '../deep/worker-benchmark-runtime.mjs';

export default createBenchmark(frozen);
