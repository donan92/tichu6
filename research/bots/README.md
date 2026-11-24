# Bot improvement experiment

The user capped this research at 100 games. Count one completed round as one
game, a stricter bound than counting entire matches. No production load testing.

## Budget ledger

- Research games executed: 60 (all accepted moves; no illegal actions).
- Reserve 32 rounds for the required full test suite (20 engine + 12 bot rounds).
- Reserve 8 rounds for unexpected verification needs.
- Remaining research allocation: 0. Keep 32 full-suite rounds and 8 contingency rounds reserved.
- Machine-readable reservations/results: `ledger.json`; summary: `summary.json`.

Record each batch here before running it. A crashed/started game consumes a slot.
Do not run the complete test suite repeatedly without updating this ledger.

## Method

Freeze the v0.8.5 baseline in `baseline.js`. Use seeded decks, play each deck
twice with candidate team A then team B. Compare team score differential and
first-out rate, report per-pair results and decision latency. Reserve unseen
seeds for final validation; do not choose a policy using the held-out results.
Small samples are evidence of improvement, not proof of optimal play.

Cheap model agents review strategy and experiment design. Actual turns run the
local engine, avoiding paid model requests for every move and production model
dependencies. Policies must use only the acting player's visible cards and
public information; server access to hidden hands must not become an advantage.

## Pending

- Build bounded, reproducible paired runner and candidate strategy.
- Compare alternatives, consult agent critiques, validate chosen policy.
- Add bounded server recordings with no names, credentials or identity hashes;
  keep private training records out of public snapshots and the repository.
- Document retention, operator export and player-facing collection notice.
- Run mandatory checks and local Worker integration for recording changes.

## Results and selection

Two inexpensive gpt-5.6-luna reviewers proposed hand decomposition, conservative
calls and a lead-only hybrid. All three were tried on the same five mirrored
seeds (101–105), ten rounds each. Mean candidate minus baseline team points:
structure +42, calls −6, hybrid −9. Structure was selected for confirmation
before observing seeds 81001–81015 (30 additional mirrored rounds).

Confirmation: structure −4.67 points per round, paired standard error 10.46,
11 wins / 2 ties / 17 losses. First-out rate 63.3% did **not** translate to higher
team scores. Keep the baseline rather than shipping an unproven replacement.
This is a small bounded experiment, not proof that the baseline is optimal.
No model was trained on these results; these are offline heuristic candidates.

`node research/bots/report.mjs` regenerates summaries without playing games.
`node research/bots/run.mjs <variant> <seed> <pairs> <label>` reserves all requested
rounds before play and refuses to spend the reserved verification budget.
Do not clear the ledger or treat another invocation as a fresh 100-game budget.
The current runner must not be used for new batches during this goal.

## Superseding user authorization: two hours

On 2026-11-24 the user replaced the 100-game cap with two hours of continuous
simulation. The original ledger above is historical. `endurance.mjs 120` runs
full matches to 1000 points rather than individual rounds, with ten candidate
configurations and matched baseline opponents. New decks use SHA-256 counter
streams with rejection sampling (production randomness is unchanged).

The first 90 minutes compare candidates; the final 30 freeze one candidate for
fresh-seed confirmation. `endurance/status.json` records the actual process,
deadline, aggregates and terminal state; `endurance/results.jsonl` records each
mirrored pair. Check the live process before interpreting a saved status. Never
restart a live run. The runner refuses to overwrite an existing status file.

After successful completion, `node research/bots/endurance-report.mjs` checks
the append-only pair records against terminal totals and creates `report.json`.
It reports final team point differences per full match, paired bootstrap
intervals, game wins/ties/losses and pair wins/ties/losses. Development standings
and frozen-candidate holdout are separate. It does not play additional games.

Interpretation: the `calls-*` variants also use the candidate hand-decomposition
policy. They are not isolated tests of declarations against the original bot.
The original baseline never makes Large/Small Tichu declarations; candidate
success against it alone cannot prove good responses to human callers or other
declaration strategies. Keep those limitations in the final conclusions.
