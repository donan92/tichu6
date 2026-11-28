# Training byte accounting — Phase 1

Implemented on `codex/training-byte-accounting`, based on main
`f9a228988fe4d90713552086545fb89ef27dec05` (v0.8.48). Released in v0.8.49 via PR #13; deployment details are in STATUS.md.

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
is not a constant-time archive index. The initial patch cached lengths only; the v0.8.50 follow-up also caches each event JSON fragment, with the same weak lifetime. No whole archive string is retained by this cache.

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

## Post-release local Worker check (2026-11-28)

After v0.8.49 deployment, sequential localhost-only 100-identity /20-room cases
ran for at least 120 seconds, with recording enabled and five humans plus one
bot per room. The ordinary fixture and load harness were reused; random deals
were not seeded. All cases include twenty final simultaneous reconnects.
The harness polls every 20ms, so measured latency is not pure server CPU.
No production load or private export was used.

The first baseline startup failed because its extracted checkout had no
node_modules link. It was stopped and rerun after fixing the disposable fixture;
it contributes no successful workload data. This exposed an unbounded health
fetch in the test runner. The follow-up adds a one-second per-request timeout,
early child-exit detection and safe cleanup of an already-exited process group.
A deliberately missing local configuration now exits with a clear readiness
error. Syntax and zero-warning ESLint checks passed. This tooling change is not
part of deployed v0.8.49.

### Serialization regression and correction

The first implementation froze events but left repository JSON.stringify on the
full frozen graph. A post-release benchmark including append, repository-style
serialization and structuredClone found about 246ms baseline versus 306ms for
v0.8.49. The Worker was rolled back to the v0.8.48 version without changing data.
The earlier append-only speedup was real but insufficient evidence for overall
persistence preparation performance.

The correction caches each immutable event's JSON as well as its byte length.
Repository dirty comparison uses an exact JSON fragment assembly: property order,
omitted undefined fields and escaping still follow JSON.stringify. The value
passed to storage remains the same object; atomic multi-key put and retry dirty
flags remain unchanged. Oracle tests compare assembled JSON byte-for-byte after
metadata changes, Unicode, cold load and pruning. Weakly-held fragment strings add
memory roughly proportional to retained event JSON (within the existing bounded
archive, plus transient/referenced events); they are not an unbounded ID cache.

The reproducible benchmark now accepts `--persistence` to include comparison
serialization and a structuredClone storage proxy. Five alternating repeats:
median 256.200ms baseline versus 117.787ms correction (54.02% lower), identical
final archive digest. This proxy is not an actual Cloudflare storage implementation.

Instrumented local Worker runs (100 users, recording on, 120s each) all passed
functional/reconnect checks but had variable P95: baseline 22.78 and 60.87ms;
v0.8.49 40.42 and 61.33ms. Deals were unseeded and storage instrumentation itself
serializes frozen graphs. These measurements do not establish a latency regression
or improvement; they motivated the controlled full-path benchmark above. The
corrected candidate also needs a functional run without storage-byte instrumentation.
No billing reduction, fixed-seed Worker latency target or long-soak pass is claimed.
