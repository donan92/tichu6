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
- Updated regression coverage for one symbol and readable ranks across 2–10/A. Passed 68 tests, ESLint/typecheck, formatting and build. Desktop browser visually verified centered single symbols. Deployment pending.
