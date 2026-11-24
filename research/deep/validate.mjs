// Separate validation-only monitor. Never updates weights or reads final-test seeds.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { deck, newGame, startRound, act, team } from '../../src/game.js';
import { botAction as baseline } from '../bots/baseline.js';
import { loadModel, decide } from './policy.mjs';
const directory = new URL('./run/', import.meta.url);
await mkdir(directory, { recursive: true });
const deadline =
  Date.parse(
    JSON.parse(await readFile(new URL('status.json', directory), 'utf8'))
      .deadline,
  ) -
  15 * 60000;
const state = {
  status: 'running',
  pid: process.pid,
  seedRange: [600000000, 600000015],
  checkpoints: [],
  best: null,
};
const path = new URL('validation.json', directory);
async function save() {
  await writeFile(
    new URL('validation.tmp', directory),
    JSON.stringify(state, null, 2),
  );
  await rename(new URL('validation.tmp', directory), path);
}
function cards(seed) {
  const result = deck();
  let count = 0;
  for (let i = 107; i > 0; i--) {
    let x,
      bound = Math.floor(4294967296 / (i + 1)) * (i + 1);
    do {
      x = createHash('sha256')
        .update(`deep-validation:${seed}:${count++}`)
        .digest()
        .readUInt32LE(0);
    } while (x >= bound);
    const j = x % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
async function evaluate() {
  const snapshot = await readFile(new URL('latest-model.json', directory));
  const hash = createHash('sha256').update(snapshot).digest('hex');
  if (state.checkpoints.some((c) => c.hash === hash)) return;
  const snapshotPath = new URL('validation-candidate.json', directory);
  await writeFile(snapshotPath, snapshot);
  const model = await loadModel(fileURLToPath(snapshotPath));
  const margins = [];
  try {
    for (let seed = 600000000; seed < 600000016; seed++) {
      const pair = [];
      for (const t of [0, 1]) {
        let s = startRound(newGame(), cards(seed)),
          moves = 0;
        while (!['roundEnd', 'matchEnd'].includes(s.phase)) {
          if (++moves > 2000) throw Error('Nonterminating validation');
          const seat =
            s.phase === 'grand'
              ? s.ready.findIndex((x) => !x)
              : s.phase === 'exchange'
                ? s.exchanges.findIndex((x) => !x)
                : s.phase === 'trick'
                  ? s.last
                  : s.turn;
          s = act(
            s,
            seat,
            team(seat) === t
              ? decide(model, s, seat, () => 0, false).action
              : baseline(s, seat),
          );
        }
        pair.push(s.delta[t] - s.delta[1 - t]);
      }
      margins.push((pair[0] + pair[1]) / 2);
    }
  } finally {
    model.dispose();
  }
  const mean = margins.reduce((a, b) => a + b, 0) / margins.length;
  const result = { hash, mean, margins, at: new Date().toISOString() };
  state.checkpoints.push(result);
  if (!state.best || mean > state.best.mean) {
    state.best = result;
    await writeFile(new URL('best-validation-model.tmp', directory), snapshot);
    await rename(
      new URL('best-validation-model.tmp', directory),
      new URL('best-validation-model.json', directory),
    );
  }
  await save();
  console.log(
    JSON.stringify({
      checkpoints: state.checkpoints.length,
      mean,
      best: state.best.mean,
    }),
  );
}
await save();
try {
  while (Date.now() < deadline) {
    await evaluate();
    await new Promise((r) =>
      setTimeout(r, Math.min(600000, Math.max(0, deadline - Date.now()))),
    );
  }
  state.status = 'complete';
  await save();
} catch (error) {
  state.status = 'failed';
  state.error = String(error);
  await save();
  throw error;
}
