# Training byte accounting — Phase 1

Implemented on `codex/training-byte-accounting`, based on main
`f9a228988fe4d90713552086545fb89ef27dec05` (v0.8.48). Not merged or deployed.

## Scope

Keep `training-v1`, its object representation, repository comparisons,
commit-before-broadcast ordering, alarm behavior and all retention/export rules.
No migration, chunk persistence, dirty-generation redesign or new dependency.
The 80 KiB cap remains global to the Lounge archive, not per session or room.

`server/training/bytes.ts` caches UTF-8 sizes of immutable decisions in a WeakMap.
A decision's complete graph is frozen on first accounting, including an attempted
append that is subsequently rejected. Producers already create owned snapshots;
callers must replace/clone a decision rather than edit an archived event. Session
containers, metadata and event arrays remain mutable. Nested freezing prevents
silently stale cache values; weak keys do not retain removed events.

For each session, encode its metadata with an empty events array, then add cached
event lengths and array separators. Compute the archive envelope in the same way.
During byte-cap pruning, subtract the removed session and separator, or apply the
changed single-session size delta. Metadata is re-encoded to cover optional
fields, null, Unicode/escaping, numeric widths, outcome and truncated precisely.
Session/event lengths are still summed per enforcement (bounded O(events)); this
is not a constant-time archive index. No full JSON value is added to the cache.

## Verified local evidence

Baseline source was extracted with `git archive` to `/tmp/tichu-byte-baseline`.
All inputs are synthetic; no production traffic or data was used.

- Differential workload: 3,000 operations with single/multiple sessions,
  oversized decisions, rejected group changes, completion, cold normalization and
  seven-day clock advancement. Return value, exact archive JSON and export agree
  after every operation; byte cap holds throughout.
- Mutation/loader JSON bytes: 325,591,039 → 9,554,664 (**97.07% decrease**).
- JSON/UTF-8 calls: 3,972 → 22,379. More tiny metadata encodings replace large
  archive encodings; fewer calls is not the claimed benefit.
- Separate alternating-order 2,000-append benchmark, five repeats: median
  87.043 ms → 11.422 ms (**86.88% lower**). Final archive SHA-256 is identical:
  `36ffa00abc50e95c6638bccf27296bfd923570e837f15b24cdfd5917f369af2d`.
  Each repetition owns its fixture graph; candidate freezing cannot affect the
  baseline. Timing is local Node performance, not Worker P95 or billed CPU.
- Regression tests cover the JSON.stringify/TextEncoder oracle, Unicode including
  lone surrogates, omitted/null fields, time widths, outcome/truncated mutations,
  nested immutability, failed storage writes and cold repository restoration.

The byte metric excludes repository serialization, storage payload and export/oracle
checks. The differential tool instruments JSON and encoder calls only inside
training operations; it is never imported by the Worker. Existing storage payload
and logical writes are unchanged. **No SQLite row, storage-space, DO duration or
Cloudflare bill reduction is claimed.** No two-hour/24-hour load or physical-device
test has been repeated for this patch. The full-archive repository serialization
and Lounge serialization remain follow-up bottlenecks.

## Integration checks

Passed 189 unit +112 UI tests (301 total), ESLint/frontend and server type checks,
formatting, production build, real local Worker SQLite restart, idle and flow
suites. Local Worker execution needed sandbox escalation after an initial startup
timeout; the rerun passed. No production requests were made.

## Reproduce

```sh
node scripts/performance/training-byte-review.mjs /tmp/tichu-byte-baseline
node --expose-gc scripts/performance/training-benchmark.mjs /tmp/tichu-byte-baseline .
node --test tests/training-bytes.test.js tests/training.test.js tests/stability.test.js
```

## Rollback and next decision

Revert the Phase 1 code; existing `training-v1` is directly readable by v0.8.48.
Do not delete storage. No release version change is included.

Before considering V2, measure repository and actual Worker latency separately.
Any chunk experiment must retain atomic Lounge/game/training commits, forward and
reverse migration, global 80 KiB semantics and full accounting of metadata/deletes.
The current result supports retaining the simpler V1 layout for now.
