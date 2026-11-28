# Project status / resume point

## v0.8.46 deployed (2026-11-28)

- User authorized deployment of player Hand/Won totals and current-trick starter.
- Release metadata and bilingual player-facing note updated together.
- Final release check, lint, frontend/server types, 182 unit +112 UI tests,
  formatting and production build pass. Local Worker integration/flow and
  four responsive viewport checks are recorded below.
- PR #6 merged as `5ff8b809e6216735740abaf88282e5526e3b084e` after CI passed
  (including real local Worker integration, idle and full game-flow suites).
- Backend deployed first: Worker `911edd78-017d-474a-bff4-05454b81d4e4`,
  confirmed at 100% traffic; public health returned ok (version 6 is protocol).
- Cloudflare Git build remained Idle; verified dist deployed explicitly to Pages
  production `a9b75083-c3d5-469b-89ea-d77364cbf994` from the merge commit.
- Live tichu6.pages.dev HTML, JS `index-DWsSrC5w.js` and CSS
  `index-XyXl1Ql4.css` match local build bytes; JS includes v0.8.46.
- Production checks were read-only health/static requests, not live game or load
  tests. Stored rooms, capacity, game rules and privacy unchanged.
- Rollback: previous Worker `cc232b67-fc3b-4001-8a92-d1889513ad57` and Pages
  `a0e2dc69-fe61-411c-b422-3c73445f1d57` (v0.8.45). New optional state metadata
  remains backward-compatible; do not delete room storage.

## Player card counts and trick starter — implemented locally, not deployed (2026-11-28)

- Approved visual: name-adjacent Pass badge, side-by-side Hand/Won totals.
  Branch `codex/player-captured-counts` in `/private/tmp/tichu6-performance`.
- Added optional public `capturedCounts` to shared and server views, containing
  counts only, not card identities or scores. Unknown older-server counts show
  a dash. Counts follow actual captured piles, including Dragon donation, and
  reset each round. No rules, version or production changes.
- Bilingual labels, active/dark colors, retained bot/offline/declaration status.
  Real local Vue screenshots at390/1200/834/320px passed horizontal overflow checks,
  including English dark mode and108-card totals. Long names truncate with title.
  These are desktop browser viewport checks, not physical-phone verification.
- Check, format, build and182 unit +112 UI tests pass; real local Worker admission,
  privacy, counts, bots and reconnect integration passes.
- Approved starter badge added below counts, alongside bot/offline/call metadata.
  Pass remains beside the name. Persisted optional `trickStarter` records the first
  actual play, survives overcalls/bombs/pass/finishing/reconnect and clears on
  collection/round end. Dog transfer waits for the recipient's actual first play.
  Older saved rooms recover from the first current-trick log entry only when its
  player name resolves uniquely; unknown history is not guessed from current top.
- Starter regression tests cover serialized restoration, older-state fallback,
  passed/finished starters, bomb takeover, Dog, new tricks/rounds and bilingual UI.
  Actual Vue screenshots with simultaneous Led/Passed badges passed the same
  four viewport overflow checks, including dark mode. Source game rules unchanged;
  only public display metadata added. Final real local Worker flow suite passed
  (preparation, reconnect clocks, Dragon collection, Dog cancellation and privacy).
- Future release needs backend before frontend for the added public fields.

## v0.8.45 server optimization — deployed (2026-11-28)

- Owner approved release of PR #5; squash merged as `dba72ec`. Original research
  checkout and unrelated changes preserved. Version/lockfile/release notes and both
  locales updated together with the maintenance note. No rule/schema/capacity or
  paid-plan changes; no room reset or production load test.
- Final release check/lint/types, 178 unit +110 UI tests, format and build passed.
  PR Verify46099274387 and merged-main Verify46099569091 passed. Earlier real
  local Worker and capacity/soak results remain recorded below.
- Backend deployed first: `cc232b67-fc3b-4001-8a92-d1889513ad57` at100% via
  `npm run deploy:server`. Previous rollback version:
  `09f0a1d0-4f13-4e5e-9550-0505f52ddf62`. Existing immediate update policy retained.
- Cloudflare Pages production: `a0e2dc69-fe61-411c-b422-3c73445f1d57`, main source
  `dba72ec`. The automatic entry remained Idle and the public origin still served
  the old build, so the tested dist was deployed explicitly with Wrangler Pages.
  GitHub Pages run46099569048 is a separate service, not Cloudflare deploy evidence.
- Read-only live verification: tichu6.pages.dev HTML, JS and CSS match local dist
  bytes; JS contains0.8.45. Worker health200 with ok=true/protocol6. No production
  room creation or gameplay smoke mutations; actual-device testing not performed.
- `docs/PERFORMANCE_OPTIMIZATION.md` retains measured savings, missed targets,
  cost assumptions and memory/history follow-ups. Production billing/Duration
  remain unmeasured. Do not infer a free-quota guarantee from successful deployment.

## Server performance optimization — initial review evidence (2026-11-28)

- Isolated worktree `/private/tmp/tichu6-performance`, branch
  `codex/server-performance`, based on latest main `c4c43d5` (rechecked before PR).
  Original research checkout and unrelated uncommitted changes preserved.
- Implemented changed-key atomic persistence and separate training dirty tracking,
  deduplicated alarms with restart/failure handling, persisted engine expiry and
  ambiguous-commit retry repair, per-socket changed-only snapshots, shared weak bot
  decision caching and per-pass presence indexing. Rules/privacy/timers unchanged.
- Fresh local baseline and candidate: 20/50/100 identities, 120 seconds each, twice
  per variant. Separate consent-enabled 100-person and 20-person/100-bot cases
  passed before/after. Each case includes 20 simultaneous identity reconnects.
- Paired 100-person results per accepted human move: WS sends -88.9%, setAlarm
  -68.1%, bot calculations -97.1%, data-key writes -29.5% (40% target missed).
  Combined key/alarm proxy -45.2%; consent-enabled proxy -28.1% (also misses40%).
  P95 66.4–66.8ms → 42.1ms. These are local API measurements, not billed SQL rows.
- Candidate 100-person/20-room soak passed 1,800.94 seconds, 10,681 human moves,
  minimum466/room, all100 connections and20 simultaneous reconnects. P95 63.31ms.
  Process RSS increased811.9→890.3MiB, peak900.3MiB. This includes instrumentation
  and runtime overhead; heap profiling/history bounds remain P1, not proven fixed.
- Final `npm run check`, `npm test` (178 unit +110 UI), `npm run format:check`,
  `npm run build` passed. Audit found0 vulnerabilities. Real local Worker server,
  flow, idle and process-restart suites passed: capacity races, privacy, bots,
  reconnect/grace, special cards, expiry and SQLite state restoration.
- `docs/PERFORMANCE_OPTIMIZATION.md` records architecture, quantified results,
  official-pricing assumptions, Free/Paid scenarios, missed goals, risks and rollback.
  Sanitized machine results: `docs/performance-results.json`. Reproducible scripts:
  `scripts/performance/`. Raw synthetic logs remain `/tmp/tichu-perf-results`.
  Initial counter-eviction pilot and a setup stale-revision failure were excluded;
  setup retry verifies effect; gameplay errors remain fatal. All tests are local.
- The default UI enables training consent; consent-off forecasts are explicitly
  separated. At the measured 100-person consent-on workload, even2h/day exceeds
  the estimated Free write allowance. Duration assumptions are not measurements.
- Review-only commit uses `[CF-Pages-Skip]` to suppress Pages preview deployment;
  GitHub Verify contains no deploy step. No version bump, main merge, production
  access/data/config change, deployment or paid-plan upgrade. Task-owned servers
  stopped. Next: review Draft PR; obtain separate approval before any release.

## v0.8.44 100-person production capacity — deployed

- User requested a new domain and an initial 100-person production capacity.
  Isolated worktree `/private/tmp/tichu6-production-100` preserves research/UI WIP.
  Rebased onto deployed278ac07; retains v0.8.43 private invites and room engines.
- Server admits100 identities including spectators/hall,20 rooms,120 transport
  sockets including handshake/reconnect headroom. Existing throttles, deadlines,
  storage schema and credential handling preserved. Bilingual UI/error text,
  room-creation button, README and policy updated together.
- Broadcast computes directory once and reuses room presence across recipients;
  private hands/membership remain personalized. Regression checks cover private
  data, per-recipient mine flags, spectator counts and disconnect presence.
- Final check,171 unit+110 UI tests,format and build pass. Real local Worker
  100/101 admission,20/21 room race,full-capacity reconnect,bots,privacy,forfeit,
  private invite,clock/idle and internal engine route tests pass.
- Final v0.8.44 local load:100 sockets,20 active rooms,one bot per room,120seconds,
  807 accepted human moves,min34/room,20 concurrent reconnects,all100 remained
  connected. Response p50 43.34ms,p95 307.72ms,max332.24ms includes client polling.
  This is not production latency or a long soak/free-quota guarantee.
- Earlier test attempts caught test-client auto-collect/revision races and dev
  reload socket loss. Fixed client to await server collection and assert continuous
  socket presence; final test ran against unchanged source/fresh local storage.
- Chrome375px preview showed capacity text fitting; header/footer notes open and
  Escape dismisses. Existing favicon.ico404 observed; no app-runtime error seen.
  Initial UI preview preceded rebase; merged UI/component checks pass. Physical
  iPhone/Samsung verification not performed.
- Domain candidate tichu6.com RDAP404; Cloudflare published com registration and
  renewal$11.17/year,not a reserved domain/final checkout quote. Browser remains
  signed out; login and owner purchase approval required. No purchase/paid upgrade.
  docs/PRODUCTION.md records rollout,origin-bound guest credentials and rollback.
- Released34da3ae to main. Worker09f0a1d0-4f13-4e5e-9550-0505f52ddf62
  deployed; health ok/protocol6. Pages45994488567 and Verify45994489558
  passed, including latest private-flow/idle suites. Production HTML/JS/CSS match
  local tested bytes. Single live WebSocket admission verified; no live load test.
  Task-owned local servers stopped. Existing research/UI checkout left intact.
- Remaining blocker is domain ownership/login/purchase approval only. No custom
  origin enabled for an unowned domain; no paid-plan change.100-person admission
  is live on the existing Pages URL; sustained quota/real-device limits above remain.

## v0.8.43 private rooms and per-room engine execution — deployed

- Private creation, six-character cryptographic invites, code-entry native modal,
  and fragment-based invitation link copy/consume implemented. All room members
  may copy; outsiders/directory never receive codes. Server blocks private
  spectating and direct-ID bypass, retains global limits and identity-based resume.
  Durable per-identity code attempts prevent reconnect resetting the throttle.
- ROOM_ENGINES/v3 introduces one internal engine DO per room UUID for deal/action/
  bot execution and persisted idempotent results. Existing rooms are preserved.
  IMPORTANT: Lounge still owns sockets, clocks and authoritative snapshots; this
  is compute isolation, not full room-ownership sharding or a capacity increase.
  See docs/PRIVATE_ROOMS.md for remaining full-sharding requirements.
- 170 unit + 109 UI tests pass. Real local Worker capacity, idle and flow suites
  pass with the new binding; flow includes invite/privacy/reconnect/no-public-
  engine-route checks. Local Chrome 320/820px modal checked, no page overflow;
  native focus/clipboard/fragment tests pass. Physical phones unverified.
- User approved v0.8.43 release. check, 279 tests, format and build passed.
  Worker 2fc4369c-1159-49f8-b936-62ec265d2023 deployed with v3/ROOM_ENGINES;
  health ok/protocol6. Main a699769 released; Pages 45992494526 and Verify
  45992495188 succeeded including capacity/idle/private-flow integration.
  Production HTML/JS/CSS byte-match the tested v0.8.43 build. No production
  room deletion/migration or live capacity tests performed.

## v0.8.42 Phoenix sound and Dog recipient feedback — deployed

- Phoenix in a new played combination uses the existing Dragon effect; own-turn
  and round-end cue priority stays unchanged. No new audio assets.
- Accepted Dog plays persist a public dogTransfer marker for the selected teammate,
  even if their finished seat passes the next turn onward. Same five-second
  recipient flash as Dragon, with bilingual Dog label. Initial/resumed snapshots
  do not trigger it; cloned snapshots do not restart it.
- check, 167 unit + 106 UI tests, format and build passed. Added accepted marker,
  public privacy, Phoenix single/combination, and Dog animation regression coverage.
  Real local Worker flow suite passed. No physical-device verification.
  User-approved release 4a74198 is on main. v0.8.42 release checks passed.
- Worker 28ce83c9-17a4-49de-9cdc-83aa6f40c419 deployed; health ok/protocol6.
  Pages 45936580422 and Verify 45936580628 succeeded including Worker/idle/flow
  CI. Production HTML/JS/CSS byte-match the tested build.

## v0.8.41 music and opening-turn changes — deployed

- User approved wall-clock modulo playback. Independent sessionStorage anchors
  for lobby/game survive reloads. Music starts at elapsed seconds modulo decoded
  duration after loading; effects unchanged. Storage denial and invalid/future
  anchors fall back safely. Existing interruption/gesture recovery remains.
- check, 166 unit + 104 UI tests, format and build passed. Tests verify modulo
  wrap, mute/unmute, independent tracks, explicit output restart, store recreation
  (reload), future timestamps and blocked storage. Actual iPhone listening not
  verified. Includes pending opening-minute and timer placement changes below;
  v0.8.41 release checks passed; user-approved deployment completed.
- Main d432d0f released. Worker 25af2250-82f2-4f27-8e51-0c48641aada9
  deployed; health ok/protocol6. Pages 45841362726 and Verify 45841364414
  succeeded including local Worker/idle/flow integration. Production HTML, JS
  and CSS byte-match the tested v0.8.41 build. Actual iPhone listening remains
  unverified. No live-room mutation for testing.

## Turn clock placement and opening minute — included in v0.8.41

- Moved the main TurnClock into GameControls immediately before the turn message;
  retained extension, warning, reconnect display and modal timers.
- Shared clock gives the post-exchange Mahjong holder 60 seconds while nobody
  has played; ordinary subsequent turns remain 30 seconds. Pending Dog selection
  keeps its own 30 seconds, declaration/reconnect rules remain unchanged.
  Existing persisted deadlines are not restarted. Updated bilingual rules.
- check, 166 unit + 102 UI tests, format and build passed; local Worker flow
  passed. Tests cover initial minute, restore stability, later ordinary turns
  and DOM clock placement. Chrome fixtures at 390/1024px show the clock above
  the turn message without overflow. No physical-phone test; deployed in v0.8.41.

## v0.8.40 tablet action width — deployed

- Root cause: desktop horizontal .controls flex layout let the message consume
  width while the nested action row shrank. Hand controls now stack and stretch
  at every breakpoint; action labels cannot wrap. Tablet primary actions have
  56px minimum height and 20px text. Small Tichu remains below the hand.
- check, 266 tests, format and build passed. Local Chrome fixtures at widths
  390/768/820/1024/1180/1366 have full-row Pass and no horizontal overflow.
  At 1024px: Pass 960x56; selected-card Pass/Play 476x56 each. Inspected
  screenshot /tmp/tablet-pass-fixed.png. Not physical tablet verification.
- User approved release, including Small Tichu placement correction below.
  v0.8.40 check, 266 tests, format and build passed.
- Main f747f1f deployed. Pages 45838938830 and Verify 45838939281 succeeded,
  including local Worker/idle/flow CI. Production HTML/JS/CSS byte-match the build.
  Frontend only; Worker unchanged, health ok/protocol6.

## Small Tichu below hand — included in v0.8.40

- Keep primary actions above the cards; move only Small Tichu below HandCards
  for exchange/play/trick. One declaration control uses the existing confirmation
  handler via a DOM target; eligibility and pending lock remain unchanged.
- check, 165 unit + 101 UI tests, format and build passed. Regression checks
  exchange/play placement and disappearance after first play. Local Chrome at
  320px confirms button below the hand with no horizontal overflow. No real
  iPhone verification; released with v0.8.40 above.

## v0.8.39 hand-top actions — deployed

