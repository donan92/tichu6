# Server performance and Cloudflare cost optimization

Status: subsequently approved and released as **v0.8.45**; deployment IDs and
read-only live verification are in [STATUS.md](STATUS.md). Measurements below
preceded deployment and remain local-only, using the v0.8.44 baseline.
Baseline: main `c4c43d5`, fetched 2026-11-28. Worktree:
`/private/tmp/tichu6-performance`, branch `codex/server-performance`.
The unrelated research checkout and all its uncommitted files were preserved.
During optimization/benchmarking, no production requests, load, data changes,
configuration changes or plan upgrades were performed. The later authorized
release used only health/static-asset reads for live verification.

## Problems and changes

| Area               | Root cause                                                                                        | Implementation                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence        | Every save wrote the complete lounge and unchanged training archive together                      | `server/persistence/room.repository.ts` compares the committed lounge representation; training has a separate dirty marker and committed representation. Only changed keys enter the same atomic multi-key put. Markers advance only after success. Retention changes also mark training dirty.                                    |
| Training           | Unrelated moves serialized and rewrote up to 80 KiB of records                                    | `server/game/game.service.ts` marks the archive at append/finalize boundaries. No archive serialization on a clean save. Existing limits/consent/export rules stay intact.                                                                                                                                                         |
| Lounge alarm       | Repeated scheduling unconditionally set/deleted alarms                                            | `server/persistence/alarm.ts` lazily reads the stored alarm, caches null as well as timestamps, serializes changes, skips identical values and invalidates on errors. Alarm callbacks mark the consumed alarm absent.                                                                                                              |
| Engine alarm/cache | Every operation reread `last` and moved its expiry alarm                                          | `server/game/room-engine.ts` keeps the last successfully persisted result in memory. Results include an optional backwards-compatible `expiresAt`. Retain the earlier cleanup alarm; at that alarm, reschedule to the latest persisted expiry or delete expired data. Successful noncached operations retain their 24-hour expiry. |
| Broadcast          | Every move sent directory plus state/hall to every identity                                       | `server/room/snapshots.ts` compares the actual directory including count and personal `mine` flags. Room fingerprints include full game state and relevant metadata/presence, not revision alone. Only changed recipient snapshots are sent.                                                                                       |
| Bot decisions      | Schedule and execution reevaluated the same hand repeatedly, including repeated internal requests | `server/game/executor.ts` shares pending/completed decisions through a WeakMap keyed by state object, seat, room ID, revision and policy version. Failures evict the entry. Lifecycle and execution share this executor.                                                                                                           |
| Presence           | Each room scan repeatedly enumerated/deserialized every socket                                    | `server/transport/connections.ts` builds one presence index per refresh/schedule/broadcast pass. It is not retained across events.                                                                                                                                                                                                 |
| Event ordering     | Cached bot scheduling now awaits an internal request                                              | `server/lounge.ts` runs these schedule calculations through the existing concurrency gate so a stale asynchronous calculation cannot overwrite a newer alarm.                                                                                                                                                                      |

No rules, scores, bot policy, admitted capacities, turn/grace intervals, protocol
message shapes, identity authentication or spectator privacy were changed.
The shared game engine source is unchanged.

## Architecture before and after

Both versions use Pages → Worker → Lounge Durable Object → per-room RoomEngine
Durable Objects. Lounge remains the authoritative coordinator for membership,
sockets, deadlines and committed game snapshots. This is not full room sharding.

Before: action → engine → write both lounge/training → broadcast all recipients
→ recalculate bots → unconditionally rewrite alarm.

After: action → engine (same persist-before-return transition) → atomic write of
changed lounge/training keys → send changed personalized views → reuse a valid
bot decision → update alarm only when required. Engine cleanup uses its persisted
expiry instead of updating its alarm on every request.

Caches are disposable optimizations. On restart, storage remains authoritative;
new sockets and cold objects receive complete state. No cache contains a public
cross-user hand view. Snapshot caches use weak socket keys; bot caches use weak
state keys and at most six seat entries per state. Engine cache holds one result.
No production polling timer or interval was introduced.

## Measurement method

The historical 807 moves / P95 307.72 ms result is context only, not a baseline
for this change. Fresh baseline and candidate copies run the same local harness.
Host: macOS 27.0.1 arm64, Node.js 25.6.0, locked Wrangler 4.166.0;
repository CI independently uses Node.js 26. This is one developer machine,
not a controlled Cloudflare hardware benchmark.

