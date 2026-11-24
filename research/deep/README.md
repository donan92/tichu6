# Deep-learning pilot (E0)

This directory contains an exploratory TensorFlow.js REINFORCE policy. It is not
the production bot and is not the full DMC design in
[BOT_LEARNING_PLAN.md](../../docs/BOT_LEARNING_PLAN.md). Running jobs must keep
their original policy, opponent, reward and seed definitions.

`train.mjs` writes learned weights and round-level diagnostics under `run/`.
`validate.mjs` evaluates checkpoints on a small, fixed development set. The
training runner's latest-model holdout is separate from evaluation of the
validation-selected checkpoint. Optimizer/RNG state is not saved by this pilot.

After training, validation and heuristic endurance all successfully finish:

```sh
node research/bots/endurance-report.mjs
node research/deep/final-evaluate.mjs
```

The final evaluator first verifies the selected checkpoint hash, copies frozen
weights, and records source hashes and its seed manifest. It refuses to run
early or overwrite an existing final-evaluation directory. Do not remove that
directory to retry a chosen model on the same final test set.

Final evaluation uses 1,000 mirrored deck pairs for each of nine conditions:
model versus baseline/selected heuristic/declaring heuristic, model mixed teams
with one or two model seats, selected heuristic versus baseline/declaring
heuristic, and selected heuristic mixed teams with one or two candidate seats.
The declaring opponent uses fixed Large/Small thresholds5.5/7; its playing
strength is not assumed. Final calls are recorded to verify declaration coverage.
Each configuration uses the same new decks for comparison. Candidate seats
rotate in mixed teams; teammates use the baseline.
Bootstrap intervals resample whole mirrored pairs. These intervals describe
deck variance for one trained model, not reproducibility across training seeds.
Results are per-round points, not full-match wins or evidence of human teamwork.

`observation.mjs` and `actions.mjs` are E1 research helpers and are not wired into
the live E0 runner. The action oracle enumerates up to 2^18 subsets and must not
be called on the production Worker or UI path. It does not implement all game
phases or scheduling of off-turn bombs.

## Local Worker compatibility probe

`worker-benchmark.mjs` and `wrangler.benchmark.jsonc` are a separate, local-only
probe with no game bindings. Never deploy this benchmark. It uses the fixed
initial E0 checkpoint and synthetic feature rows, not user records or test-game
outcomes. Run Wrangler locally with this config and port18947, then
`node research/deep/check-worker-benchmark.mjs` to compare scores against Node.
The report lives at `run/worker-benchmark.json`.

The current probe passed Node/workerd prediction parity and stable retained
tensor counts. Dry-run bundle:2099KiB raw/411KiB gzip. Local amortized request
wall time was about1ms for64 candidates and7.1ms for512, with41,220 retained
tensor bytes. These are not production CPU/heap measurements, end-to-end game
latency, or a capacity guarantee. The current model has10,305 parameters;
larger models and complete action generation need new measurements.