- Removed the redundant hand-count heading and moved GameControls above HandCards.
  Own turn with no selection shows full-width Pass; ordinary selection shows
  equal-width Pass/Play. Selected bombs show only full-width Play, including
  out-of-turn bombs. No normal Play button while waiting on another player.
- Existing confirmation, special-card dialogs and Small Tichu remain available.
- check, 165 unit + 100 UI tests, format:check and build passed. Regression covers
  selection/clear/turn/bomb transitions and controls-before-hand ordering.
  Local Chrome fixture: 390px ordinary action widths 181px each, 320px bomb
  action 300px with no Pass, 320/1280px no horizontal overflow. No real-phone
  test. User-approved v0.8.39 released in 79cd4e3.
- Pages 45836651334 and Verify 45836651785 succeeded, including Worker/idle/flow
  CI. Live HTML/JS/CSS byte-match the tested build. Backend unchanged at
  ec461e0c-536c-4b5f-bd76-470ad8566407; health ok/protocol6.

## v0.8.38 empty room expiry — deployed

- Persist emptySince when the last human player disconnects. Bots and spectators
  do not count; progress does not extend the ten-minute empty-room deadline.
  A player reconnect clears it, and a later disconnect starts a new interval.
- Alarm scheduling includes emptySince + 10 minutes. Expiry removes the room
  and returns spectators to the lounge; existing 30-minute stalled-room cap remains.
  Older stored rooms get a baseline on first presence refresh, not immediate deletion.
- 165 unit + 99 UI tests passed, including exact expiry boundary, spectator/bot
  exclusion, restored persistence and reconnect/reset. check, format and build
  passed; local Worker idle/flow passed.
- Main a7cd951 released. Worker ec461e0c-536c-4b5f-bd76-470ad8566407
  deployed successfully; health ok/protocol6. Pages 45808945068 and Verify
  45808945181 succeeded. Live HTML/JS/CSS match v0.8.38 build.
  No production clock manipulation or forced deletion; ten-minute expiry was
  verified locally, not by waiting on an occupied production room.

## v0.8.37 guide typography and special-card centering — deployed

- Shared semantic typography tokens: guide summary 18px, subsection 16px bold,
  body/list 16px with 1.7 line-height, caption 14px. Removed rule-only 14px
  paragraphs and scoring-only spacing; all guides inherit GuidePanel rhythm.
- Dragon/Phoenix keep their existing scale. CSS compensates asymmetric
  transparent sprite padding using alpha bounds measured in each 384px cell:
  Dragon x76..333/y33..355, Phoenix x65..313/y38..360.
- check, 163 unit + 99 UI tests, format:check and build passed.
  Actual local Chrome at 320/390/1280px confirmed guide body/list 16px,
  no horizontal page overflow at 320/1280; inspected mobile guide screenshot
  and a CSS card fixture. No physical iPhone test.
- Commit 5ce88ae released to main. v0.8.37 release:check/check, 262 tests,
  format:check and build passed. Pages 45806428324 and Verify 45806429264
  succeeded, including local Worker/idle/flow integration. Production HTML,
  JS and CSS byte-match the tested build. Worker health ok/protocol 6;
  frontend-only release, backend unchanged.

## v0.8.28 clear turn chime — deployed

- Uses the exact approved MP3 sample. The local turn alert takes priority over
  the preceding play/pass, including entry from exchange and trick collection.
  Other players retain action cues; initial/skipped snapshots remain silent.
- check, all 155 unit + 92 UI tests, format:check and build passed.
- Commit2981406 deployed to a72d8caa.tichu6.pages.dev. Production HTML, JS
  and turn MP3 byte-match the tested build. Worker health is ok/protocol6.
- No backend changes. Physical iPhone listening remains unverified.

## v0.8.27 pass swoosh and Safari resume — deployed

- User requests a short pass swoosh and reports silence after switching from
  another app back to iPhone Safari. Replaced pass.mp3 with a short filtered
  paper-swish edit of the original card recording; no runtime synthesis.
- Pass now takes priority over the own-turn cue, including the final pass into
  trick collection. Repeated/initial snapshots remain silent.
- Recovery now observes visibility, pageshow/pagehide, focus and AudioContext
  state changes. Foreground resume waits for a pending suspend, discards stale
  attempts and times out a stuck resume. A subsequent trusted touch/click can
  recreate an interrupted context; the modal exposes Resume sound when needed.
- Tests reproduce interruption without a visibility event, suspend/resume races,
  permanently pending resume and gesture recovery. This is not physical iPhone
  confirmation; real-device listening and app-switch testing remain required.
- Validation: check,155 unit +91 UI tests,format:check and build passed.
  Pass MP3 decodes cleanly with peak-15.01dBFS. Frontend only; backend unchanged.
  Real iPhone app-switch verification remains outstanding.
- Commit2fb1265 is on main. Cloudflare production1d55ea97.tichu6.pages.dev
  serves HTML/JS/CSS and pass MP3 identical to the tested build. Production
  browser shows0.8.27 and the modal/preview without errors. Worker health
  remains ok/protocol6; no server deploy or live-room changes.
- Verify45653380812 passed through local Worker and idle checks; final flow
  verification was still running at this documentation update.

## v0.8.26 audio files — deployed

- User reports crackling on iPhone and requests audio files rather than code
  synthesis. The exact device-specific cause is not established; no claim that
  file conversion alone proves an iPhone fix.
- Exported the approved arrangements and revised cues once on the development
  machine, encoded18 local MP3 assets at44.1kHz (2.91MB total). Original exported
  PCM has0 clipped samples. Removed all runtime oscillators/noise generation and
  OfflineAudioContext code. Files are fetched and decoded at the playback
  context's sample rate; per-source fades avoid abrupt interrupted waveforms.
- Web Audio remains only for file playback and independent gain controls. Uses
  playback latency hint; preserves mute, persistence, visibility and stale-load
  guards. Assets are original project audio, not new third-party recordings.
- v0.8.25 commit1562078 was deployed to Cloudflare341ea14b-9f64-432c-99dd-36cb6c2e7ba5;
  production HTML/JS/CSS matched, speaker modal and version verified in-browser.
  Verify45650682181 passed all integrations. Separate GitHub Pages45650681724
  failed with HTTP500; retry API also returned500. Actual Cloudflare site works.
- v0.8.26 check,155 unit +86 UI tests,format and build passed. All18 MP3s
  decode to finite samples; maximum peak-6.98dBFS with no clipping. Built-preview
  browser verified music/effect controls and practice track transition without
  console warnings/errors. Preserve backend version
  2d2f7696-95b4-4c8f-8f67-1b2a12a52933. Real iPhone listening remains required.
- Released aaa60fb to main. GitHub push-triggered runs did not appear during
  verification after the prior GitHub Pages HTTP500; used the identical tested
  dist for direct Cloudflare production deployment a81cc475.tichu6.pages.dev.
  Live HTML,JS,CSS and all18 MP3 files matched local bytes. Production browser
  shows0.8.26 and sound modal/preview without errors. Worker health remains
  ok/protocol6; no backend deployment or live-room mutation.
- GitHub CI for aaa60fb has not run yet; local checks above passed. Do not
  describe the earlier0.8.25 CI run as covering0.8.26. User must recheck on iPhone;
  crackling elimination is not claimed from desktop or waveform checks.

## v0.8.25 audio release — prepared

- Ported only the approved audio work onto main v0.8.24; unrelated research,
  spectator and game-rule WIP remains in the original checkout.
- Header speaker modal independently controls music and effects, persists local
  settings and supports preview, keyboard dismissal and focus restoration.
- Original straight-time jazz-synth lobby/game loops, mellow game register,
  prioritized public-state effect cues and own-turn warning ticks. No external
  audio service. Hidden tabs suspend audio; stale renders cannot play after mute.
- Added regression tests for settings, snapshot selection and asynchronous audio
  lifecycle; volume changes retain playback position. See docs/AUDIO.md.
- Node26 release validation passed: check (ESLint and frontend/server types),
  155 unit tests,86 UI tests,format:check,release:check and build. npm ci audit
  found0 vulnerabilities. Original pre-port UI was checked at320/375px; actual
  iPhone audio output remains unverified.
- Frontend-only release: backend unchanged; deployment list confirms active
  Worker2d2f7696-95b4-4c8f-8f67-1b2a12a52933 and health ok/protocol6.
  Pages deployment verification pending; do not infer deployment from this entry.

## v0.8.11 mobile labels and reconnect grace — deployed

- Exchange recipients now sit above fixed-size preview cards without overlap.
- Turn clock shows only remaining seconds and refreshes its clock on deadline
  changes to avoid briefly showing 31 seconds at turn start.
- Phoenix singles describe the underlying rank (A 위 봉황), including history;
  lead-strength Phoenix uses a plain single label. Rules and scoring unchanged.
- Pass badges follow the team label in a reserved 28×16px slot, preserving
  player height when badges appear. 390px browser exchange selection/reselection
  and separated name/card bounds verified; six uncalled seats measured 50px.
  Real iPhone Safari remains unverified.
- Validation: check, 190 tests (137 unit + 53 UI), format and build passed.
- Added persisted per-turn reconnect grace: disconnect time + 180 seconds,
  then 30 seconds to act. Early reconnection starts 30 seconds immediately;
  repeated disconnects in that turn cannot extend it. Normal disconnected human
  turns use timeout/pass rather than the old 45-second bot strategy takeover.
  Bots, forfeits and idle seats continue immediately; lobby/grand/exchange retain
  their existing 45-second policy. Trick collection still takes five seconds.
- Grace deadline is public; internal per-turn allowance stays server-only.
  Local Worker flow test covers disconnect, early return, flapping and timeout.
- Reconnect validation: check, 194 tests (140 unit + 54 UI), format and build
  passed; real local Worker flow and idle checks passed.
- Released `cb5f8df` to main on 2026-11-25. Pages deployment
  `079158d5-2172-4c67-8895-ef0a8fe7384b` is active; production JS/CSS match
  the tested build byte-for-byte. Worker version
  `7408be7c-0b1e-4da8-8b91-644af027f045` deployed; production health is OK.
- Pages build and Verify (including all Worker integration checks) succeeded.
  No pending deployment work. Verify run:
  https://github.com/donan92/tichu6/actions/runs/45537406900.
  Live games were not disturbed for testing.

## v0.8.10 game flow — deployed

- Branch `fix/game-flow-timers`. Individual Small/Large Tichu penalty arithmetic
  was already correct; added explicit per-caller results and regression tests
  for teammate-first finishes, including triple victories.
- User clarified 1B/2A/3A: exchange choices can be replaced until all players
  confirm; the final confirmation atomically transfers the latest saved choices.
  Unsaved edits do not replace a previous confirmation. Callers and passed seats
  are visible on the table. Played cards are rank-sorted.
- Current trick only during play, including server spectator projections.
  Archived tricks become available after the whole 1,000-point match ends.
  Old saved mixed logs are hidden because their trick boundaries are unknown.
- Active Hono/DO backend and practice use persisted 30-second turn deadlines
  and 5-second collection deadlines. Reconnect, calls and dragon-target changes
  do not extend them. Illegal passes (lead/mandatory wish) use a legal bot move.
  Dragon defaults to the next opposing seat unless the collector chooses one.
- Validation: check (strict frontend/server types and lint), 189 tests
  (137 unit + 52 UI), format check and build passed. Real local Worker capacity,
  authorization, reconnect, idle and flow integration checks passed. Added
  `npm run test:flow` to CI for deadline persistence and alarm-driven actions.
- Browser: practice exchange preview/reselection/confirmation, declaration,
  countdown and seat pass badges checked at 390px. Actual phones unverified.
- Released `dfa1271` to main on 2026-11-25. Pages deployment
  `624beb0a-bc54-447f-be67-153117c6f172` is active; production JS/CSS match
  the tested local build byte-for-byte. Worker deployment
  `e0618d4e-08e3-4419-9b64-fb27d3eae6de` succeeded; production health is OK.
- Final local check, 189 tests, format and build passed again before release.
  GitHub Verify passed, including local Worker, idle and flow integration:
  https://github.com/donan92/tichu6/actions/runs/45533359974.
  No pending deployment work. Live games were not disturbed for testing.

## v0.8.9 reconnect loading — deployed

- Saved sessions show a loading screen before the first render; welcome and
  directory messages do not dismiss it until authoritative hall/state arrives.
- Disconnected room sessions show the same screen; errors offer retry or return
  to start without deleting saved credentials or forfeiting the game.
- Added transport tests for initial restore, delayed state timeout, retry and
  safe cancellation. check, 179 tests (131 unit + 48 UI), format and build passed.
- Real local Worker capacity, spectator authorization, bots and reconnect checks
  passed. Loading component visually checked at 390px; real phones unverified.
- Released cdb52aa to main. Pages fdc0d73c-743e-4ec0-b460-bb2206ff93f1
  succeeded; production homepage and all asset hashes match the tested build.
- GitHub Verify passed (including Worker/idle checks):
  https://github.com/donan92/tichu6/actions/runs/45422193811.
- Frontend-only release; Worker unchanged, production health v6 passed.
  Task-owned preview/Worker processes stopped. No pending release work.

## v0.8.8 lounge-only recording switch — deployed

- Replaced two radio choices with a native button role=switch, aria-checked,
  visible on/off label and44px target. Updated English/Korean opt-out copy.
- TrainingConsent renders only when session.mode=hall. Home, room, game,
  spectator and practice screens omit it without changing saved preferences.
- Default-on and explicit saved opt-outs retained. Tests cover repeated toggle,
  remount persistence and hall-to-room/practice/home transitions and return.
- check,176 tests (131 unit+45 UI), format:check and build passed. Version,
  lockfile and localized patch note updated together. Frontend-only release;
  Worker unchanged, production health v6 passed.
- Released af937b1 to main. Pages0604342d-defc-4f58-bfb8-0ad4464b64e3 succeeded;
  homepage and all5 asset hashes match tested v0.8.8. GitHub Verify including
  local Worker/idle checks passed: https://github.com/donan92/tichu6/actions/runs/45417271450.
- Production browser restored the existing practice without changing it and
  showed no recording controls;390px viewport had no horizontal overflow.
  Hall-only visibility and toggle persistence covered by component tests.
  No real phone hardware test claimed. No pending release work.

## v0.8.7 recording preference visibility — deployed

- User requested recording on by default with a visible opt-out notice and
  radio buttons. Moved TrainingConsent directly below the header on all views.
  Status, notice and on/off options are always visible; data/retention details
  remain expandable. Native radio labels have44px targets and keyboard focus.
- Missing browser preference now defaults on; saved false remains false.
  Invalid/unreadable storage stays off, and failed writes preserve withdrawal
  in memory. Existing server authentication and old-client default-off remain.
- English/Korean packs updated. Tests cover initial default, explicit off across
  remount/reconnect, handshake propagation, storage failures and repeated choices.
- check,175 tests (131 unit+44 UI), format:check and build passed. Browser tested
  on/off, reload retention and arrow-key selection.340px/390px fit without
  horizontal overflow;320px still encounters the existing page340px minimum.
  Not real iPhone/Samsung hardware verification. Screenshot:
  /tmp/tichu6-recording-radio-mobile.jpg.
- Version/lockfile and localized release note updated to0.8.7. This follows
  the user's deployment request and UI feedback. Frontend-only release;
  Worker remains3cea4505-6a0e-40a7-be41-27a6acf64311, health v6 verified.
- Released UI commitf453f55 and test fixba4909d to main. Version bump exposed an
  old test requiring an expired note; fixed it to verify the newest5 localized
  entries. All175 tests and full checks passed afterwards, including remote CI.
- Pages deploymentad1b799c-effa-4fa8-959e-abd542bc3a4b succeeded forba4909d.
  Production homepage and all5 asset hashes match the tested v0.8.7 build.
  Verify https://github.com/donan92/tichu6/actions/runs/45415643385 and Pages
  https://github.com/donan92/tichu6/actions/runs/45415643121 succeeded. Local
  preview server5194 stopped after QA. No pending release work.

## v0.8.6 released — 2026-11-24