- `scripts/performance/prepare.mjs` copies source to a temporary directory and
  injects counters into that copy only. Neither production entrypoint nor config
  imports the instrumentation. It counts Storage API calls, logical keys and JSON
  bytes written, alarm callbacks, internal engine requests, actual bot evaluations,
  broadcasts, incoming messages and successful outgoing messages/UTF-8 bytes.
- `scripts/performance/load.mjs` uses real WebSockets and real local Workers/SQLite.
  The client rejects non-local destinations. 20/50/100 identities occupy 4/10/20
  rooms with five humans and one bot. Each round continues into the next round;
  completed matches are replaced locally for the long soak. Each run reconnects
  20 identities simultaneously after its measurement window.
- `scripts/performance/run.mjs` starts one fresh local Worker at a time with fresh
  persistence. It samples process-group CPU/RSS every five seconds. These include
  Wrangler/workerd overhead and are not V8 heap or Cloudflare CPU/Duration metrics.
- Crypto shuffling is unchanged, so hands are not identical. Repeated runs expose
  variation; compare per-second and per-accepted-move counts as well as totals.
  Latency includes the existing 20 ms client polling interval. Percentiles are
  within-run samples, not a claim about internet or physical-device latency.
- Setup and reconnect traffic are outside the measured gameplay window. Latency
  samples begin after initial exchange and measure gameplay play/pass. Preparation
  is checked separately, including later rounds. The workload is paced at one
  second per room loop; throughput is not the saturated server capacity.
- Test-only one-hour no-op timers prevent metrics from disappearing on object
  eviction. They apply equally to both variants and **must never be deployed**.
  Consequently these load runs do not measure hibernation efficiency or billable
  Duration. Recovery/idle tests run separately without instrumentation or timers.
- Metrics also serialize write values to estimate byte volume. That adds test-only
  overhead, especially to the write-heavy baseline. Process resources and latency
  are diagnostic comparisons, not calibrated Cloudflare measurements.
- Between candidate repeats, only the failed-operation path was hardened to
  invalidate the engine warm cache and reload a potentially committed result.
  Successful measured workloads did not take that path; the final retry regression
  additionally covers a put that commits and then rejects.
- A repeated 100-user run failed during setup because a bot advanced the revision
  between two human preparation requests. No gameplay window was measured. The
  client now retries only setup stale-state errors and checks the actual requested
  readiness/exchange effect. Gameplay errors remain fatal. The failed run is not
  counted as a performance result.
- The initial pilot permitted counter loss on engine eviction. Its operation
  totals are excluded; the corrected fixture was rerun against pristine main.

Reproduction (no credentials required):

```sh
mkdir /tmp/pristine-main
git archive c4c43d5 | tar -x -C /tmp/pristine-main
(cd /tmp/pristine-main && npm ci)
node scripts/performance/prepare.mjs /tmp/pristine-main /tmp/perf-before
node scripts/performance/prepare.mjs . /tmp/perf-after
node scripts/performance/run.mjs /tmp/perf-before /tmp/results/before-1
node scripts/performance/run.mjs /tmp/perf-after /tmp/results/after-1
# Repeat as before-2 / after-2, using fresh persistence.
PERF_CASES=100 PERF_CONSENT=true node scripts/performance/run.mjs /tmp/perf-after /tmp/results/consent-after
PERF_CASES=20 PERF_HUMANS=1 node scripts/performance/run.mjs /tmp/perf-after /tmp/results/bots-after
PERF_CASES=100 PERF_SECONDS=1800 node scripts/performance/run.mjs /tmp/perf-after /tmp/results/soak-after
node scripts/performance/summarize.mjs /tmp/results docs/performance-results.json
node scripts/performance/restart.mjs
```

## Quantitative results

Special cases: consent-* = 100 humans / 20 rooms, all recording enabled; bots-* = 20 humans / 20 rooms / 100 bots; soak-after = 100 humans / 20 rooms, continued matches. Normal cases use five humans + one bot per room.

All counts below are local measurements. Normal before/after rows total two independent 120-second runs; percentile ranges show those runs separately (not pooled percentiles). Special scenarios have one run. Full exact samples/counters are in [performance-results.json](performance-results.json).

