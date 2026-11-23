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
- Worker deployed: `daf08d99-11fd-452e-92e9-476fc2daa182` (health v5). Pages deployment verification follows main push. Full npm audit: 0 vulnerabilities.