- Includes the evaluated gentle bot strategy, opt-in private human gameplay
  records, match-group dataset separation and reproducible research artifacts.
- Version, both lockfile root versions and English/Korean patch note updated.
- Release validation, ESLint/TypeScript,131 unit+42 UI tests, formatting, build
  and npm audit passed (0 vulnerabilities). Real Worker/idle suites passed on
  these runtime changes in the preceding checkpoint; only release metadata
  changed afterwards.
- Released commit684763a by fast-forwarding main. Worker
  3cea4505-6a0e-40a7-be41-27a6acf64311 verified at100% traffic. Pages production
  0186696e-924d-4491-ac17-8f30b6cffaff succeeded for the same commit.
- Production homepage and all5 asset SHA-256 hashes match the tested v0.8.6
  build. Browser verified v0.8.6/latest5 notes, Escape dismissal/focus return,
  restored practice and unchecked recording preference; no console errors.
  This is desktop browser QA, not real iPhone/Samsung hardware testing.
- Production health v6 and one authenticated lounge welcome passed; no room
  created or live game changed. Export route returns404 without operator secret.
- GitHub Verify including local Worker/idle suites passed:
  https://github.com/donan92/tichu6/actions/runs/45405722529.
  Pages build/deploy also passed:
  https://github.com/donan92/tichu6/actions/runs/45405720970.
- Existing credentials and free hosting retained. No new secret, paid service,
  permission expansion, neural runtime or live-state reset. No pending release work.

## Latest checkpoint — 2026-11-24 bot research complete, local only

- Read [research results](../research/RESULTS.md) first for the current decision.
  Historical release notes and intermediate running-job notes below are retained.
- Two-hour experiment finished normally:17,430 matches,144,176 rounds,0 errors.
  E0 completed74,613 updates; DMC completed5,061/5,061/5,060 updates. All original
  handles and final-evaluation handles94246/61602 exited0. No training remains live.
- All predeclared final evaluations completed: E0/rule comparisons9×1,000 pairs;
  DMC3×1,000 pairs. DMC primary failed its gate; stageB skipped as planned.
  Never rerun these final sets for tuning. No new training job is authorized by
  the next-experiment proposal alone.
- Applied the fixed gentle rule scorer to shared src/game.js:botAction; exact
  evaluated behavior is preserved with one score computation per option.
  BOT_POLICY_VERSION=structure-gentle-v1 tags offline takeover records.
  E0 is stronger than baseline but loses points to gentle/calling opponent;
  DMC is weaker than baseline. No neural inference or per-turn LLM in production.
- Rule candidate's frozen full-match confirmation:79.34% wins against baseline,
  95% interval78.20–80.44%. One-new-bot mixed team's improvement is uncertain;
  do not claim all team configurations or human collaboration are proven.
- After adoption: npm run check, npm test (131 unit+42 UI), format:check, build,
  real local Worker capacity/authorization/reconnect/bot-alarm checks, and
  separate real local idle/offline-takeover suite all passed. Diff whitespace clean.
  Consent/export schema2 integration also passed before the isolated bot change.
- Human records: opt-in only,80KiB/7-day bounded private archive; anonymous match
  grouping prevents within-match train/test leakage. Legacy ungrouped records
  are train-only. No real human export/training or production export secret.
- Branch remains refactor/server-modules, baseline aca4f19/v0.8.5. Changes are
  uncommitted, unmerged, undeployed. No version bump. A future release must add
  version/release notes and verify both Pages and Worker deployments.

Next research: controlled warm-start DMC ablation described in
docs/LLM_MODEL_DECISION.md; use new final seeds, adequate validation and independent
training seeds. Do not launch it automatically or claim it was run.

## Last released baseline

- v0.3.0, commit `6f60568`: authoritative Worker, SQLite Durable Objects, automatic reconnect, 45-second offline bots, 24-hour inactive-room retention.
- Frontend https://tichu6.pages.dev/
- Worker https://tichu6-server.kelp-swaths-7q.workers.dev
- 31 automated tests passed; six real WebSocket clients, capacity, host departure, same-hand reconnect, and real offline alarm verified.

## Current release — v0.4.0 complete

Released public lounge (30 total connected users including spectators), five rooms, automatic random titles, nicknames up to five characters, and public-state spectators, with server-side authorization and request limits.

Decisions approved by user:

- Thirty includes people playing and watching, not just idle lobby users.
- Room titles are generated automatically, no manual editing in this version.
- Preserve Cloudflare free-tier deployment.

Current checkpoint:

- Lounge implementation reviewed: stale client callbacks, module cache version, and spectator seat labels corrected.
- Final checks passed: 41 tests, syntax checks, build, diff whitespace, and production dependency audit (0 vulnerabilities).
- Fresh local Worker integration passed: 30/31 users, 5/6 room creation, six seats, spectator privacy/action denial, same-hand reconnect at full capacity, origin rejection.
- Browser smoke test passed: hall entry, watching without cards, returning to hall, random room creation, reload into the same seat.
- Worker deploy dry-run passed with both Durable Object classes and rate limiter.
- v0.3 rooms are not automatically imported into v0.4. Storage remains intact; old endpoints return 410. README documents refresh/new-room migration.

Release verification:

1. Worker deployed successfully: `ee8fb0bf-746c-4817-a477-48116e6d1f2b` (v4).
2. Pages production build command changed and verified in dashboard: `npm run build`, output `dist` (includes `_headers`).
3. Main implementation commit: `19faeb9`. Pages deployment: `c1b73f40-1137-4598-ad12-c12e728ca897`, active.
4. Production smoke test passed: frontend v0.4.0, CSP and nosniff response headers, backend health v4, actual WebSocket welcome and hall entry.
5. Working tree implementation is merged; no pending implementation work in this release.

## Dependency maintenance checkpoint

- User requested automatic latest stable Python/JavaScript library maintenance.
- Added daily npm and GitHub Actions Dependabot configuration (major updates included). Python automation must be added with the first Python dependency manifest.
- This documentation change includes `.github/dependabot.yml`; scheduled updates become active when it reaches the default branch. Automatic merge is not configured.
- Python has no dependencies yet. JavaScript manifests and lockfile are included in the lounge release.

## v0.5.0 — bilingual UI and nickname policy

- User correction: use maintained libraries and semantic keys; never map entire sentences or write a custom translation engine.
- i18next 27.2.4 + browser language detector 8.3.1; esbuild 0.28.2 produces self-contained static assets.
- Packs: `src/locales/en.json`, `src/locales/ko.json`; language registry: `src/locales/index.js`. English fallback, saved selection, browser-language detection.
- New errors/history use `{code, params}`; room names use adjective/noun codes. Old string history/titles remain readable in their original language. Existing room/session credentials are preserved.
- Nicknames: ASCII A-Z/a-z/0-9 only, 1–8 characters, no trimming or case changes. Old invalid nicknames must be replaced on reconnect.
- Passed: 47 tests, syntax checks, build; real isolated Worker capacity/privacy/reconnect integration. Browser verified bilingual entry, eight-character nickname, room creation, language persistence after reload, in-game controls/history and card accessibility labels.
- Worker deployed: `daf08d99-11fd-452e-92e9-476fc2daa182` (health v5). Pages deployed commit `9c96b50`: `48f337f5-d70b-4a48-a205-5399be1eab8f`. Production bundle hash matches the tested local build; CSP, health v5, valid eight-character nickname admission and invalid Korean nickname rejection passed. Full npm audit: 0 vulnerabilities.

## v0.5.1 language-picker patch

- User reported a picker remaining open after language changes. Desktop native selection did not reproduce the persistent popup; rendering replaced the native select on every update, a likely cause on other browsers.
- Header/select now remain attached; only header text and screen content update. Focus restoration skips already-focused elements and prevents scrolling.
- Passed: 47 tests, syntax, build, whitespace checks. Browser native click selection, keyboard selection, Escape cancellation, and 390px viewport all closed the picker after selection. Actual iPhone Safari remains unverified.
- Frontend-only patch; backend unchanged. Pages verification follows main push.

## v0.6.0 — Vue / Vite / TypeScript refactor (released)

- User requested Vue, Vite, TypeScript, mandatory ESLint, clean code, and ES2026. Pinia manages shared session/game state. i18next-vue provides library-based reactive localization.
- JavaScript output is ES2026; TypeScript 6.0.3 no-emit checking uses ESNext because ES2026 is not a supported compiler target yet. CSS targets are separate to avoid Lightning CSS rejecting an ECMAScript target.
- Server and shared rules engine remain JavaScript with unchanged behavior; declarations expose typed frontend contracts. No Durable Object storage/protocol migration. Orval omitted because there is no OpenAPI gameplay HTTP API.
- Replaced HTML string renderer and custom build/preview scripts with Vue components and Vite. Stable native form nodes, keyed cards, modal Escape/focus behavior, recipient defaults, and reconnection are covered.
- ESLint includes Vue/TypeScript and existing JavaScript. Prettier makes previously minified source readable. Added read-only GitHub verification workflow.
- API key review: no credential configuration added; public API URL/account ID are identifiers. Keep deployment OAuth outside repository. Raw player tokens remain local and handshake-only. Environment files are now ignored.
- Local checks so far: 47 existing tests + 16 UI/transport tests, lint, strict typecheck, ES2026 production build, and npm audit (0 vulnerabilities). Browser checked language picker dismissal, watching without hands/actions, room creation, reload into same seat, modal cancellation/focus restoration.
- Final local verification passed: 63 tests, zero-warning ESLint, strict vue-tsc, Prettier check, ES2026 build, whitespace checks, and npm audit (0 vulnerabilities). Isolated Worker integration passed all capacity/privacy/reconnect/origin cases.
- Browser verified 390×844 layout (no horizontal document overflow), keyboard language selection/dismissal, practice grand declaration → ordered two-card exchange → play, and no console errors. This is not an actual iPhone Safari test.
- Existing engine/server normalized JavaScript is identical before/after formatting; backend deployment is not needed. Production backend remains health v5.
- Source and generated assets have no matches in a focused credential-pattern scan; no private environment/credential configuration is tracked. This is not an exhaustive historical secret audit.
- Implementation pushed as `b54e6db`. Pages `7b149d62-6f19-4212-8aa7-cd4fed1f90e7` is active; JS/CSS SHA-256 match the tested local build. Production CSP/nosniff, backend v5, visible v0.6.0 and real lounge entry passed.
- Initial CI passed all lint/type/format/unit/UI/build/audit stages but exposed an existing integration-harness race: another user’s hall broadcast was mistaken for the response to a create request. The harness now waits for request-specific state/error predicates. Fix `ec08462` passed local integration and all GitHub CI stages: https://github.com/donan92/tichu6/actions/runs/45131213643.

- Release complete: frontend v0.6.0 live, existing backend v5 preserved, no required follow-up implementation. A future stable TypeScript compiler can replace the documented ESNext checker fallback with ES2026.

## v0.6.1 — discoverable bot practice

- Returning users automatically reach the lounge, which had no practice entry. Added a visible five-bot practice panel in the lounge and clarified the home button in both languages.
- Reuses the existing local practice engine and five bots; no backend/protocol changes. Practice remains available while the lounge connection is unavailable.
- Added a UI regression covering lounge button → five bots → grand decisions → exchange. All 64 tests, lint/typecheck, formatting and build passed. Browser verified automatic lounge entry, visible practice button, five bots and progression to exchange; 390px layout has no horizontal overflow. Actual iPhone Safari remains unverified.
- Released v0.6.1 (`e40d09e`): production JS/CSS hashes match the tested local build; backend health remains v5. GitHub Verify passed: https://github.com/donan92/tichu6/actions/runs/45132422769.

## v0.7.0 — mobile hand and original card artwork

- Compact mobile table and six-column, three-row hand expose all 18 cards without a horizontal scroller. Selection uses a stable border and ordered badge, preserving full card touch targets. Wider small screens use nine columns.
- Original SVG suit/court graphics and four generated transparent special-card illustrations; ~185 KiB WebP sprite served locally. Raw PNGs, exact prompts and reproducible Sharp build are in `src/assets/cards/README.md`.
- Added card-selection/localized-label and pip-count tests. No rule, server, protocol or private-state changes.
- Browser checked 375×667 first/last-card selection and repeated deselection, with all 18 cards visible at scrollY=0; 390×844 and 430×932 also fit, without horizontal overflow. Actual iPhone Safari remains unverified.
- Passed: zero-warning ESLint, strict frontend typecheck, 66 tests, Prettier and production build. Desktop 1280px card art also verified. Production verification is recorded below.

- Released `e4f90cc` on main: all four production assets (JS, CSS, SVG, WebP) match local SHA-256 hashes; backend remains health v5. Production v0.7.0, English 18-card hand and phoenix artwork verified at 375×667 with no console errors. GitHub Verify (including Worker integration) passed: https://github.com/donan92/tichu6/actions/runs/45137647847. npm audit: 0 vulnerabilities. No pending implementation work; actual iPhone Safari testing remains a device-specific limitation.

## v0.7.1 — standard playing-card correction

- User rejected the prior decorative suit/court design. Standard spades/clubs use blue-black #172535; diamonds/hearts share a red with a slight pink tint, #c92e4b. Numeric suit IDs and rules remain unchanged.
- J/Q/K now use three distinct generated double-ended human portraits. Special cards have no printed names/letters; mahjong carries 1. Screen-reader labels stay localized.
- Maintains the mobile 18-card grid. Passed ESLint/typecheck, 68 tests, formatting and build. Browser verified 375px and 1280px layouts, distinct J/Q/K art, shared red/black suit colors and court selection. Actual iPhone Safari remains unverified.
- Released `7c297ab`: production shows v0.7.1 and all seven JS/CSS/SVG/WebP assets match the tested local hashes. Backend health v5 unchanged. GitHub Verify including Worker integration passed: https://github.com/donan92/tichu6/actions/runs/45139079022. No pending implementation work.

## v0.7.2 — single centered suit

- Numeric cards and aces now show one centered suit symbol with corner ranks, removing repeated pip layouts and the duplicate corner symbol. Court portraits and special artwork stay intact. Mobile and desktop share the centered layout.
- Updated regression coverage for one symbol and readable ranks across 2–10/A. Passed 68 tests, ESLint/typecheck, formatting and build. Desktop browser visually verified centered single symbols.
- Released `0314225`: production index and JS/CSS SHA-256 match the tested build; backend health v5 unchanged. CI: https://github.com/donan92/tichu6/actions/runs/45200420321 (all check/test/build/audit/Worker integration stages passed).

## v0.8.0 — approved navy UI, balanced bots and revised calls

- User selected the second (navy) desktop concept, requested a mobile version, then explicitly approved the mobile 6×3 layout. Existing card art retained; navy/slate surfaces and amber actions apply to home, lounge, room and game. No external design runtime or service added. Official Anthropic frontend-design and Product Design ideation/image-to-code guidance used.
- Korean name is 티츄. Large/라지 티츄 ±200 follows ten initially visible cards; eight more follow all decisions. Small/스몰 티츄 ±100 remains before first play. Old persisted rounds retain their stored initial-card IDs; new rounds use ten.
- Server fills missing seats with durable bots at match start. Human counts differ by at most one across A/B; shuffle within that constraint uses the existing cryptographic unbiased shuffle. Identities/names move together, teams persist across rounds. Bots never count as connected identities or coordinators. No humans online pauses progression; TTL and reconnect behavior preserved.
- Added localized combination guide below game and on home. Protocol has additive public `bots` flags; no secrets or private bot hands exposed. Backend health increments to v6, no storage migration/reset.
- Local Worker integration passed capacity/privacy/reconnect/origin plus solo start → five bots → ten-to-eighteen-card transition. All 71 tests, ESLint/typecheck, formatting and build passed. Mobile 390×844, compact 375×667 and desktop 1280×900 visually checked; no console errors. Actual iPhone Safari remains unverified.
- Released `9042c81`: backend `e31ba695-64bf-4eb3-8801-55f8eb0de016`, health v6; Pages v0.8.0 index and seven shipped assets match local SHA-256. Real lounge reconnect succeeded, existing room visible. GitHub Verify including real Worker tests passed: https://github.com/donan92/tichu6/actions/runs/45205343530. Design QA: `design-qa.md`. No pending required implementation.

