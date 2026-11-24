# Bot research and gameplay datasets

## Research

See `research/bots/README.md` and its saved ledgers. The user superseded the
initial 100-round ceiling with a two-hour run. Results are synthetic, separate
from human examples. Candidates only inspect their own visible cards and public
information. Parameter comparison is not neural-network training and cannot
prove globally optimal Tichu play. Do not ship a candidate solely because it
wins on the deals used to choose it.

## Optional human records

The footer offers an unchecked-by-default collection preference, saved on that
browser. Disabling it stops future examples. The server associates consent with
the authenticated member, never with a supplied seat. Offline takeover examples
are labeled `bot`; local practice and non-consenting players are not recorded.
Older clients that send no consent field default to off.

An accepted decision stores the acting player's visible hand, public state,
normalized action, source, policy version and round outcome. Grand decisions
contain ten visible cards, never the eight-card reserve. No nickname, connection
token, identity hash, IP, room ID or room title appears in training records.
These records remain private and are excluded from all player/spectator views.

Records share an atomic persistence write with accepted game state, under a
separate `training-v1` storage key; existing `lounge` state remains compatible.
The private archive is capped at 80 KiB, 100 sessions and 2,000 events per session;
older sessions/events may be evicted earlier than the seven-day retention limit.
Truncated rounds are explicitly labeled. Only outcome-finalized rounds export.
This is a small free-tier collection buffer, not a permanent data warehouse.
Export regularly if you need a durable offline dataset. Forfeited/expired rounds
without outcomes are omitted. There may be little data on a lightly used server.

## Operator export

The route is disabled until an operator configures a secret of at least 32
characters using `wrangler secret put TRAINING_EXPORT_TOKEN`. Never put the value
in source, a VITE variable, a URL, a command-line argument or a public log.
Use a securely populated environment variable for the local exporter:

```sh
node scripts/export-training.mjs /private/tmp/tichu6-training-export.json
node scripts/prepare-training.mjs /private/tmp/tichu6-training-export.json /private/tmp/tichu6-training-dataset
```

`TRAINING_API` optionally selects a local Worker for testing. Export requires
HTTPS except localhost. Existing output files are never overwritten; new files
are private to their owner. Keep exported human records out of Git and public
artifacts. No scheduled download or paid storage service is enabled.

The converter outputs human-only train/validation/test JSONL with deterministic
80/10/10 assignment by anonymous match group. Export schema 2 includes a random
group ID shared by all rounds of one match, including reconnects. All decisions
and rounds from that match stay together; small datasets may leave a partition
empty. Schema 1 exports and old schema 2 records with a null group are accepted
for training only, never validation/test, because their match boundaries cannot
be recovered safely. This does not ensure player-level
independence because records intentionally contain no persistent player ID.
The converter validates and normalizes the entire input before writing, rejects
duplicate rounds/decisions and missing outcomes, and preserves truncation flags.
It requires a new output directory under an existing parent; it never merges or
overwrites a prior dataset. Unknown extra fields are omitted by the shared schema
projection. Keep batches together when checking for duplicates across exports.
Offline bot takeovers are excluded by default to avoid training on mislabeled
human behavior. Public observations plus private own-hand actions are suitable
for imitation learning; team score deltas/finish order support later evaluation.
No production human dataset has been exported or model trained by this change.

## Learned-policy experiments

User asked to consider JavaScript machine learning during the endurance run.
TensorFlow.js supports training/inference in Node and browsers; ONNX Runtime Web
supports JavaScript model deployment. Official references checked:
https://www.tensorflow.org/js/tutorials and
https://onnxruntime.ai/docs/tutorials/web/build-web-app.html.
Neither statement proves compatibility/latency on this project's Cloudflare
Worker: measure a small CPU-only prototype before adopting a runtime.

Separate E0 REINFORCE and E1 DMC experiments now train small neural action scorers
on locally generated decisions/outcomes; see `research/deep/README.md`,
`research/dmc/README.md` and `docs/BOT_LEARNING_PLAN.md`. The engine retains legality
and wish checks. The heuristic endurance ledger itself contains match summaries,
not neural training rows. No collected human data has trained either model.

Both models have passed local workerd inference/parity probes, which do not prove
production CPU limits, multi-room capacity or playing strength. Only a frozen
model that passes independent opponent/partner tests is eligible for adoption.
Human imitation alone can reproduce weak play. LLM analysis helps propose
strategies, but no per-turn LLM API or externally hosted model was added; see
`docs/LLM_MODEL_DECISION.md`.