| Case / users       | Seconds | Human play/pass | Moves/s |    P50 ms |    P95 ms |      P99 ms | Max ms |
| ------------------ | ------: | --------------: | ------: | --------: | --------: | ----------: | -----: |
| before 20          |   240.7 |             366 |    1.52 | 21.7–21.7 | 22.7–22.7 |   41.6–42.3 |   42.4 |
| before 50          |   241.2 |             835 |    3.46 | 22.4–39.2 | 43.1–43.3 |   61.6–62.2 |   81.5 |
| before 100         |   241.9 |           1,579 |    6.53 | 42.1–42.3 | 66.4–66.8 | 181.9–203.4 |  328.3 |
| after 20           |   240.5 |             348 |    1.45 | 21.9–21.9 | 22.8–22.9 |   22.9–23.1 |   23.2 |
| after 50           |   241.3 |             809 |    3.35 | 21.6–21.8 | 40.7–42.4 |   42.8–43.3 |   44.0 |
| after 100          |   241.0 |           1,641 |    6.81 | 21.2–21.4 | 42.1–42.1 |   61.0–65.2 |  103.4 |
| bots-after 20      |   120.4 |             102 |    0.85 | 21.5–21.5 | 42.1–42.1 |   60.2–60.2 |   61.7 |
| bots-before 20     |   120.5 |             106 |    0.88 | 41.4–41.4 | 61.8–61.8 |   62.6–62.6 |   82.1 |
| consent-after 100  |   120.5 |             797 |    6.61 | 21.9–21.9 | 43.3–43.3 |   81.0–81.0 |  122.5 |
| consent-before 100 |   121.0 |             783 |    6.47 | 42.6–42.6 | 80.3–80.3 | 205.8–205.8 |  328.0 |
| soak-after 100     |  1800.9 |          10,681 |    5.93 | 40.8–40.8 | 63.3–63.3 |   66.4–66.4 |  106.3 |

Storage API calls and logical writes (a multi-key put is one call but multiple keys):

| Case / users       | get / getAlarm | put calls | Lounge / training / engine keys | setAlarm / deleteAlarm | Modeled key + alarm rows |
| ------------------ | -------------: | --------: | ------------------------------: | ---------------------: | -----------------------: |
| before 20          |        622 / 0 |     1,007 |                 444 / 444 / 563 |                991 / 0 |                    2,442 |
| before 50          |      1,407 / 0 |     2,237 |               948 / 948 / 1,289 |              2,166 / 0 |                    5,351 |
| before 100         |      2,548 / 0 |     4,119 |           1,719 / 1,719 / 2,400 |              4,010 / 0 |                    9,848 |
| after 20           |          0 / 0 |       965 |                   430 / 0 / 535 |                257 / 0 |                    1,222 |
| after 50           |          0 / 0 |     2,140 |                 907 / 0 / 1,233 |                663 / 0 |                    2,803 |
| after 100          |          0 / 0 |     4,277 |               1,778 / 0 / 2,499 |              1,331 / 0 |                    5,608 |
| bots-after 20      |          0 / 0 |     1,413 |                 176 / 0 / 1,237 |                159 / 0 |                    1,572 |
| bots-before 20     |      2,020 / 0 |     1,462 |               180 / 180 / 1,282 |              1,456 / 0 |                    3,098 |
| consent-after 100  |          0 / 0 |     2,097 |               872 / 843 / 1,225 |                672 / 0 |                    3,612 |
| consent-before 100 |      1,294 / 0 |     2,068 |               863 / 863 / 1,205 |              2,006 / 0 |                    4,937 |
| soak-after 100     |          0 / 0 |    30,474 |             12,838 / 0 / 17,636 |             10,373 / 0 |                   40,847 |

`storage.delete` and `storage.deleteAll` counts are available in the JSON (normally zero within these sub-24-hour gameplay windows). Room removal updates the lounge value; it is not a Storage API delete. Actual billed SQLite rows are not measured.