## Bot strategy improvements — released

- Branch: `improve-bot-strategy`. Shared practice/server strategy now prioritizes singleton exchanges, received-card mahjong wishes, low loose singles, ace retention, scoring-card conservation, and taking valuable tricks. Bombs are preserved during exchange/play and reserved for opposing valuable tricks or opponents near finishing; teammates' leads are generally respected.
- Declared partners receive phoenix → A → dragon → K → Q, excluding protected bomb cards. Caller allocation happens before ordinary partner allocation. No private-state/protocol/schema changes; existing private exchange IDs identify received cards, with an A fallback for missing/old exchange data. Public hand counts are used without inspecting other hands' card identities.
- Exceptions: mandatory wishes and immediately finishing a hand override normal play preferences. With fewer than two non-bomb cards, mandatory two-card exchange takes precedence; otherwise no protected bomb cards are exchanged. A declaration after an exchange was submitted cannot revise that exchange.
- Added strategy regressions, privacy-independence coverage and 12 complete simulated rounds. Checks: ESLint/strict frontend typecheck, unit/UI tests, formatting and production build. Real isolated local Worker integration passed identity/room races, spectator privacy/authorization, reconnect, origins, and one human plus five alarm-driven bots through ten-to-eighteen-card dealing.
- No measured win-rate claim. No UI changes or device-specific verification needed. Backend/shared JavaScript is linted/tested, not TypeScript-checked.
- Released `a1f0af3` on main: Worker version `ddbfbce3-ecc7-488b-934a-fd583173ea1f`; Pages production deployment `d65b97f4-a2a6-4562-b6ec-574d4ca5925e`. Production HTML and all seven asset SHA-256 hashes match an isolated build of the merged commit. Backend health v6 and an authenticated lounge WebSocket welcome passed. GitHub Verify and Pages deployment succeeded: https://github.com/donan92/tichu6/actions/runs/45207843877. All 84 local tests passed before release. No pending bot-strategy release work.

## Counterclockwise table progression — released

- Reversed the relative seat-to-screen mapping: the next engine seat now appears on the right, so play advances counterclockwise for all six player viewpoints and spectators. Seat IDs, teams, exchange recipients and authoritative turn order remain compatible with existing rounds.
- Added a component regression covering every viewpoint, all six active seats, and actual engine play/pass transitions. Existing desktop/mobile CSS positions are reused without changing controls.
- Passed `npm run check`, `npm test` (63 unit + 22 UI), `npm run format:check`, and `npm run build`. No protocol/transport changes. Browser viewport and real iPhone Safari visual checks have not been performed for this change.
- Released `d858f18` on main; Cloudflare Pages production deployment `82bc72ae-3ca2-4e6b-b9ce-29f471260ba6` is active. Production HTML and all seven asset SHA-256 hashes match the tested build. GitHub Verify (including local Worker integration) passed: https://github.com/donan92/tichu6/actions/runs/45208666747.
- Frontend-only change; existing Worker deployment `ddbfbce3-ecc7-488b-934a-fd583173ea1f` remains active and production health v6 passed. No pending release work.

## Thirty-minute idle logout — released

- Branch `idle-logout`: authoritative lounge idle deadline covers players, spectators and hall users. Accepted create/join/leave/game requests or explicit entry reset the clock; ping/pong, broadcasts, rejected requests, reload and automatic reconnect do not. Local-only card selection is not a server action.
- At 30 minutes the server revokes socket authorization, closes with 4009 and frees connected capacity. Waiting seats are removed; ongoing seats retain identity/hand/team and become bot-controlled immediately, bypassing the normal 45-second disconnect grace. All-idle rooms finish the current round with bots, then wait for a user to start the next round. Ordinary all-offline pause and 24-hour expiry are preserved.
- Client clears the displayed game and returns home with localized explanation; idle sessions do not automatically reconnect on reload. Explicit entry reuses the private credential to recover the original seat and remaining hand. Existing storage migrates additively; activity timestamps/idle flags remain private, and existing public bot flags indicate takeover. Stale activity records expire after 24 hours.
- Passed 93 tests (68 unit, 25 UI/transport), zero-warning ESLint, strict frontend typecheck, Prettier and build. Exact-deadline, rejected-action, hibernation upgrade, automatic-reconnect, state-clearing and same-seat-return regressions added.
- Real isolated Worker tests passed existing capacity/authorization/privacy/reconnect/origin and five-bot progression cases. New `npm run test:idle` passed actual auto-response pings → close 4009 → bot progression → capacity release → rejected automatic retry → manual same-seat return. CI runs it using a local-only clock-aging fixture excluded from the production entrypoint. No real 30-minute production timeout or device-specific Safari test was performed.
- Released `abf6ab2` on main. Worker version `2414d50e-1811-4c62-b9fc-7ce50fecd880`; Pages production deployment `30f5f6a8-58ba-4bc3-8a68-f7e5e286fbb8`. Production HTML and all seven asset SHA-256 hashes match an isolated build of the merged commit; health v6 and authenticated lounge WebSocket welcome passed. GitHub Verify including both real Worker suites and Pages deployment succeeded: https://github.com/donan92/tichu6/actions/runs/45210464136. Existing room storage retained. No pending release work.

## v0.8.1 — approved card design (released)

- Implemented the explicitly approved mobile mock and court sheet: twelve suit-specific upright J/Q/K illustrations, four clean special illustrations, one top-left rank and centered numeric suit. Heart/diamond indices share #c92e4b; spade/club indices #172535. Removed reversed bottom indices, yellow gradients and decorative frames.
- Preserved six-column mobile hand and compact short-screen fallback, added correct A/B badges, centered hand heading, flat amber selection, and collapsed combinations below controls. Existing counterclockwise seat mapping, private-state handling and server rules unchanged.
- Source PNGs, generated WebP atlases, exact generation prompts and approved references committed together; asset rebuild remains reproducible. No runtime image service. Temporary visual fixture removed before build.
- Passed 94 tests (68 unit + 26 UI), zero-warning ESLint, strict frontend typecheck, format and production build. Browser checked real practice declaration/exchange/play, first/last selection, repeated deselection, guide keyboard dismissal, English and 375/390px mobile plus 1280px desktop. Console errors none; actual iPhone Safari not tested. QA evidence and intentional runtime differences recorded in `design-qa.md`.
- Released `dec4653` on main. Pages production deployment `033edf9f-5ce8-4cfc-a321-f0751344e124` active; HTML and all five shipped assets match the tested build SHA-256. Production v0.8.1, authenticated lounge reconnect and practice 18-card artwork rendering passed, with no console errors. Screenshot: `docs/design/production-courts-mobile.jpg`.
- GitHub Verify (including local Worker integration) passed: https://github.com/donan92/tichu6/actions/runs/45212563253. Pages build/deploy succeeded. Frontend-only release; existing Worker `2414d50e-1811-4c62-b9fc-7ce50fecd880` remains active and health v6 passed. No pending deployment work.

## Game UX feedback — released

- Branch `game-ux-feedback`. Private exchange receipt maps each partner to sent/received cards. Only the sender's submitted cards appear before all exchanges complete; received cards appear after completion. Receipt clears on own first accepted play or first trick collection, persists correctly across reconnect, and is excluded from spectator snapshots. Additive private `exchangeReviewClosed` storage flag; old rounds use captured-card fallback.
- Active-game header offers Give up game with explicit warning, cancel/Escape and focus restoration. Confirmation uses authenticated `forfeit`, returns to the lounge and permanently replaces only that socket identity's seat with a bot. No score/declaration reset. Rejoin as player is denied; watching remains allowed. Last-human rooms follow existing cleanup. Practice confirmation ends the local game.
- Table labels now include team A/B, player name and team color. Ranked/ranged combinations appear on table, selection preview and new history entries; full house names use the triple rank and bombs distinguish four-of-a-kind from straight flush. Existing generic history still renders. All text is localized in Korean/English.
- Passed 99 tests (70 engine/server + 29 UI), zero-warning lint, strict frontend typecheck, formatting and build. Expanded real local Worker integration passed private receipt correctness, spectator redaction, forfeit-to-hall, bot takeover and rejected seat reclaim, plus existing capacity/privacy/reconnect/origin checks.
- Browser verified real practice exchange receipt, first-play removal, colored team label and `6 싱글`, repeated modal open/cancel/Escape, focus return and confirmed exit. Checked 375×812 (no horizontal document overflow) and desktop 1280×900; no console errors. Actual iPhone Safari remains untested. Screenshot `/tmp/tichu6-ux-forfeit.jpg` shows the practice warning.
- Released `ed6b8c3` on main. Worker version `8aac4040-15a0-4cf3-9f36-7e8e566a990a`; Pages production deployment `77078863-c5b2-48c3-8c02-21b682ee1b9c`. Production HTML and all five asset SHA-256 hashes match an isolated build of the merged commit. Backend health v6 and authenticated lounge WebSocket welcome passed; durable room state retained. GitHub Verify including exchange/forfeit and IDLE Worker integration passed: https://github.com/donan92/tichu6/actions/runs/45215634265. Pages deployment succeeded. No pending release work.

## Header version label

- Added a small muted version beside the 6T logo on every screen, sourced directly from package.json so future releases update automatically.
- Passed check, all 99 tests, format check and build. Checked 375px Korean practice header: version visible, no overlap with language picker or game exit. No server/protocol changes.
- Released `fe0b1c0`; Pages `67a6f633-6896-4d3d-a55c-d28e98742d3d` active. Production header visibly shows the package version; initial domain propagation delay resolved. GitHub Verify and Pages succeeded (Verify run 45216062572). No backend changes or deployment required.

## v0.8.2 — persistent bot practice (released)

- Save the complete practice engine state after initial deal and every accepted human/bot action; restore before automatic server-session reconnect. Same-browser localStorage key `tichu6-practice-v1` contains local practice only, no server credentials. Reload preserves scores, hands, calls, exchanges, turn and bot names; timers restart from restored state.
- Confirmed practice forfeit clears the save before exit; cancellation/disposal/reload preserves it. Versioned/bounded saves with structural/card checks; corrupt/incompatible or unavailable storage produces localized warnings, not a startup crash. No server/protocol/schema changes.
- Real local browser verified identical ten-card and eighteen-card hands after reload, continuation into exchange, confirmed forfeit followed by reload into home, and no console errors. Actual Samsung Internet/iPhone Safari not tested.
- Passed 106 tests (70 engine/server + 36 UI/storage), zero-warning ESLint, strict frontend typecheck, formatting and production build. Tests cover whole-round state roundtrips, bot resumption, server-session precedence, cancellation/forfeit, invalid versions and storage failures. Released `b20ae4a`: production HTML and all five asset SHA-256 hashes match the tested build; backend health v6 unchanged. Production browser verified same-hand reload and no restoration after confirmed forfeit. GitHub Verify 45221877262 and Pages deployment succeeded. No pending release work.

## v0.8.3 — button-based selection modals (released)

- Replaced language and dog/dragon recipient native selects with a shared Vue picker using native modal dialog focus containment. Options are touch buttons with selected indicators; selection closes and restores trigger focus. Cancel, Escape and backdrop dismiss without changes. Disabled/pending game state closes recipient pickers; server authorization remains unchanged.
- Selecting a recipient does not submit a move: existing play/collect buttons still confirm it. Existing valid default targets and automatic target correction are preserved. Mahjong/phoenix rank selects remain outside this request.
- Browser verified 375×812 language switching, repeated open/select/cancel/Escape, localized cancel text and focus restoration. Player selection and disabled-state behavior covered by component tests. Actual iPhone Safari/Samsung Internet remain untested. Preview: `/tmp/tichu6-language-modal.png`.
- Font requirement for follow-up: support Korean, English, Japanese, Simplified Chinese and Traditional Chinese with language-appropriate glyphs; do not choose a Korean-only font as the universal CJK solution. Font and card aspect-ratio changes are not included in this patch.
- Passed `npm run check`, `npm test` (70 engine/server + 36 UI), `npm run format:check`, `npm run build` and diff whitespace checks. Released `ec758b8` on main; Pages production `a167c7b4-13ce-4a92-9a01-b01338a76aa0` active. Production HTML and all five assets match local SHA-256. GitHub Verify 45223860359 (including Worker integration) and Pages succeeded. Production browser confirmed v0.8.3, Korean/English switching, dismissal/focus return and no console errors; mobile screenshot `/tmp/tichu6-v083-production.png`. Backend unchanged, health v6 passed. No pending release work.

## Court layout release — scoped frontend patch

- Backported only approved court portrait bounds, four suit inks, stacked rank/suit indices, bottom-right alignment and consistent hand-card ratio onto production main. Runtime refactor, protocol validation and dependency/font changes remain on the original branch. No Worker changes required.
- Passed check, 106 tests, format check and build. All twelve court portraits visually verified at 375px against the approved layout. Released together with the numeric pip update below.

## Numeric pip layouts — frontend release

