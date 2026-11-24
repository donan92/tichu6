# Project status / resume point

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