| Case / users       | Engine requests | Broadcast calls | WS messages | WS MB (decimal) | Bot computations | Alarm callbacks |
| ------------------ | --------------: | --------------: | ----------: | --------------: | ---------------: | --------------: |
| before 20          |             622 |             444 |      17,760 |           27.83 |              678 |              62 |
| before 50          |           1,407 |             948 |      94,800 |          218.33 |            3,595 |              42 |
| before 100         |           2,548 |           1,719 |     343,800 |         1199.41 |           11,931 |              31 |
| after 20           |             535 |             430 |       3,910 |            6.54 |               78 |              62 |
| after 50           |           1,233 |             907 |      13,225 |           30.37 |              178 |              41 |
| after 100          |           2,499 |           1,778 |      39,785 |          160.21 |              360 |              34 |
| bots-after 20      |           1,237 |             176 |       1,690 |            6.43 |              560 |              68 |
| bots-before 20     |           2,020 |             180 |       7,200 |           25.62 |            3,782 |              68 |
| consent-after 100  |           1,225 |             872 |      19,730 |           79.50 |              178 |              16 |
| consent-before 100 |           1,294 |             863 |     172,600 |          600.98 |            6,490 |              18 |
| soak-after 100     |          17,636 |          12,838 |     343,340 |         1432.91 |            2,446 |             184 |

| Users              | Key-write reduction/move | Key + alarm reduction/move | setAlarm reduction/move | WS reduction/move | Bot reduction/move |
| ------------------ | -----------------------: | -------------------------: | ----------------------: | ----------------: | -----------------: |
| 20                 |                    30.1% |                      47.4% |                   72.7% |             76.8% |              87.9% |
| 50                 |                    30.7% |                      45.9% |                   68.4% |             85.6% |              94.9% |
| 100                |                    29.5% |                      45.2% |                   68.1% |             88.9% |              97.1% |
| 100, consent on    |                     1.5% |                      28.1% |                   67.1% |             88.8% |              97.3% |
| 20, five bots/room |                    10.6% |                      47.3% |                   88.7% |             75.6% |              84.6% |

Targets are evaluated per accepted human play/pass because random hands change the workload. **Data-key writes alone do not reach 40%**: each accepted transition still requires the authoritative lounge commit and the durable engine retry result. Removing those would weaken durability. **With recording enabled, even the combined row proxy misses the 40% target** because accepted training records really change; preserving those writes is required. The combined key/alarm row proxy is distinct from put-call count or physical SQLite I/O. Broadcast invocation count is largely unchanged; redundant sends and view construction are suppressed. Warm get/getAlarm counts of zero are not a prediction for cold production objects.

| Case / users       | Mean sampled process CPU % (run range) | Peak process-group RSS MiB |
| ------------------ | -------------------------------------: | -------------------------: |
| before 20          |                                7.4–7.5 |                      594.7 |
| before 50          |                                9.1–9.4 |                      673.5 |
| before 100         |                              21.7–22.1 |                      824.5 |
| after 20           |                                6.4–7.1 |                      613.9 |
| after 50           |                                8.5–9.3 |                      676.9 |
| after 100          |                              12.1–12.2 |                      822.8 |
| bots-after 20      |                                6.9–6.9 |                      657.9 |
| bots-before 20     |                                6.9–6.9 |                      626.0 |
| consent-after 100  |                              11.8–11.8 |                      809.8 |
| consent-before 100 |                              22.6–22.6 |                      814.8 |
| soak-after 100     |                              16.1–16.1 |                      900.3 |

CPU/RSS includes local Wrangler/workerd processes, not just one DO or V8 heap. Instrumentation keeps actors resident, so this is not production memory accounting or a proof that all leaks are absent. Setup sampling and normal OS contention add uncertainty.

| Case / users       | Retained value KiB (run range) | Local SQLite/WAL/SHM MiB (run range) |
| ------------------ | -----------------------------: | -----------------------------------: |
| before 20          |                      68.1–73.5 |                            13.4–14.6 |
| before 50          |                    157.4–176.0 |                            27.0–27.1 |
| before 100         |                    312.0–354.8 |                            45.1–45.7 |
| after 20           |                      49.2–72.5 |                            10.3–11.8 |
| after 50           |                    168.9–170.7 |                            19.9–21.1 |
| after 100          |                    342.5–343.7 |                            35.9–38.2 |
| bots-after 20      |                    187.9–187.9 |                            33.5–33.5 |
| bots-before 20     |                    211.8–211.8 |                            43.7–43.7 |
| consent-after 100  |                    424.9–424.9 |                            36.6–36.6 |
| consent-before 100 |                    395.6–395.6 |                            45.8–45.8 |
| soak-after 100     |                  1922.2–1922.2 |                            93.6–93.6 |