- Replaced single numeric emblems with exact 2–10 pip counts using standard mirrored columns inspired by the official Balatro deck reference (https://www.fangamer.eu/products/balatro-playing-cards). Lower pips rotate 180 degrees; aces keep one large symbol. Existing vector suits and four inks retained.
- Regression covers counts, unique positions, horizontal symmetry, rank labels and SVG bounds. Passed check, 106 tests, format check and build. Desktop and 375px previews checked across all four suits; pointer selection and keyboard deselection passed. At 320px the existing 340px page minimum causes horizontal scrolling; individual pip bounds remain intact. Actual iPhone Safari not tested.
- Preview `/tmp/tichu6-pips-mobile.png`. Released `a3b0c06` on main; Pages production `ed19d3d1-ac2c-4090-895c-1d882e100c47`. Production index and all five assets match local SHA-256. Existing backend health v6 and authenticated lounge welcome passed; no Worker code deployed. GitHub Verify including Worker/idle integration succeeded: https://github.com/donan92/tichu6/actions/runs/45234721173. Production 375px practice visually verified with no console errors; screenshot `/tmp/tichu6-pips-production.png`.

## Card proportion correction

- Removed table-room overrides that forced 64px/78px card heights and disabled aspect ratio on short screens. Hand cards retain 7:10 at every viewport height. Scaled rank indices with card width and enlarged numeric pips from 19 to 22 SVG units with wider symmetric columns.
- Checked the real 18-card practice exchange screen at 375×667, 390×844 and desktop 1280px: measured ratio ~0.700, no horizontal overflow on mobile, pointer selection/Space deselection and focus retained. Preview `/tmp/tichu6-proportions-mobile.png`. Actual iPhone Safari remains unverified.
- Passed check, 106 tests, format check and build; numeric count/symmetry/bounds regression updated. Released `c837c46` on main. Pages deployment 45235815229 succeeded. Production HTML/all five asset hashes match the tested build; backend health v6 and lounge welcome passed. Production 375×667 18-card hand measures 7:10 with no horizontal overflow. Preview `/tmp/tichu6-proportions-production.png`. CI: https://github.com/donan92/tichu6/actions/runs/45235816433.

## More distinct suit inks — local preview

- Increased suit saturation and hue separation: spades #195dcc blue, clubs #00864b green, diamonds #c65a00 orange, hearts #d51f3a crimson. Ranks/pips/court indices inherit the inks; portrait assets unchanged.
- All four suits checked at 375px with numeric, ace and court cards. Preview `/tmp/tichu6-saturated-suits.png`. Not deployed.

## Mid-tone suit inks — released

- User rejected the bright preview. Set midpoint inks between the original and bright palettes: spades #17448b, clubs #0c6942, diamonds #ba5114, hearts #ba2835. Supersedes the preceding local preview. Released `e476d46` on main; Cloudflare Pages `7a505fcb-949f-465b-8202-608330eb8f22`. Production HTML/all five asset hashes match the tested build, all four computed suit colors match approved values, backend health v6 and lounge welcome passed. CI including Worker/idle integration passed: https://github.com/donan92/tichu6/actions/runs/45238459501. No Worker changes/deployment. Screenshot `/tmp/tichu6-mid-tone-production.png`.
- Visually checked all four suits at 375px. Preview `/tmp/tichu6-mid-tone-suits.png`. Check, tests, format and build passed.

## Room progress timeout — deployed

- Rooms expire 30 minutes after creation or the last accepted game action, including bot moves. Presence, join/watch, reconnect and pings do not extend the persisted lastProgress clock. All occupants detach to the hall and the room disappears from the directory; expired requests cannot revive it.
- Expiry is scheduled using Durable Object alarms and checked before gameplay/bot actions. Existing rooms receive one full window on first load; repeated hibernation preserves the baseline. No destructive schema migration or manual live-room reset.
- Passed check, 110 tests, format and build. Real isolated Worker idle suite passed online player/spectator room expiry, hall return and failed room resurrection. Full isolated Worker capacity/races/privacy/reconnect/bot/exchange/forfeit integration passed on port 18940. Released `98f8265` on main; Worker version `02f828d5-1bce-413a-9f49-109845815556` verified at 100% traffic, Pages `a4a39f49-12b4-44ec-8f9e-6ada0bc0c11c`. Production frontend index/all assets match local SHA-256, backend health v6 and authenticated lounge welcome passed. Existing rooms preserved and receive a one-time migration window. Production room-expiry time was not accelerated or tested against live players. CI including local room-expiry, capacity and idle integration passed: https://github.com/donan92/tichu6/actions/runs/45297364185.

## v0.8.4 — player-facing patch notes (deployed)

- Header and home-footer version buttons open an accessible native dialog showing the newest five releases, one short player-facing summary per version. Korean/English summaries cover actual v0.8.0–v0.8.4 changes; routine maintenance must use “버그 수정” / “Bug fixes.” Keep older history in `src/release-notes.json` while displaying only five.
- Added required release-note rules to AGENTS.md and CONTRIBUTING.md. `release:check` rejects version/lockfile mismatches, missing current notes/translations, duplicate or unordered versions and invalid summaries. It runs in check, prebuild (including Pages) and predeploy:server. Editorial accuracy remains part of release review.
- Passed check, all tests, format check and build. Component tests cover five-entry rendering, repeated opening, close/Escape/backdrop, focus restoration, separate trigger IDs and localization. Local browser at 375×667 verified all five short summaries, header/footer opening, keyboard reopening, dismissal and focus restoration without horizontal overflow. Screenshot: `/tmp/tichu6-patch-notes-mobile.jpg`. Actual iPhone Safari/Samsung Internet remain untested.
- Isolated branch `feat/patch-notes`, worktree `/tmp/tichu6-patch-notes`, based on production main `1a8a03d`; original refactor/card worktree untouched. No backend/protocol changes. Released `1489e00` on main; Pages production `1430c879-3bd6-4c9f-b308-aa01b6bcddc1`. Production homepage and all five asset SHA-256 hashes match the tested build. Production browser verified v0.8.4, all five summaries during restored practice, Escape dismissal/focus return and no console errors. Screenshot: `/tmp/tichu6-v084-production.jpg`. GitHub Verify including Worker/idle integration passed: https://github.com/donan92/tichu6/actions/runs/45301240790; Pages run 45301239610 succeeded. Worker unchanged at `02f828d5-1bce-413a-9f49-109845815556` (100% traffic), health v6 passed. No pending release work.

## NestJS backend feasibility review — no implementation or deployment

- User clarified the goal is a recognizable TypeScript framework with modules/services/controllers, not merely splitting JavaScript files. Keep Vue; evaluate NestJS for the backend. No runtime source, dependencies or deployment configuration changed. Branch `refactor/server-modules` currently contains review documentation only.
- Reviewed production-main sources: `server/lounge.js` owns admission, identity-based reconnect, global capacity, room membership, game actions, private/public snapshots, persistence, idle takeover and alarms. `server/worker.js` owns routing and retains the legacy GameRoom class required by the Durable Object binding. Shared `src/game.js` also runs in browser practice.
- NestJS modules/providers and a WebSocket gateway fit the desired application structure. A conventional Node.js NestJS service is the recommended target if framework conventions are the priority. Preserve the existing raw WebSocket wire format with a configured parser; Socket.IO is not a drop-in replacement for the browser client.
- Cloudflare Workers supports Node HTTP APIs but explicitly does not support the Node HTTP server `upgrade` event or direct underlying socket access. Therefore ordinary Nest WsAdapter wiring is not a drop-in replacement for Durable Object WebSockets. A custom adapter or standalone Nest application context inside Durable Objects is a research alternative, not verified compatibility; standalone context does not automatically apply request guards/pipes/interceptors.
- A Node deployment must replace Durable Object persistence, serialized admission/action handling, alarms and socket attachment recovery. Choose durable storage and a single-writer/multi-replica strategy before implementation; do not rely on process-local timers or memory alone. Preserve both 30-minute policies, 30 identities/five rooms, spectator privacy, bot takeover, token identity and saved games. Keep the existing JS engine initially behind a service, then migrate the shared implementation to TypeScript without maintaining divergent rule engines.
- Proposed feature modules: Session (identity/reconnect), Lounge (capacity/directory), Room (membership/forfeit), Game (rules/turns/bots), Persistence (storage/atomic updates), Lifecycle (idle/expiry), with a thin gateway and explicit public-state serializer. Validate with the existing unit and real transport tests, restart recovery, concurrent admissions, malformed messages and unauthorized actions before any cutover.
- Sources checked 2026-11-24: https://docs.nestjs.com/modules, https://docs.nestjs.com/websockets/adapter, https://docs.nestjs.com/standalone-applications, https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/. Review only: no Nest prototype, startup/performance measurement, hosting selection or migration tested. Next decision is hosting/state-storage direction before implementation; production remains v0.8.4.

## v0.8.5 — Hono + TypeScript server services (deployed)

- Supersedes the NestJS proposal above: user chose to keep Vue, Cloudflare Workers and SQLite Durable Objects, adopting Hono and TypeScript services without a separate Node host/database. Updated AGENTS.md/CONTRIBUTING.md accordingly. No production resources or credentials changed.
- `server/worker.ts` is the Hono HTTP entrypoint; `server/lounge.ts` wires session, room, game, snapshot, lifecycle, transport and persistence services. The Durable Object adapter owns the concurrency gate and persist-before-ack ordering. Validated network commands discard identity/seat fields; snapshots remain explicit allowlists. Existing class names, public-v1 identity, storage keys, raw WebSocket protocol, two idle policies and migrations remain intact.
- Active server code is strict TypeScript with separately generated Cloudflare runtime types (`tsconfig.server.json`). Check/build and the server-deploy prehook enforce it. Tests directly execute erasable TS on Node 22.18+. Shared `src/game.js` and the isolated `server/legacy-game-room.js` remain JavaScript with declaration boundaries, not implementation type checking. Legacy GameRoom is retained for stored objects and remains unreachable through public routing.
- Added HTTP origin/preflight/rate-limit/forwarding regressions, malformed command and identity-field filtering tests, persist-before-ack coverage, and compile-time contract rejection cases. Existing game, privacy, capacity, reconnect, bot and timeout tests remain green. Local Worker integration on port 18940 passed 30/31 identity and 5/6 room races, spectator privacy/action denial, reconnect, bots, exchange and forfeit. Isolated idle integration passed room expiry and ping-resistant idle logout/takeover/manual return.
- A separate old-to-new local Worker test used the previous JavaScript implementation, saved a started game, restarted with Hono/TypeScript against the same SQLite storage and verified identical room/seat/names/hand/round/scores plus an accepted authenticated action. One-off runner: `/tmp/tichu6-hono-migration.mjs` (baseline c2f0e68). No live room state touched.
- Passed check, 120 tests (82 unit + 38 UI), format check, production frontend build, Worker dry-run bundle (118.90 KiB / 29.67 KiB gzip) and npm audit (0 findings). Version/lockfile and localized v0.8.5 note updated together; maintenance summary is only “버그 수정” / “Bug fixes.” No UI control changes; no new device-specific QA claim.
- Released `39a4368` on main. Worker `3e3deb1d-fb09-410b-9de1-f6fb751997ff` verified at 100% traffic; Pages production `41d14597-2f48-41d5-b2c8-c19e02ac621b`. Production homepage and all five asset SHA-256 hashes match the tested v0.8.5 build. Health v6 and a single authenticated production lounge welcome passed; no live game state was reset or load-tested. Deployment prehooks passed. GitHub Verify including local Worker/idle suites succeeded: https://github.com/donan92/tichu6/actions/runs/45312032944. Pages run 45312032211 succeeded. No pending release work.

## Active goal — bot research and reusable gameplay records

- User requested collaborative cheap-model strategy research, at most 100 games,
  stronger bots, and server-side human gameplay data for later training.
- Current authoritative baseline is v0.8.5, commit aca4f19 on
  refactor/server-modules; clean before this task. Do not use the older deleted
  runtime-boundaries branch as baseline.
- Frozen current strategy in research/bots/baseline.js and recorded experiment
  method/budget in research/bots/README.md. No research games executed yet.
- Full npm test already contains 32 complete rounds (20 engine + 12 bot); reserve
  those within the 100-round ceiling. Research allocation 60, contingency 8.
- Two low-cost gpt-5.6-luna agents are reviewing strategy and experiment design,
  read-only; root owns all game runs and budget. Actual turn simulation will be
  local, not require model calls in production.
- Next: implement paired seeded runner, compare candidates, integrate winner and
  bounded private training records, add notice/export/retention documentation,
  run required checks plus local Worker integration. No release or data
  collection has been enabled, and no checks have been run in this goal yet.

### Bot experiment checkpoint

- Executed 60 research rounds; exact reservations, seeds, actions-valid-through-engine
  results and timing are in research/bots/ledger.json. No full test suite run yet;
  32 test rounds plus 8 contingency slots remain within the total cap of 100.
- Low-cost reviewers completed strategy/experiment review. Tested structure,
  calls and lead-only hybrid on matched deals; selected structure for unseen
  confirmation. Its development +42 point margin became −4.67 on 30 held-out
  rounds (paired SE 10.46). Do not claim score improvement or deploy that policy.
  Baseline remains selected; report.mjs regenerates summary without more games.
- Research files pass ESLint; full project check/test/build still pending.
- experiment_design agent is implementing only new server/training/records.ts
  and tests/training.test.js (pure bounded perspective records, no full games).
  Root still needs consent/notice, accepted-action/repository integration,
  operator-only export, retention, server tests and Worker integration.

### Two-hour simulation authorized and running — supersedes 100-round cap

- User explicitly replaced the 100-game limit with roughly two continuous hours
  of simulation. Historical 60-round ledger remains intact; do not enforce its
  old budget on the new endurance run.
- Started 2026-11-24 11:07:21 UTC (20:07 KST), planned end 13:07:21 UTC (22:07 KST).
- LIVE exec session 83765, OS PID 94773. Command:
  `node research/bots/endurance.mjs 120 > /tmp/tichu6-endurance.log 2>&1`.
  Poll this exact handle/process; do not restart from a stale status file.
- Runner now plays full matches to 1000 points. Ten parameterized policies vs
  frozen baseline, mirrored team assignments, SHA-256 seeded rejection-sampled
  Fisher–Yates decks. First 90 minutes development; final 30 minutes freeze best
  conservative development candidate and evaluate on disjoint holdout seeds.
- Atomic progress: research/bots/endurance/status.json; per-pair replay seeds,
  scores and decision latency: results.jsonl. Completion status is written only
  after loop actually ends. Existing status file prevents accidental duplicate
  launch. First observed checkpoint: 22 matches / 184 rounds, no errors.
- Research scripts pass ESLint. Candidate defaults retain earlier behavior;
  new optional parameters support endurance comparison. No production changes.
- Next: monitor live run while integrating completed training-record helpers;
  then inspect final holdout confidence, preserve baseline unless improvement is
  supported, run project checks and report both result and recording status.

### Training integration checkpoint (local, unreleased)

- Added opt-in footer/hello preference; authenticated trainingConsent updates
  member preferences. Server records accepted human/consented offline-bot actions
  only. Own grand hand restricted to ten cards; public top allowlisted.
- Separate private training-v1 key persists atomically with lounge using multi-key
  put. Archive <=80KiB, <=100 sessions, <=2000 events/session, seven days from
  creation (updates do not extend retention); lifecycle alarms prune idle data.
- Operator-only /training/export disabled absent optional TRAINING_EXPORT_TOKEN
  > =32 chars. Constant-work SHA256 comparison; no public/spectator data exposure.
  > scripts/export-training.mjs and prepare-training.mjs export private files and
  > split human examples by round, not event. docs/TRAINING.md describes bounds.
- Check, full test suite (92 unit + 40 UI), formatting and build passed. Then
  tightened retention to creation time; all eight training tests passed again.
  Use WRANGLER_LOG_PATH=/tmp/tichu6-wrangler.log to avoid home log permissions.
- Live local Worker session 42286 on localhost:18945, inspector19445, persistence
  /tmp/tichu6-training-worker. First sandbox startup failed to bind; escalated
  startup running. NEXT: verify this process, run TEST_API=http://localhost:18945
  npm run test:server, add real recording/export/restart integration and UI flow
  checks; operator secret is NOT configured in production. No deployment yet.
- Two-hour simulation remains live in session83765, pid94773; observed 596 full
  matches /4878 rounds, zero errors at elapsed231s. Do not restart. Completion
  planned 2026-11-24 13:07:21 UTC; poll handle and atomic status for actual end.

### Real training path and UI verification

- Existing real Worker integration passed on 18945: capacity races, spectator
  privacy/authorization, reconnect, alarm-driven bots, exchange and forfeit.
- New scripts/check-training.mjs passed against isolated local Worker on18946
  (session94371, inspector19446, persist/tmp/tichu6-training-export-worker).
  Uses explicitly local-only dummy secret via --var; no production secret.
  Six synthetic clients finished172 accepted decisions;105 retained perspective
  examples exported with outcome and truncated=true. Nonconsenting player absent,
  spectator redaction and anonymous export fields verified, unauth export denied.
- Synthetic export at /tmp/tichu6-synthetic-training-export.json; converter emitted
  105 human-labeled synthetic examples into /tmp/tichu6-synthetic-dataset (all in
  one round/train split, validation/test empty as expected). Not real user data.
- Browser CUA verified local5176 footer expand, opt-in, reload retaining checked,
  opt-out,390px no horizontal overflow. Actual phone browser remains untested.
  UI dev session95213; did not disturb existing5173. Browser task completed.
- Fixed withdrawal when localStorage setItem throws: current-tab override is
  honored by transport. Three focused consent tests passed after this fix.
- Endurance audit by low-cost reviewer found no hidden-hand access or pairing
  error. A/B roles use same deck stream, but variants use independent seed samples.
  Report final margin per MATCH (not per round); compute paired win/tie/loss from
  results.jsonl. Initial60-round LCG experiment is not directly comparable to
  full matches with SHA decks. All current standings remain development-only.
- Next: actual restart/recovery of archive, transport consent regression,
  prepare-training validation/synthetic-export tests, final check/build as needed,
  monitor session83765 until deadline13:07:21UTC without restarting. No deployment.

### Deep learning and literature-based design (user steering)

- User requested actual deep learned weights, overfitting safeguards, then a
  literature-backed detailed design. Added exact devDependency @tensorflow/tfjs
  4.22.0 (registry latest checked); npm audit0. Production is not using it.
- LIVE deep training session46575, research/deep/train.mjs, logs
  /tmp/tichu6-deep-training.log. 62→64→64→32→1 network, REINFORCE,32 sampled
  decisions/round,50% self-play/50% baseline opponent, CPU backend. Checkpoints
  research/deep/run/. Hash change and1920 gradientupdates verified; no strength
  claim. Ends at original13:07:21UTC deadline; last15min latest-model holdout.
- LIVE validation monitor session31738, research/deep/validate.mjs, log
  /tmp/tichu6-deep-validation.log. Validation-only seeds600000000..600000015,
  checkpoints every10min, saves best-validation-model.json. This16-pair set is
  a wiring pilot, not release evidence. Do not confuse latest-model holdout with
  final testing of the validation-selected checkpoint; latter still needs fresh
  reserved seeds after freeze. Both new processes reject/avoid accidental state
  replacement; poll live handles, do not restart because of a stale file.
- User-facing design saved docs/BOT_LEARNING_PLAN.md in Korean. Reviewed DouZero,
  ETH Tichu thesis, Other-Play, Hanabi, ReBeL and statistical evaluation paper via
  official primary sources,20 Exa result items across4workstreams. Recommends
  DMC action-value model with suit-aware observations/history, all-stage actions,
  independent seeds, partner cross-play and fixed release gates. E0 exploratory
  prototype differs from this proposal (no suits/history/call learning etc).
- Corrected per-round outcome winner to use delta instead of cumulative scores.
  Added archive load validation helper from reviewer, wired repository to it;
  missing first10 projection skips record, malformed persisted archives failclosed.
  Previous tests/build precede latest repository/winner changes; recheck needed.
- Actual local Worker restart preserved exact exported synthetic training records.
  Current export Worker session27093 (replaces94371) on18946 samepersist path.
  Added handshake-withdrawal sync regression:10 transport tests passed; archive
  helper10 tests passed on agent. Next validate complete diff, finish running
  E0 jobs, report actual results and propose/implement next gated experiment.

### Literature-plan verification checkpoint

- Added research-only suit-aware exhaustive action oracle and immutable observation
  adapter. Observation retains only public history types, caps 128 events, strips
  card IDs, hides future eight cards and stale exchange evidence. These are E1
  helpers; live E0 training still uses its original policy and has not changed.
- Combined deep-policy/action/observation tests:13 passed. Complete npm test:
  107 unit +42 UI passed; npm run check, format:check and build passed. Excluded
  continuously generated checkpoint/result directories from Prettier, without
  rewriting running models. No deployment or production bot replacement.
- At 11:38UTC endurance had4604 matches/38152 rounds, zero errors. Deep E0 had
  10460 updates; validation checkpoint11:35UTC improved from-300 to+25.3125 mean
  round margin on16 mirrored pairs. This is small reused development validation,
  not final generalization evidence. No final heldout result yet.
- Existing sessions83765,46575,31738 remain running toward13:07:21UTC deadline.
  Do not restart or alter policy mid-run. Finalize results only after actual
  completion, separately test validation-selected model on fresh reserved seeds,
  and preserve baseline unless strength/runtime/privacy gates pass.

### Final evaluation tooling prepared while jobs run

- Re-polled live handles83765/46575/31738; all still running. Previous turn made
  concrete progress with literature plan, E1 helpers and complete checks.
- Added paired-statistics helper with deterministic whole-pair bootstrap;
  two tests verify within-pair dependence, ties and invalid data. Targeted tests
  and ESLint passed. No individual moves counted as independent observations.
- endurance-report.mjs requires successful terminal state and cross-checks every
  pair/outcome against aggregate counts before reporting full-match margins.
- deep/final-evaluate.mjs requires all E0 jobs complete, verifies validation-best
  checkpoint hash, freezes model and source/seed manifest, and refuses overwrite.
  Reserved700000000..700000999 in deep-final-v1 namespace;1000 paired rounds per
  four opponent/mixed-team conditions. Not run yet; both tools' early-run rejection
  verified with no final artifacts created. Deep output is round scoring only.
- Next: finish live jobs at13:07:21UTC, run both final tools once, inspect results,
  then decide whether a candidate merits further independent-seed/full-match and
  runtime validation. Do not claim final-test or production improvement yet.

### Dataset integrity and persistence review

- Fixed persisted-record parser rejecting phoenix single half-point power. Cards
  now validate against engine deck metadata; malformed action IDs are rejected,
  not filtered/truncated into a different action. Event/public revisions and round
  numbers must match; seat lists and outcome winner/delta are checked. Dropped
  archive events mark the remaining session truncated.
- Exported shared decision/outcome parsers for scripts/training-dataset.mjs.
  Offline converter validates before creating output, rejects duplicate sessions,
  records/revisions and missing delta, excludes takeover bots, preserves complete
  round splits and creates new0700 directory/0600 files without overwrite.
- Synthetic105-example Worker export still loads identically after local server
  reload with stricter parser; local18946 readback deep-equal to prior export.
  No production human data used. Three converter tests cover private fields,
  partition integrity, malformed records and filesystem behavior.
- Complete checks passed:113 unit +42 UI tests, check, format:check and build.
  Both experiment handles83765/46575 re-polled live; validation monitor31738 also
  live. At11:45UTC latest validation fell to-19.375 while best checkpoint remained
  +25.3125 on16 pairs; preserve best separately, do not equate latest with best.
  Next remains completion/final evaluation at original13:07:21UTC deadline.

### Local inference compatibility evidence

- Added separate research/deep Worker benchmark without game bindings or external
  credentials. Dry-run bundling only, no deployment:2099KiB raw/411KiB gzip.
- Local workerd session71119 on18947 successfully ran TensorFlow.js CPU inference
  without nodejs_compat. check-worker-benchmark matched Node scores exactly on
  synthetic batches1/16/64/256/512; retained tensors stayed8 (41,220 bytes).
- Amortized local request wall medians:64 rows1.0ms,512 rows7.1ms. Not production
  CPU accounting, total heap, full-action latency or a multi-room capacity proof.
  Fixed initial model used, not a selected model or extra heldout game evaluation.
- Closed only task-owned benchmark Wrangler PIDs41667/41665/41642 after checks;
  keep original training/endurance jobs running. Artifacts remain under
  research/deep/run/worker-benchmark.json and /tmp/tichu6-model-bundle.log.

### Opponent-coverage audit before final evaluation

- Current baseline never declares Large/Small Tichu; calls-* candidates also
  change card selection, so their scores cannot isolate declaration benefits.
  Added those limitations to endurance README/report (running policies unchanged).
- Expanded not-yet-run final evaluator to nine predeclared conditions: neural
  vs baseline/selected/caller; neural1/2 mixed; selected vs baseline/caller;
  selected1/2 mixed. Same fresh1000 pairs per condition. Caller fixed thresholds
  5.5/7, strength unproven; save calls/delta/finish per game to check coverage.
  This supersedes the earlier four-condition note. ESLint/format passed.
- At ~51min,7570 full matches; validation monitor live with4 checkpoints, latest
  +9.375 and best+25.3125 on16 pairs. Still development, not final evidence.

### One-hour verified wait checkpoint

- Live handles83765 and46575 repeatedly polled, still running; no restart or
  policy changes. At~60min endurance8906 matches, errors0. Deep training was
  already34370 updates at previous poll with26 retained tensors, errors0.
- Validation has5 checkpoints; latest+17.1875, best+25.3125. Small reused16-pair
  validation remains exploratory. Next phase transitions: endurance freezes at
  12:37:21UTC; deep training/validation freeze at12:52:21UTC; full deadline
  13:07:21UTC. Final evaluator must wait for successful terminal statuses.

### User steering: model suitability and LLM adoption

- User explicitly requested analysis and application if LLM/model changes help.
  Read primary2026 Hanabi LLM, PokerBench, R3D2, DouZero and current Cloudflare
  limits/pricing. Decision saved docs/LLM_MODEL_DECISION.md: dedicated RL inference
  first; LLM research/strategy critique only, no per-turn external API or LLM
  finetuning. No paid plan, API credential or human-data transfer added.
- Implemented NEW research/dmc policy/runner with cheap reviewers.221 features:
  own/remaining suit counts, public played-card/pass history, last controller,
  pile points, action descriptors, counts/calls/finish/passed;53,249 parameters.
  MSE actual team delta/1000 unclipped, three independent seeds/deck/RNG/optimizers.
  Still play/pass-only, representative legalPlays, no GRU/off-turn bombs and no
  full typed observation boundary. Calls/exchange/collect remain baseline.
- Fixed history normalization before launch. Smoke session2055 completed in
  /tmp/tichu6-dmc-smoke-v1:3 rounds per model, all actual weight hashes changed,
  errors0.8 DMC tests passed including hidden-hand invariance, suit/history,
  gradient direction, checkpoint parity, other-model independence and stable
  per-update tensors. Complete check/test/format passed after changes.
- LIVE DMC session67593, PID72454, started12:26:55UTC, training stop12:52:21UTC
  (original deadline minus15min), plus final validation. Output research/dmc/run/,
  log /tmp/tichu6-dmc-training.log. Early68/68/67 updates, errors0. Do not restart.
  Every25 rounds latest artifacts; every500 validation32 mirrored pairs permodel;
  per-model validationBest includes exact artifact hash. Optimizer/RNG not saved,
  so exact resume unavailable. New model receives less time than E0, not an equal
  compute-budget algorithm comparison.
- Existing83765/46575/31738 remain untouched. After successful terminal status,
  E0 final evaluator covers9 conditions; DMC still needs its own fresh final test
  of all3 frozen validation-best models before any strength/release claim.

### Frozen-candidate transition and DMC final-test gate

- Endurance handle83765 confirmed live after90min. Phase nowholdout; selected
  gentle = structure with structureWeight15. Initial35 holdout pairs/70matches
  recorded, but do not conclude from this partial confirmation. Candidate will
  stay frozen through13:07:21UTC. Original cached policies were not edited.
- Added research/dmc/final-evaluate.mjs (not run). Requires successful terminal
  DMC/E0/endurance; verifies and freezes all3 artifacts, selects primary by
  validationBest.mean (tie lowerseed) before opening new final seeds. StageA:
  1000 paired rounds/model vsbaseline, dmc-final-v1 seeds820000000..820000999.
  Primary gate mean>=10/lower95>0. Onfailure skip StageB, never switch based on
  final scores. Onpass four secondary opponent/mixed-team conditions with a new
  dmc-final-secondary-v1 namespace. Recorded in manifest; actual final script
  source hashes included. Local-only synthetic game testing.
- Root reviewed evaluator, added finite/unique seed validation and explicit
  per-round units. Syntax/ESLint/Prettier pass; early launch guard rejected still
  running prerequisites with no final output directory. Do not run until jobs end.

### DMC runtime probe (no policy change)

- Froze one copied DMC checkpoint into run/runtime-probe-model.json without
  touching training weights. Extracted reusable local benchmark runtime; both
  E0/DMC entries use it. Actual workerd DMC predictions exactly matched Node;
  retained8 tensors/212,996 bytes. Feature count221,53,249 parameters.
- Local amortized request wall medians64 rows3.8ms,512 rows29.7ms. Synthetic only;
  not production CPU accounting/full-action/multi-room guarantees. Dry-run bundle
  2323KiB raw/578KiB gzip. No deployment. Benchmark session83123 closed with143
  after terminating only owned Wrangler PIDs88981/88980/88960.
- Separate10,000 synthetic18-card hand sample, runtime-shapes-v1 SHA/rejection
  shuffle, no games or final-test seeds: representative lead-candidate counts
  median41/p95 88/max114. Not a worst-case completeness bound. Saved in
  research/dmc/run/candidate-counts.json; model probe worker-benchmark.json.

### Anonymous match grouping and completed development checks

- Export schema2 now includes a random match group shared across rounds and
  reconnects; a new lobby-to-match start gets a fresh group. Public snapshots
  exclude it. Existing archived rounds remain readable with null group.
- Dataset converter splits80/10/10 by match group, not round. Legacy schema1/null
  groups are training-only; never use unknown match boundaries for evaluation.
  This prevents within-match leakage, but does not establish player independence.
- Full npm run check, npm test, npm run format:check and npm run build passed
  after grouping changes. Local Worker18946 recording integration passed158
  accepted moves/95 retained synthetic examples, with private export, consent
  exclusion and spectator redaction. No real human data or production deployment.
- DMC training handle67593 exited0, statuscomplete/errors0: seeds101/202/303
  trained5061/5061/5060 rounds; best32-pair validation means -62.65625/-99.53125/
  -80.625. Final primary remains seed101 by predeclared validation selection.
- E0 validation handle31738 exited0, selected checkpoint mean44.375 on16 reused
  validation pairs. E0 training froze74613 rounds and is inholdout; original
  endurance alsoinholdout, both still wait until13:07:21UTC. No strength claim
  based on these development results. Run prepared final evaluators once only
  after successful terminal statuses; do not restart either live job.

### Two-hour run completed; final evaluations launched once

- Original handles83765/46575 exited0. Endurance complete/errors0, elapsed
  7200.544s,17430 matches/144176 rounds/27136503 moves. No restart occurred.
  E0 complete/errors0,74613 gradient updates,9087 frozen-latest holdout pairs.
- Endurance ledger/report consistency checks passed. Frozen gentle holdout:
  2122 mirrored pairs/4244 full matches, win rate79.3355% (pair-bootstrap95%
  78.2045–80.4430%), mean final match margin294.656 (95%285.921–303.742).
  This is against frozen baseline only, not human performance or round margin.
- Launched prepared final tools only after terminal success: E0 session94246,
  PID16110, log /tmp/tichu6-deep-final.log; DMC session61602, PID16111, log
  /tmp/tichu6-dmc-final.log. Both running, no training/weight updates. E0 nine
  configurations1000 pairs each; DMC stageA three seeds1000 pairs each, primary
  seed101 preselected by validation, stageB only if predeclared primary gatepass.
  Do not restart, overwrite output directories or tune using final-test results.

### Final cleanup

- Closed only task-owned local Worker18945/18946 and Vite5176 after passing
  checks. Model benchmark servers were already closed. User's other servers
  were not targeted. Research artifacts and local synthetic test records remain.
- Final model/strategy decision and exact comparison intervals are in
  research/RESULTS.md. No further training, merge or deployment performed.

## Special-card confirmation, wished-bomb priority and spectator hands — release preparation

- User replaced the earlier automatic-bomb request: no new automatic submission. On the current player's turn, UI announces a required beating bomb containing the wish. Engine rejects out-of-turn interruptions while that legal response exists; missing/weaker wished bombs do not reserve priority. Rejection preserves state, and fulfillment clears the restriction. Existing turn/trick timeout behavior remains.
- Mahjong wish now uses a three-column button modal; Dog/Mahjong/Dragon play and Dragon recipient/collection require explicit confirmation. Cancel/Escape preserve choices, focus returns, and revision/phase/turn/selection changes invalidate pending confirmation.
- User explicitly changed spectator policy: authenticated room spectators receive six dealt hands through `spectatorHands`; grand shows only the first ten. Player snapshots do not contain opponents' hands. Exchange receipts/choices, credentials and identities remain private, and spectator actions remain forbidden. Updated AGENTS/README accordingly.
- Local real Worker18949 passed capacity, seat races, spectator hand exposure/player isolation, authorization, reconnect, bots, exchange and forfeit checks. Browser375x667 verified wish grid fits without overflow, selection closes, confirmation opens and cancellation restores focus. Actual iPhone/Samsung hardware not tested.
- No merge, version bump or deployment in this task. Preserve unrelated research/strategy changes and concurrent status entries. Final `npm run check`, all 211 tests (154 unit + 57 UI), `npm run format:check`, and `npm run build` passed.

- Scoped release prepared on current main, excluding unrelated research commits and untracked strategy work. Version 0.8.12 with Korean/English release notes.

## v0.8.12 release verified — 2026-11-25

- Scoped main commit `b4b4637` releases special-card confirmation, wished-bomb priority and spectator dealt hands. Unrelated research work remains on its original branch/worktree.
- Release checks passed: check, 201 tests (144 unit + 57 UI), format, build and isolated Worker18950 integration. CI45585046484 succeeded including Worker/idle/flow checks. Pages45585045657 succeeded.
- Worker `e70a926b-1c57-4a1b-b741-3bdab26ff471` is at100%; health returnedok/version6. Production HTML/JS/CSS exactly match the v0.8.12 local build; production lounge welcome passed. No storage migration/reset. Temporary local Worker stopped. Actual iPhone/Samsung hardware remains unverified.

## Play-first special-card selection — local follow-up

- Implemented on `fix/play-first-special-choice` in `/tmp/tichu-special-release` from the deployed v0.8.12 baseline; original research workspace is preserved.
- Removed pre-play Dog/Mahjong selectors and the separate Dragon recipient selector. Play opens a button-choice confirmation for Dog/Mahjong; Give trick opens opponent choice for Dragon. No default is silently submitted: choose a button then confirm, or cancel without submitting. Dragon play retains its confirmation; recipient choice occurs when awarding its won trick.
- Modal choice and submission now occur in one dialog; no intermediate dragonTarget request. Selection/revision/phase/turn changes dismiss stale pending actions. Existing game clocks and server rules are unchanged.
- Required check, all201 tests (144 unit/57 UI), format and build passed. Tests cover all three choice flows, no pre-action controls, disabled confirmation before choosing, cancellation/focus restoration, repeated opening and stale revision dismissal. Real phone visual verification not performed for this follow-up. Not deployed.

## v0.8.13 deployment verified — 2026-11-25

- Main `f756ab9` includes play-first special choices (`8d53742`) and localized release notes. Check, 201 tests, formatting and build passed; CI45596595168 succeeded including local Worker, idle and flow integration.
- Pages45596594227 succeeded. Production HTML, JavaScript and CSS match the local v0.8.13 build byte-for-byte. Existing Worker remains at100% version `e70a926b-1c57-4a1b-b741-3bdab26ff471`, healthok/version6; no backend change or redeploy required.
- Earlier not-deployed note for this follow-up is superseded. Original research workspace remains untouched. Real iPhone/Samsung verification remains pending.

## Turn feedback, timing, privacy and responsive cards — local implementation

- Branch `feat/turn-feedback-and-timing` in `/tmp/tichu-special-release`, based on released v0.8.13. Original research worktree untouched. No version bump, merge or deployment yet.
- User reversed spectator visibility: removed spectatorHands from server snapshots/types/UI; players and spectators receive only their authorized hand/public board. Exchange details and credentials remain private. AGENTS/README and real Worker tests reflect the reversal.
- Added five-second declaration dialog, persisted two-minute ordinary-turn allowance on Small Tichu, progress/last-five-second red warning, one server-authorized +30s request during final10s, and a persisted Dog-selection stage with its own30s. Dragon collection now allows30s. No paid services or schema reset.
- Finished Dog/Dragon recipients excluded. Dog may target either finished partner only if both finished, then next active seat leads. If every opponent finished, Dragon trick enters a separate team-owned card pool and scores directly for that team; it cannot be transferred with the last player's captured cards. Older saves without that pool remain compatible.
- Moved pass to hand heading on own turn; confirms a pass when legal plays exist. Play confirms combination/count. Enlarged board1.3x and replaced desktop centered horizontal hand flex with responsive grid; played cards wrap. Removed340px body minimum.
- Browser checked18 cards at320/375/768/1024/1440px: document width equals viewport, every card is inside horizontal bounds. Verified pass confirmation/cancel/focus restoration at375px. Screenshot `/tmp/tichu-ux-mobile.png`. Actual iPhone/Samsung hardware not tested.
- Check, unit/UI tests, format and build passed; final totals:149 unit +59 UI =208 passing tests. Local Worker flow also passed early-extension rejection and duplicate-request single-use enforcement. Local flow verifies30s Dragon and reconnect behavior; lounge suite verifies spectator privacy/capacity. Never report this as deployed until both frontend and Worker are released.

## Manual teams and declaration confirmation — local follow-up

- Implemented in `/tmp/tichu-special-release` on `feat/turn-feedback-and-timing`; not merged or deployed. Original research workspace remains untouched.
- Host selects random or manual teams. Manual starts all six participant slots in waiting; occupied seats reject competing arrivals, waiting counts toward six-player capacity, spectators are separate. Six online seated players trigger a persisted ten-second automatic start; returning to waiting cancels it. Start shuffles identities only within selected teams. Stale seat mappings are cleared before member-slot reuse.
- Small/Large Tichu now require confirmation. Opening confirmation adds ten seconds to an existing running clock once per player per round; cancel does not declare. Confirmed Small Tichu grants at least two minutes for the current ordinary timed turn. Large Tichu preparation has no running deadline, unchanged.
- Supersedes the earlier Dragon auto-team-pool decision: if every opponent finished, the winner explicitly chooses a finished opponent to receive the trick. Removed the unpublished team-owned pool implementation.
- Required check, 214 tests (152 unit +62 UI), formatting and build passed. Real local Worker check (`TEST_API=http://localhost:18952 node scripts/check-lobby.mjs`) passed seventh-player rejection, manual waiting/seat assignment, countdown cancellation, automatic start, within-team shuffle and identity pairing. Previous local flow/lounge checks cover the earlier timing/privacy batch.
- Browser fixture at375px confirms manual lobby fits without horizontal overflow; fixed participant counter wrapping. Temporary fixture removed. Actual iPhone/Samsung hardware remains unverified. Next release requires version/locale release notes and both Pages and Worker deployment verification; no deployment claimed.

## v0.8.14 deployment verified — 2026-11-25

- Main `c0f65ba` releases the turn-feedback/privacy batch `662de08` and manual teams/declaration confirmation `1d8e0f4`, with bilingual release notes. No unrelated research changes included.
- Required check,214 tests,format,build and local Worker flow passed. CI45630069309 succeeded including real Worker capacity/auth/idle/flow checks. Pages45630068204 succeeded; Cloudflare Pages production deployment `0fe28aa9-b670-4b4a-b624-2c73264ea102` points to this commit.
- Worker `9f4985b1-a55a-4696-b528-5991e02ca880` is deployed at100%; health returnedok/version6. Production Pages HTML/JS/CSS match the v0.8.14 local build byte-for-byte. One production lounge welcome succeeded and its socket was closed. No live-game mutation, storage reset or migration required.
- Supersedes the earlier not-deployed notes for this batch. Actual iPhone/Samsung device verification remains pending.

## v0.8.15 lobby start compatibility hotfix

- User reported five empty seats when alone. Bots are filled on explicit random-mode start, not on room entry; manual mode still requires six seated humans per the approved rule.
- Observed an existing browser lobby missing teamMode/isHost fields: its coordinator had no start button. Reload restored a separate saved practice game, so the report's exact original transport cause is not proven. Added a narrow fallback to authenticated snapshot leader only when isHost is absent; explicit false and spectator remain denied. Server start authorization is unchanged.
- Start button now explicitly says it fills empty seats with bots. Regression test covers missing field, emitted start action, and explicit non-host denial. Check,215 tests (152 unit +63 UI),format and build passed. Frontend-only release; Worker remains v0.8.14 implementation.

## v0.8.16 preparation deadline and responsive board

- User requested one three-minute budget covering initial ten cards, remaining eight and exchange. Added persisted round preparation clock shared by grand/exchange, unchanged on phase transition/reconnect. Old saves initialize a three-minute grace on their next clock sync. Preparation confirmation cannot extend this total cap; ordinary-play confirmation still adds10s.
- At expiry, pending Large declarations default to no call and bots complete pending exchanges, including connected humans. Server resolves all pending preparation decisions in one alarm, persists before broadcast; practice also uses the shared due-action logic. UI shows remaining preparation time/progress. No new declaration is automatically made.
- Increased mobile center minimum104→125px (short screens78→94px), scaling with viewport width; desktop board390→minimum468px and up to600px on wide displays. Browser375px measured center125.25px;1440px measured table547.2px. Neither document overflowed horizontally. Actual phone hardware not tested.
- User explicitly retained happy/garden/057 after public directory showed one player and one spectator; did not delete or mutate it. Latest public state at inspection was exchange round1.
- Check,217 tests (154 unit +63 UI),format and build passed. Real Worker flow passed new shared preparation timeout plus existing reconnect/turn/Dragon checks. Version0.8.16 with bilingual release note. Deployment verification pending.

## v0.8.16 release verification and v0.8.17 follow-up

- v0.8.16 commit7c9c1aa deployed: Worker7137b213-5e9b-4782-96d9-686f98671f18 at100%, Pages e3b4e85a-1c64-4e02-b5e8-027663cf426b; production HTML/JS/CSS matched local build. CI45632351950 passed. User then clarified that played cards should grow, not the board itself.
- v0.8.17 restores prior board dimensions and sizes played cards to available center width/height and combination length. Mobile minimum53px cards, desktop up to120px subject to fit; long combinations wrap without negative margins. Hand card sizes unchanged. Browser375px/18cards had no clipping or horizontal overflow;1440px single card117.8×168.3 and18cards fit center vertically. Mobile manual-lobby controls also fit375px. Temporary fixtures removed; no actual device verification.
- Manual team host can add/remove bots, bounded by six total human/bot membership slots. Waiting humans count toward this limit. New humans replace bots in displayed-seat order, enter waiting, and cancel countdown until seated; room list keeps entry enabled while bots can be replaced. Bot membership survives lobby alarms; bots are removed when switching modes. Six occupied seats with online humans and bots start after10s and preserve chosen teams, shuffling seats within teams. UI explicitly explains teams fixed/seats random.
- Check,218 tests (155 unit +63 UI),format,build passed. Real Worker18954 check-lobby passed adding/removing five bots, sequential human replacement, full human capacity rejection, waiting/seat claims/countdown cancellation/automatic start/team identity pairing. No production rooms deleted; user retained happy/garden/057. Release deployment verification pending.

## v0.8.18 confirmation stability, readable indices and deployment skew

- User identified disappearing PASS confirmation. PassAction watched a getter returning a new array on every game snapshot; unchanged broadcasts therefore closed the dialog. GameControls also watched object identity for top. Replaced with multi-source semantic-value watchers. Harmless snapshots/revisions/pending changes preserve dialogs and choices; real phase/turn/top/hand/wish changes invalidate them. Confirm clicks now keep dialogs pending until the resulting state changes; errors allow retry rather than losing selection. Regression tests cover equivalent cloned broadcasts, pending changes, pass acceptance/turn change and all three special choice flows.
- Played-card rank/suit now scale with card inline container size. Desktop117.8px card measured26.6px rank/18.5px suit; mobile53px card measured13px/10px. Browser preview confirmed visible K and suit; no phone hardware claim. Temporary fixtures removed.
- v0.8.17 CI45634240422 and Pages45634239553 succeeded; live assets matched build. However real production setBot returned invalidAction despite current deployed Worker. Cloudflare changed DO default code update strategy to deferred300s (official docs: https://developers.cloudflare.com/durable-objects/deployments/durable-objects-code-updates/). Applied existing version0daaac64-c1b6-43f2-81fa-19f96801f365 with explicit immediate strategy; production test room then successfully added and removed a bot. Test room left/cleaned; no existing player room changed. Record immediate strategy in wrangler config to avoid frontend/backend skew on future releases.
- Check,218 tests,format and build passed. Version0.8.18 with bilingual patch note; deployment verification pending.

## v0.8.18 deployment verified

- Mainbf8b47e deployed; CI45636111714 and Pages45636110454 succeeded. Cloudflare Pagesfa273f59-d78f-4bf4-b605-ae8e7161bfea serves assets byte-identical to localv0.8.18 build.
- Workerf109ff69-c7e0-491d-bb93-00f69bab28f8 deployed at100% with immediate strategy; healthok/version6. Production bot addition/removal was verified after forcing the preceding identical action implementation to update immediately; test room left afterwards. No live room reset or deletion.
- Supersedes pending deployment note above. Temporary local font-preview server stopped. Real iPhone/Samsung confirmation behavior remains a device QA limitation; cloned-snapshot regressions pass in component tests.

## v0.8.19 active player contrast

- Current-turn player keeps orange border and gains off-white background/dark-blue name, readable secondary text and dark own-player badge. Team badge colors remain unchanged; existing active-turn condition controls highlighting.
- Check,218 tests,format and build passed. Browser preview verified computed active colors and visible contrast; viewport override did not apply (observed1280px), so no narrow-device verification claim. Temporary fixture removed. Frontend-only release; Worker implementation unchanged. Deployment pending.

## v0.8.20 immediate bomb submission

- User requested bombs bypass confirmation. GameControls now submits an already-classified legal bomb directly from Play; normal combinations and special-card choices retain confirmation. Existing strength/turn/wish validation remains server-authoritative.
- Added four UI regressions covering rank bombs and straight-flush bombs on own/other turns, exact single submission and no dialog. Check,222 tests (155 unit +67 UI),format and build passed. Frontend-only; no Worker code change.
- Priorv0.8.19 live HTML/JS/CSS matched its local build. Current deployment verification pending.

## v0.8.21 Phoenix combination position

- Played-table cards now sort Phoenix using the engine-accepted phoenixRank, placing it next to the represented rank rather than always at the far right. Hand sorting and card identity/rank remain untouched; singles or metadata-free legacy combinations retain ordinary ordering.
- Four regression cases cover interior straight position, explicitly selected full-house role, pair sequence and pair, including input/card immutability. Check,226 tests (155 unit +71 UI),format and build passed. Frontend-only release; backend unchanged. Includes preceding immediate-bomb/current-player contrast releases. Deployment verification pending.

## v0.8.22 hand ordering and dark-mode turn visibility

- HandCards uses vue-draggable-plus 0.6.1 for mouse dragging and touch long-press reordering, with upper-right reset and Alt+Left/Right keyboard support. Manual order survives equivalent snapshots, prunes played cards, appends new cards and resets each round; selection and authoritative hand data are unchanged. Manual order is local to the mounted game view, not persisted across reloads.
- Current-turn player retains orange outline and gains an explicit localized label. Dark-mode media styling uses warm light amber with dark navy text rather than white inversion. Actual iPhone/Samsung dark-mode behavior remains unverified.
- Added regression coverage for reorder/reset, snapshot reconciliation, round reset, keyboard movement and accidental click suppression after dragging. Browser drag and reset verified; reset button disabled after restoring automatic order. Final checks and frontend deployment pending. Backend unchanged.
- Final check,228 tests (155 unit +73 UI),format and production build passed. No protocol/backend change, so existing Worker remains in place. Desktop browser verified drag without selecting cards and reset to automatic order; phone hardware remains a QA limitation.

## v0.8.22 deployment verified

- Main7a5cfb9 deployed. Pages45640736374 and Verify45640738743 succeeded, including local Worker integration, idle and flow checks. Live Pages HTML/JS/CSS matched the local0.8.22 build byte-for-byte; existing Worker health returned ok/protocol6. Frontend-only release; Worker version remains f109ff69-c7e0-491d-bb93-00f69bab28f8 from0.8.18.
- Preceding0.8.21 Verify45638874626 and Pages45638874179 also succeeded;0.8.22 includes Phoenix role ordering and direct bomb submission. Local preview stopped and temporary browser tab closed. No production room state modified for this release.

## Dragon recipient feedback (implemented, not deployed)

- Accepted Dragon collection records a public round/trick/recipient marker, explicitly included in server snapshots. GameView highlights the recipient name for five seconds, once per new marker; initial/reconnect snapshots do not replay old transfers. Equivalent broadcasts do not restart the timer. New rounds/unmount clear it. Reduced-motion preference uses static emphasis, with bilingual received-Dragon text.
- Check,230 tests (155 unit +75 UI),format and build passed. Real local Worker test:flow passed. Regression tests cover final-trick Dragon donation, recipient identity, repeated snapshots, expiry, subsequent donations and initial historical state. Actual mobile animation not visually verified. No version bump or production deployment in this change; next release requires both Worker and Pages because the event marker is server-authoritative.

## v0.8.23 release preparation

- Includes confirmed Dragon recipient feedback plus score-button dialog showing each completed round's team deltas and cumulative totals. Engine persists scoreHistory on round completion; public snapshots explicitly allow it. Existing rooms without earlier records show a missing-history notice instead of fabricated scores. Records survive subsequent rounds and normal durable/practice persistence.
- Score dialog supports close button, Escape, backdrop and trigger focus restoration; live updates preserve the open dialog. Responsive three-column table uses viewport-bounded modal and vertical scrolling. No actual phone visual verification.
- Check,231 tests (155 unit +76 UI),format and build passed. Real local Worker test:flow passed. Engine tests verify final round score and next-round retention; UI tests cover signed scores, live update, repeated opening, Escape/close and focus. Both server and frontend deployment pending.

## v0.8.23 verified; v0.8.24 mobile drag follow-up

- v0.8.23 Worker2d2f7696-95b4-4c8f-8f67-1b2a12a52933 deployed at100%; health ok/protocol6. Pages45642743272 succeeded and live HTML/JS/CSS matched the local build. Verify45642744625 exposed an existing random idle-seat test assumption (bot may already have led one card);9ed2977 corrected that assumption while preserving exact restored-hand comparison. Verify45643175298 passed including Worker, idle and flow integration checks.
- v0.8.24 disables native selection/callouts/image dragging on hand cards and descendants, cancels selectstart/contextmenu, replaces the long-press title tooltip with accessible description and uses Sortable fallback dragging. No global touchmove prevention or page-wide selection restriction. Normal taps and post-drag click suppression retained.
- Check,232 tests (155 unit +77 UI),format and build passed; new event regression verifies native menu/selection cancellation and ordinary tap selection. Real iPhone Safari/Samsung magnifier behavior remains unverified on hardware. Frontend-only follow-up; server remains v0.8.23 implementation. Deployment verification pending.

## v0.8.24 deployment verified

- Main54a3226 deployed. Pages45643749191 and Verify45643749435 succeeded, including local Worker, idle and full-flow integrations. Production HTML/JS/CSS matched local0.8.24 build. Backend remains verified2d2f7696-95b4-4c8f-8f67-1b2a12a52933 (v0.8.23 score history and Dragon transfer marker).
- Supersedes pending release notes above. No production room reset or deletion. Actual mobile long-press magnifier behavior still requires iPhone/Samsung hardware confirmation.

## Diamond ink distinction (not deployed)

- Changed diamond rank/suit ink from burnt orange #ba5114 to brighter golden orange #c18108, including the base stylesheet fallback. Heart ink and portrait artwork remain unchanged. Shared card styling applies to hands and played cards at every viewport size.
- Check,232 tests (155 unit +77 UI),format check and production build passed. No version bump or deployment; actual phone color appearance not verified.

## v0.8.29 diamond color release

- Rebased the approved golden-orange diamond ink onto latest main v0.8.28, preserving audio features. Version/locale release notes updated. Check,247 tests (155 unit +92 UI),format check and build passed. Frontend-only; Worker implementation unchanged. Deployment verification pending.

## v0.8.29 deployment verified

- Main9865290 deployed. Pages45767176849 and Verify45767177068 succeeded, including local Worker, idle and game-flow integration checks. Production HTML/JS/CSS match the local v0.8.29 build byte-for-byte; health ok/protocol6. This frontend-only release keeps the existing Worker implementation. Approved golden-orange diamond ink is live; actual phone hardware appearance remains unverified.

## Unique nicknames and single active room (not deployed)

- Server checks nickname uniqueness case-insensitively across connected identities and persisted human room members, excluding the same authenticated identity. Applies before hello replacement, create or join mutation, within the existing Durable Object gate. Offline members reserve their names while their membership exists; bots do not reserve user nicknames.
- Active game membership now blocks joining or watching another room, creating a room and plain leave. Explicit forfeit remains the exit path. Hello restores authoritative membership even with missing/foreign room hints, preferring active games; same-token reconnect remains supported. Waiting-room moves still remove the previous waiting membership.
- Added admission-race, rename/create atomicity, offline name reservation, reconnect and forfeit-before-switch regressions. Updated fixtures to distinct names and added real WebSocket nickname/other-room-watch rejection checks. Check,251 tests (159 unit +92 UI),format and build passed. Fresh local Worker integration passed including 30/31 identities, 5/6 room race, privacy, bots, reconnect and forfeit. One earlier run was interrupted by development server reload; final unchanged-code run passed. Local Worker stopped. No version bump, commit or production deployment yet; both Worker and frontend need release together for localized errors.
- Identity is the existing browser token, not a verified account/person: a separate browser/profile with a different token and nickname cannot be identified as the same human by this change.

## v0.8.30 release preparation

- Includes server-enforced unique nicknames and single active room, automatic membership recovery, localized errors and release notes. Check,251 tests,format and build passed again with release metadata; prior fresh local Worker integration passed for this implementation. Worker/Pages deployment verification pending.

## v0.8.30 deployment verified

- Main698c1b8 deployed. Pages45777613746 and Verify45777614556 succeeded, including local Worker, idle and full game-flow integrations. Production HTML/JS/CSS matched the local v0.8.30 build byte-for-byte.
- Worker57948b7b-94fd-45c1-a4df-358ea25aaf4e is deployed at100% (deployment f0f03699-2927-4b1a-b62e-c0c7bb4f61b1); health ok/protocol6. Existing immediate Durable Object update strategy retained. No production room reset or load testing. Supersedes pending implementation/deployment notes above.

## Bot pass and Dragon timing (not deployed)

- Bot pass waits until five seconds after the current turn begins. A persisted deadlineStartedAt anchors thinking time independently of human deadline extensions and repeated broadcasts. Existing ordinary-play pacing remains unchanged.
- Bot/idle takeover now handles trick collection directly after five seconds, including choosing a valid Dragon recipient, instead of waiting for the human thirty-second selection deadline. Human Dragon selection retains thirty seconds. Shared delay helper also applies to local practice.
- Check,253 tests (161 unit +92 UI),format and build passed. Regressions verify no pass/Dragon collection before five seconds, collection at five seconds, and pass timing unaffected by deadline extension. Real local Worker test:flow passed (preparation, disconnect/reconnect, ordinary timeout and human Dragon selection). No version bump or production deployment.

## Cancel Dog selection before playing another card (not deployed)

- Root cause: modal cancel only cleared UI while authoritative dogPending continued to lock every non-Dog play. Added authenticated cancelDog action and wired dialog cancel/Escape/backdrop through it. Cancelling restores the original turn clock, allowing Mahjong wish selection or another legal play.
- Preserve the first Dog-selection expiry across cancellation/reopening to prevent repeated thirty-second grants. New turns clear saved Dog clock metadata; server-owned timing is never accepted from request fields. Earlier bot timing work remains included and uncommitted.
- Check,255 tests (162 unit +93 UI),format and build passed. UI regression covers Dog modal cancel then Mahjong wish dialog; engine covers unauthorized cancellation, original clock restoration, no repeated extension and Mahjong submission with Dog retained. Real local Worker test:flow passed including new cancelDog wire action followed by Mahjong wish. No version bump or deployment; next release must deploy Worker and Pages together.

## v0.8.31 release preparation

- Packages and bilingual release note updated for Dog cancellation and five-second bot pass/Dragon handling. Check,255 tests,format and production build passed with release metadata. Local Worker flow integration previously passed for this implementation including cancelDog then Mahjong. Worker and Pages deployment verification pending.

## v0.8.31 deployment verified

- Maine47fca9 deployed. Pages45779988512 and Verify45779989286 succeeded including local Worker, idle and flow integration. Production HTML/JS/CSS matched local v0.8.31 byte-for-byte. Worker315f65c4-1816-48b1-9a9b-5f8988d352d8 is at100%; health ok/protocol6. No room reset or production load tests.
- During deployment the user asked about fifth/sixth scoring. Verified current finishRound: fifth finisher keeps captures for own team; sixth player's captures go to first finisher, remaining hand points to sixth player's opposing team (triple victory separate). This differs from the user's described fifth-to-first/sixth-to-opponent rule. No scoring change authorized or included; reported discrepancy for clarification.

## Revised fifth/sixth scoring (not deployed)

- User explicitly changed ordinary round scoring: fifth finisher's captured points go to the first finisher's team; sixth player's captured points and remaining hand go to the sixth player's opposing team. First through fourth retain captures for their team. Triple victory and declaration scoring remain unchanged. Captured piles preserve ownership; allocation happens in the team delta calculation, then cumulative score/history.
- Added all648 non-triple finish-order permutations, including negative Phoenix captures, and checked allocation, total conservation, scores and history. Existing scoring/Dragon/triple/call regressions pass. Shared engine applies to server and practice. Historical completed round scores are not recalculated. README updated.
- Check,256 tests,format and build passed before audio follow-up; real local Worker test:flow passed, including reconnect/timers and Dog cancellation. No version bump or deployment.

## Audio return suspend race (not deployed)

- Found a reproducible race: a trusted foreground tap could accept a still-running context while its background suspend was pending, then the late suspend silenced it. Track the pending context; a trusted tap replaces it and detaches stale callbacks. Bound automatic waiting for background suspension to1.5s instead of hanging forever; next trusted tap can recover a stalled context. Preserve saved music/effects/volume choices.
- Added pending-suspend/tap/late-completion and never-resolving-suspend tests. Combined check,258 tests (163 unit +95 UI),format and build passed. Physical iPhone/Samsung verification remains unavailable. Asked whether report involves foreground return or complete browser restart; no response yet. Exact device cause is not established. No production deployment.

## v0.8.32 release preparation

- User confirmed audio issue occurs when returning from another app/tab to the existing game. Release includes revised fifth/sixth scoring and audio suspend-race recovery. Existing finished round scores are not rewritten. Physical phone recovery remains unverified.
- Version and bilingual release note updated. Check,258 tests,format and build passed again. Local Worker flow previously passed for the scoring implementation. Worker/Pages deployment verification pending.

## v0.8.32 deployment verified

- Main4444b66 deployed; Verify45781657286 succeeded including local Worker, idle and flow checks. Pages run45781656884 succeeded (its GitHub metadata references preceding docs commit); importantly live production HTML/JS/CSS matched the actual local v0.8.32 build byte-for-byte, independently confirming deployed frontend content.
- Worker6587f7b6-8c1f-4d65-a643-7afc7deaa276 is at100%; health ok/protocol6. New round completions use the revised fifth/sixth scoring; historical completed records remain unchanged. No production room reset or load tests. Audio return race fixes are live; physical iPhone/Samsung return behavior remains unverified.

## Collapsible scoring guide (not deployed)

- Added ScoringGuide after trick history at the very bottom of GameView, collapsed by default using native details/summary like the combination guide. Covers card values/200 total, ordinary rank transfers and Dragon ownership, triple victory, personal Small/Large declarations and match-end/tie rules.
- All content uses semantic scoringGuide keys in both Korean/English packs; no inline translated strings. Scoped wrapping and single-column lists keep long text readable. Isolated HTML rendering of the component structure/styles/English locale inspected at320px content width (headless Chrome's minimum viewport required explicit preview body width); not a real phone test.
- Check,258 tests,format and build passed. No engine/server change, version bump or production deployment.

## v0.8.33 release preparation

- Version and bilingual note updated for the bottom-of-game scoring guide. Check,258 tests,format and build passed again. Frontend-only; existing v0.8.32 Worker implementation retained. Deployment verification pending.

## v0.8.33 deployment verified

- Mainaa7b572 deployed. Pages45784914592 and Verify45784914312 succeeded, including local Worker, idle and flow integration. Production HTML/JS/CSS match the local v0.8.33 build byte-for-byte. Scoring guide is live at the bottom of gameplay in both locales.
- Frontend-only release; server remains v0.8.32 implementation (Worker6587f7b6-8c1f-4d65-a643-7afc7deaa276); production health ok/protocol6. No production room changes.

## Unified guide panels and Small Tichu action (not deployed)

- Added shared game-guides.css treatment to combinations, rules, current/match trick history and scoring disclosures: same border/background/radius,16px heading,56px minimum row,spacing,chevron and keyboard focus styling. Removed last-log summary preview so collapsed history matches other panels.
- Small Tichu uses a full-width52px green action matching Play dimensions; positioned below primary action. Both exchange/play controls hide it after first play or any existing declaration; spectators have no action. Temporary request locks still disable rather than flicker the eligible action away.
- Check,259 tests (163 unit +96 UI),format and build passed. Added eligibility regression covering first play,both declaration values,exchange and spectator. Isolated shared-CSS Korean previews inspected at390px and1000px content widths; not full live-game or physical phone validation. No version bump or deployment.

## v0.8.34 release preparation

- Updated version and bilingual release note for unified game disclosures and prominent eligible-only Small Tichu action. Check,259 tests,format and build passed again. Frontend-only; existing Worker implementation retained. Deployment verification pending.

## v0.8.34 deployment verified

- Mainc91b8e4 deployed. Pages45787399989 and Verify45787401623 succeeded including local Worker, idle and game-flow checks. Live production HTML/JS/CSS matched local v0.8.34 byte-for-byte. Unified disclosure panels and eligible-only green Small Tichu button are live.
- Frontend-only; existing Worker v0.8.32 implementation retained and health ok/protocol6. No production room state changes. Physical mobile interaction remains unverified; isolated mobile/desktop style previews and eligibility regression passed.

## Cross-screen UI consistency audit (not deployed)

- Reproduced home/hall/room guide mismatch: prior shared styles were scoped to .game and layered over old component/global rules. Added GuidePanel.vue with its own scoped disclosure layout and used it for combinations,rules,history and scoring; removed obsolete .rules/.activity/.combination-guide CSS. Native details/summary retained.
- Matched home entry/practice actions at48px and equal responsive widths; grouped footer version/caption. Added16px adjacent lounge panel gap and24px room subsection spacing. Gameplay Small Tichu styling retained. No game rules/protocol changes.
- Actual local-app screenshots inspected for home,language/sound dialogs,practice game and fixture-driven hall/manual room at390px, plus320px English home and1280px home/game. Guide headings all56px and home buttons both320×48px at390px viewport; checked no horizontal overflow. Native Space toggle/repeated click and language-dialog close/focus restoration verified. Full live multiplayer/all modals/device-specific accessibility not claimed.
- Check,260 tests (163 unit +97 UI),format and build passed. Added shared-guide regression for structure and open-state/node preservation across language changes. Evidence/report at /tmp/tichu-ui-style-audit.md and /tmp/audit-*.png. No version bump or deployment.

## v0.8.35 release preparation

- Version and bilingual note updated for shared GuidePanel across routes, home action/footer layout and lounge/room spacing. Check,260 tests,format and build passed again. Frontend-only; existing Worker implementation retained. Deployment verification pending.

## v0.8.35 deployment verified

- Maind0420f9 deployed. Pages45790272023 and Verify45790272823 succeeded, including local Worker, idle and game-flow integration. Live production HTML/JS/CSS matched local v0.8.35 byte-for-byte. Shared cross-screen guide panels and entry/spacing fixes are live.
- Frontend-only; existing v0.8.32 Worker implementation retained; production health ok/protocol6. No production room changes. Prior local actual-app screenshots cover320/390/1280px; physical phone validation remains outstanding.

## iPhone silent output after return (not deployed)

- User confirmed both music/effects silent on iPhone after app/tab return; toggling settings restores them. Previous recovery trusted running state and could retain a silent context. Exact device root cause remains unconfirmed.
- Mark interruption/background transitions and rebuild output once on next trusted gesture even if automatic resume reports running. Normal subsequent taps reuse context; automatic recovery reapplies saved gain settings. Always expose explicit Resume sound for supported browsers and force context reconstruction without changing preferences.
- Added regression for successful-looking automatic resume followed by one-time gesture recreation and both music/effects start, repeated taps avoiding more recreations, and explicit restart preserving disabled preferences. Updated modal test to require retry even when needsResume is false.
- Check,262 tests (163 unit +99 UI),format and build passed. No physical iPhone listening test and no production deployment/version bump. Server unchanged.

## v0.8.36 release preparation

- Version and bilingual release note updated for one-time foreground gesture output rebuild and always-available Resume sound. Check,262 tests,format and build passed again. Frontend-only; existing Worker retained. Production deployment verification pending; physical iPhone listening still required.

## v0.8.36 deployment verified

- Main519c5da deployed. Pages45799759477 and Verify45799760274 succeeded including Worker, idle and game-flow integration. Live HTML/JS/CSS match local v0.8.36 byte-for-byte. Audio interruption recovery and always-available Resume sound are live.
- Frontend-only; existing v0.8.32 Worker implementation retained; health ok/protocol6. No production room changes. Device listening remains unverified: user should confirm iPhone app/tab return and first-tap recovery, with explicit sound-settings restart available.
