# Deep Monte-Carlo pilot

This directory is an isolated research pilot. It is not imported by the
frontend, Worker, practice game, or production bot. The runner uses the
policy contract in `policy.mjs`:

```js
makeModel(seed);
decide(model, state, seat, rng, epsilon, publicHistory);
trainBatch(model, optimizer, samples, delta);
saveModel(model, path);
loadModel(path);
```

The pilot maintains three independent models (seeds 101, 202, and 303),
round-robins their training rounds, and alternates self-play with matched play
against the frozen baseline. Training decks use independent deterministic
streams per model seed. It learns only from candidate decisions returned by
`decide`; grand, exchange, and trick collection actions remain baseline actions.
Each round retains at most 32 reservoir samples and trains against the actual
terminal team delta; a missing terminal delta fails the run. The policy receives
a bounded (last 128 events) public history. Accepted play entries contain only
the played cards' rank/suit/special attributes after the move succeeds; no card
IDs or exchange choices are retained. Opponent hands, tokens, rooms, and private
server state are never passed to the policy. The raw engine state is still
passed to the policy adapter today, so strict own-hand/public projection remains
a follow-up boundary to enforce in `policy.mjs`.

Normal mode stops at the active endurance deadline minus 15 minutes. Training
decks use separate `dmc-training-v1:<model-seed>` namespaces. Validation uses
exactly 32 mirrored seeds in the `dmc-validation-v1` namespace; these are pilot
validation seeds, not final tests. Validation runs at round 1, every 500 rounds,
and final. Each model gets independent policy RNG and optimizer state. Latest
checkpoints are saved every 25 rounds plus initial/final; validation-best
checkpoints include their round, mean, and artifact hash. Weight hashes,
artifact hashes, counters, PID, and errors are written with atomic status files.

The runner deliberately does not serialize optimizer state or exact RNG state,
so it refuses to resume an existing output directory. A stopped run completes
its current round before writing `stopped`. It has a 2,000-move round guard.

Warm-start imitation is disabled: the runner does not invent targets from
baseline actions. This is a small DMC pilot, not a GRU, not full-stage training,
and not a replacement for the suit-aware exhaustive action oracle. The current
policy contract still determines the candidate action set and model features.

Do not modify or restart the E0 jobs. This isolated pilot shares only the
remaining time in their original experiment window. To perform a separate smoke
run, use a distinct output directory and namespace:

```sh
node research/dmc/train.mjs --smoke --rounds=3 --out=research/dmc/smoke-run
```

Smoke mode never uses the production training or pilot validation seed ranges.
Normal mode requires an active endurance deadline and refuses an existing status.
The initial model has221 features and53,249 parameters (128→128→64→1). Public
card-history counts are normalized by physical deck multiplicity, not by sequence
length. Independent-model and retained-tensor tests guard unintended coupling.

## Local inference probe

`worker-benchmark.mjs` uses a separate frozen copy at
`run/runtime-probe-model.json`; never point it at continuously changing weights.
It shares the local-only benchmark runtime with E0. The generic checker accepts
`MODEL_BENCHMARK_CHECKPOINT=../dmc/run/runtime-probe-model.json` and
`MODEL_BENCHMARK_OUTPUT=../dmc/run/worker-benchmark.json`.

Local workerd predictions matched Node exactly; retained tensors stayed8
(212,996 bytes). Median amortized request wall times were3.8ms for64 rows and
29.7ms for512. These are synthetic batches, not production CPU or full-game
latency. Dry-run bundle was2323KiB raw/578KiB gzip. No deployment was made.
A separate10,000-hand deterministic sample of the current representative action
generator found41/88/114 lead candidates at median/p95/max. This is not an
exhaustive worst-case bound; full suit-aware enumeration may yield more actions.

`final-evaluate.mjs` is a separate sealed evaluator. It refuses to run until
the DMC pilot, original E0, and endurance jobs are complete, verifies every
validation-best artifact hash, freezes all three artifacts, and chooses the
primary model only by validation-best mean (ties go to the lower seed). It
creates a new directory and uses sealed namespaces `dmc-final-v1` and
`dmc-final-secondary-v1` with seeds 820000000–820000999. Stage A evaluates all
three models against baseline with 1,000 mirrored pairs. The primary must have
mean margin at least 10 and a 95% lower bound above zero before Stage B runs;
failure skips Stage B and never promotes another model from final-test scores.
Stage B compares the primary with the selected heuristic, the 5.5/7 declaring
heuristic, and one/two-seat baseline mixtures. Per-pair deltas, calls, finish
orders, manifests, hashes, and atomic progress are retained. This evaluator is
not launched automatically and must never feed results back into training.