Storage is read from the stopped local fixture after client teardown: retained `_cf_KV` value lengths and file sizes for Lounge/RoomEngine only. No keys, credentials or values are exported. WAL/SHM and allocated SQLite pages are local implementation overhead, not billed Cloudflare storage. These retained bytes are not cumulative write bytes; short samples do not bound 24-hour room churn or growing match histories.

## Cloudflare cost model

Official pricing checked 2026-11-28:
[Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
Use the detailed DO documentation's SQLite allowance (5 million reads/day), not
an inconsistent marketing overview.

| Dimension      | Free            | Paid included/month; excess       |
| -------------- | --------------- | --------------------------------- |
| DO requests    | 100,000/day     | 1 million; $0.15/million          |
| DO Duration    | 13,000 GB-s/day | 400,000 GB-s; $12.50/million GB-s |
| SQLite reads   | 5 million/day   | 25 billion; $0.001/million        |
| SQLite writes  | 100,000/day     | 50 million; $1/million            |
| SQLite storage | 5 GB            | 5 GB-month; $0.20/GB-month        |

Paid starts at $5/month. Incoming WebSocket messages use the 20:1 request billing
ratio; outgoing messages have no request charge. Internal engine calls and alarms
count as requests. `setAlarm` writes a row. KV-method calls here use the SQLite
backend, **not** the legacy KV backend's 4 KiB billing units. Duration uses 128 MB
per active object; overlapping requests within an object are not summed. Hibernation
eligibility matters. Free excess operations fail rather than creating a paid bill.

`performance-results.json` and `scripts/performance/summarize.mjs` preserve all
inputs and formulas. Model assumptions:

1. 30-day month; the sampled workload remains constant for 2 or 24 active hours/day.
   One initial connection per identity and 20 reconnects/day; no other account traffic.
2. Request proxy = internal engine calls + alarm invocations + incoming messages/20.
3. Write proxy = logical keys written + setAlarm + deleteAlarm. Read proxy = get +
   getAlarm. These are code/API estimates, **not observed billed SQL rows**. Internal
   metadata, cleanup/churn and provider coalescing can differ. No actual SQL query
   statistics or Cloudflare billing metrics were collected.
4. Duration is explicitly hypothetical: 1%, 10%, or 100% active duty across Lounge
   plus the room engines, at 0.128 GB/object. Local runtime and response latency
   are never substituted for billable Duration. The same duty assumption is used
   before/after; no unmeasured Duration savings are claimed.
5. Storage stays under 5 GB-month; Worker connection traffic stays within its
   included request/CPU allowance. Static Pages assets are outside game operation
   counts. Taxes, exchange rates, other services and paid observability are excluded.
6. Excess DO dimensions are rounded up to the published billing unit. Cleanup after
   24 hours and real room churn require additional margin beyond this steady model.

<!-- COST_TABLES_START -->

For the stated assumptions and **training consent disabled**, estimated daily usage and monthly USD are below. Arrows mean before → after. Free remains $0 but stops at a quota; it does not charge the paid estimates. These are forecasts, not an account bill.

| Users / active hours per day |   DO requests/day | Read proxy/day |       Write proxy/day | Monthly USD at 1% duty |          At 10% |           At 100% |
| ---------------------------- | ----------------: | -------------: | --------------------: | ---------------------: | --------------: | ----------------: |
| 20 / 2h                      |   21,051 → 18,432 |     18,609 → 0 |       73,059 → 36,580 |          $5.00 → $5.00 |   $5.00 → $5.00 |     $5.00 → $5.00 |
| 20 / 24h                     | 252,176 → 220,740 |    223,307 → 0 |     876,713 → 438,958 |          $6.05 → $5.90 |   $6.05 → $5.90 |   $31.05 → $30.90 |
| 50 / 2h                      |   44,568 → 39,285 |     41,998 → 0 |      159,723 → 83,625 |          $5.15 → $5.15 |   $5.15 → $5.15 |     $5.15 → $5.15 |
| 50 / 24h                     | 534,041 → 470,654 |    503,972 → 0 | 1,916,670 → 1,003,496 |         $15.40 → $7.10 |  $15.40 → $7.10 |   $65.40 → $57.10 |
| 100 / 2h                     |   79,229 → 78,245 |     75,836 → 0 |     293,106 → 167,539 |          $5.30 → $5.30 |   $5.30 → $5.30 |   $17.80 → $17.80 |
| 100 / 24h                    | 949,424 → 937,616 |    910,034 → 0 | 3,517,276 → 2,010,469 |        $65.20 → $20.20 | $77.70 → $32.70 | $152.70 → $107.70 |

The JSON separates base fee, request, read, write, storage and each Duration component. Storage is assumed within the included 5 GB-month; it is not derived from cumulative bytes written. Duration assumptions are identical before and after, so only measured operation-rate differences affect the projected savings.

| Users / hours | Duration GB-s/day at 1% / 10% / 100% active duty |
| ------------- | -----------------------------------------------: |
| 20 / 2h       |                                 46 / 461 / 4,608 |
| 20 / 24h      |                             553 / 5,530 / 55,296 |
| 50 / 2h       |                             101 / 1,014 / 10,138 |
| 50 / 24h      |                         1,217 / 12,165 / 121,651 |
| 100 / 2h      |                             194 / 1,935 / 19,354 |
| 100 / 24h     |                         2,322 / 23,224 / 232,243 |

| Users | Write-quota hours/day before → after | Request-quota hours/day before → after |
| ----- | -----------------------------------: | -------------------------------------: |
| 20    |                          2.74 → 5.47 |                           9.52 → 10.87 |
| 50    |                          1.25 → 2.39 |                            4.49 → 5.10 |
| 100   |                          0.68 → 1.19 |                            2.53 → 2.56 |

These threshold times omit setup/churn/metadata overhead and other account use. Duration, reads or storage can be the earlier limit. Keep at least 20% headroom: consider owner-approved Paid service when projected daily writes exceed 80,000 or DO requests exceed 80,000, or actual Duration approaches 10,400 GB-s/day. No plan was changed. Connection count alone cannot establish a free operating guarantee; bot-heavy workloads and room churn can cost more.

**Training consent matters:** the UI defaults new visitors to consent enabled. The normal cost table above uses the explicitly opted-out benchmark, so it must not be treated as the default-user forecast. The following code-derived upper bound adds one training-key write to every lounge write where it was absent; it holds workload/request/Duration assumptions fixed. The actual 100-person consent-enabled run is shown separately.

| Users / hours | After: training-on upper write rows/day | Upper monthly USD at 10% duty | Upper write-quota hours/day |
| ------------- | --------------------------------------: | ----------------------------: | --------------------------: |
| 20 / 2h       |                                  49,452 |                         $5.00 |                        4.04 |
| 20 / 24h      |                                 593,420 |                         $5.90 |                        4.04 |
| 50 / 2h       |                                 110,684 |                         $5.15 |                        1.81 |
| 50 / 24h      |                               1,328,210 |                         $7.10 |                        1.81 |
| 100 / 2h      |                                 220,657 |                         $5.30 |                        0.91 |
| 100 / 24h     |                               2,647,883 |                        $51.70 |                        0.91 |

| Observed consent-enabled 100 users / hours | Write rows/day before → after | DO requests/day before → after | Monthly USD at 10% duty before → after |
| ------------------------------------------ | ----------------------------: | -----------------------------: | -------------------------------------: |
| 100 / 2h                                   |             293,783 → 215,790 |                80,522 → 76,641 |                          $5.30 → $5.30 |
| 100 / 24h                                  |         3,525,400 → 2,589,482 |              964,946 → 918,375 |                        $77.70 → $49.55 |

<!-- COST_TABLES_END -->

## Correctness and regression coverage

- Repository: unchanged saves, separate training writes, expiry pruning, failure
  and retry of an atomic multi-key save; no move state acknowledgement on failed save.
- Alarm: cached null, identical timestamp, serialized concurrent updates, failures,
  callback consumption, reconstructed instances and earlier-only engine scheduling.
- Engine: persist-before-return, same transition after reconstruction, invalid action,
  isolation between two actors, alarm-failure repair and no early expiry deletion.
- Bot: same-state reuse, seat/room/revision invalidation and failed-request retry.
- Snapshots: unchanged broadcast silence; changes delivered only to affected room;
  deadline-only update without revision bump; watcher hand/code privacy; `mine`
  personalization, retry after failed socket delivery and full refresh after reconstruction.
- Real local Worker flow/idle tests preserve declaration/exchange timeout, Dog/Mahjong
  cancellation, Dragon target authorization, offline/reconnect grace and expiry.
- `scripts/performance/restart.mjs` stops the entire local Worker, restarts it with
  the same SQLite directory and authenticates the same identity; seat, hand, private
  invite and original preparation deadline must match.

Final local check, format check and production build pass; 178 unit tests and
110 UI tests pass (288 total). No frontend or shared-rule implementation changed.

The candidate's 100-person, 20-room soak passed for 1,800.94 seconds: 10,681
accepted human play/pass actions, minimum 466 per room, all 100 sockets retained,
and 20 simultaneous reconnects succeeded afterward. P95 was 63.31 ms, P99 66.42 ms,
maximum 106.27 ms. This longer workload is not paired with a 30-minute baseline;
the before/after comparisons above use the repeated 120-second cases.

Soak process-group RSS rose from 811.9 to 890.3 MiB (peak 900.3 MiB). Successive
five-minute mean samples were 812.0, 840.8, 852.7, 861.5, 871.6 and 880.9 MiB.
Retained values totaled 1.88 MiB afterward, versus roughly 0.33 MiB in the short
100-user candidate runs. Histories grow across rounds, and the measurement fixture
keeps actors resident; GC high-water marks and local runtime overhead are also
possible contributors. **No memory-stability or leak-free claim is made.** A real
isolate heap profile and history bounds remain a P1 follow-up before larger loads.

## Remaining bottlenecks, risks and next work

1. **P1: whole lounge serialization/commit.** Complete JSON comparison still walks
   the lounge on each save. Per-room dirty records would reduce bytes but need an
   explicit schema/atomicity design and migration. Do not replace this with a timer
   or assume revision alone covers presence, admission and deadlines.
2. **P1: coordinator concurrency gate.** Rules requests, persistence and scheduling
   remain serialized. Relaxing the gate without room/identity reservations could
   break admission, revisions and retry ordering. Full ownership sharding is outside
   this task. Measure actual Cloudflare CPU/Duration with owner authorization next.
3. **P2: directory and room fingerprints.** All rooms are still traversed to identify
   changes, but unchanged recipient views are not built/sent. A future explicit
   mutation index could skip the traversal after all mutation sites are covered.
4. **P2: training archive size enforcement.** Existing append paths clone and may
   repeatedly serialize a bounded 80 KiB archive. Optimize with byte accounting or
   bounded per-session records only with retention/validation regressions.
5. Bot cache validity relies on engine state replacement or revision increments
   for rule-relevant mutations. Clock/presence updates do not affect `botAction`.
   Future rule inputs must preserve that contract. Failed decisions are not cached.
6. Memory caches trade bounded per-live-socket/state memory for fewer computations.
   Weak keys allow collection; arbitrary dynamic IDs do not grow a global strong map.
   Process RSS cannot prove absence of all leaks; inspect long-run trend separately.
7. Storage failure retains dirty state for retry and suppresses acknowledgement;
   it does not invent success or discard accepted state. Existing error handling
   and persist-before-broadcast ordering remain. Engine idempotency is still the
   existing last-request model, not a new unlimited historical request ledger.
8. **P1: room churn / history bounds.** Twenty simultaneously live rooms do not
   bound the number of old RoomEngine objects retained for 24 hours. Rapid room
   creation/forfeit can accumulate disposable caches. Add a separately designed
   creation budget or reliable room-deletion cleanup before increasing traffic.
   Match score/trick histories also grow with rounds; the existing log cap does
   not cap every history array. Archiving/truncation needs a product/restore design,
   not silent loss of match history in this optimization.
9. Actual Cloudflare hibernation timing, quotas, regional latency and mobile clients
   were not tested against production. Local process restart validates persistence,
   not every possible provider eviction/cancellation interleaving.

## Rollback and delivery safety

No schema migration; the authorized release metadata advanced to v0.8.45.
`lounge`, `training-v1`, and engine `last` keys
remain compatible. An older engine ignores optional `expiresAt`; pending cleanup
alarms still remove only its disposable transition cache. Roll back by reverting
this commit and, **only after separate release approval**, deploying the previous
Worker. Never delete live room data. The frontend bundle is unchanged.

Repository automation contains only the Verify workflow, with local checks and no
release command. The review commit uses a **`[CF-Pages-Skip]` prefix** so Pages also
skips automatic preview builds, per
[Cloudflare GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/).
The initial submission was Draft PR #5 without deployment. After explicit owner
approval, it was merged and released as v0.8.45. Automatic Cloudflare Pages remained
Idle, so the verified dist was deployed manually; do not confuse GitHub Pages
success with Cloudflare serving the new build. No paid-plan change was made.
