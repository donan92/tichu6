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

## Thirty-minute idle logout — local implementation, not deployed

- Branch `idle-logout`: authoritative lounge idle deadline covers players, spectators and hall users. Accepted create/join/leave/game requests or explicit entry reset the clock; ping/pong, broadcasts, rejected requests, reload and automatic reconnect do not. Local-only card selection is not a server action.
- At 30 minutes the server revokes socket authorization, closes with 4009 and frees connected capacity. Waiting seats are removed; ongoing seats retain identity/hand/team and become bot-controlled immediately, bypassing the normal 45-second disconnect grace. All-idle rooms finish the current round with bots, then wait for a user to start the next round. Ordinary all-offline pause and 24-hour expiry are preserved.
- Client clears the displayed game and returns home with localized explanation; idle sessions do not automatically reconnect on reload. Explicit entry reuses the private credential to recover the original seat and remaining hand. Existing storage migrates additively; activity timestamps/idle flags remain private, and existing public bot flags indicate takeover. Stale activity records expire after 24 hours.
- Passed 93 tests (68 unit, 25 UI/transport), zero-warning ESLint, strict frontend typecheck, Prettier and build. Exact-deadline, rejected-action, hibernation upgrade, automatic-reconnect, state-clearing and same-seat-return regressions added.
- Real isolated Worker tests passed existing capacity/authorization/privacy/reconnect/origin and five-bot progression cases. New `npm run test:idle` passed actual auto-response pings → close 4009 → bot progression → capacity release → rejected automatic retry → manual same-seat return. CI runs it using a local-only clock-aging fixture excluded from the production entrypoint. No real 30-minute production timeout or device-specific Safari test was performed.
- No deployment performed for this change. Next release step: merge and deploy frontend plus Worker together, verify both; existing room storage must be retained.
