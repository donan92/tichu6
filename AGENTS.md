# Agent instructions

## Product and decisions

- Korean six-player Tichu (티츄), alternating teams A/B, 108 cards. Exactly four same-rank cards make a rank bomb.
- Deal 10 initial cards for Large Tichu (라지 티츄, ±200), then 8 more; Small Tichu (스몰 티츄, ±100) before first play. Fill empty seats with server bots on start, balance human/bot counts between teams (difference at most one) and randomize seats once per match, preserve teams across rounds and identity-based reconnects. Bots do not consume connected-identity capacity.
- Vue 3 + TypeScript + Vite frontend on Cloudflare Pages; authoritative Workers + SQLite Durable Objects backend. No PeerJS or browser-host authority.
- Public lounge: at most 30 connected identities including players and spectators; at most five rooms. Random required room titles; nicknames one to eight ASCII letters (A-Z/a-z) or digits (0-9), case preserved; reject whitespace and other characters.
- Spectators see public state only. Never send them private hands, exchange choices/receipts, identity hashes or reconnection credentials. Players must not receive opponents’ hands.
- Preserve reconnect and offline-player behavior. Do not require the creating browser to stay online.

## Resume work

1. Read `docs/STATUS.md`, `CONTRIBUTING.md`, and relevant code/tests. Treat docs as context, verify live state.
2. Run `git status --short --branch`; preserve unrelated uncommitted changes.
3. Continue the recorded next step. Record completed checks and concrete blockers in `docs/STATUS.md` before a handoff. Never mark deployment complete from a successful build alone.

## Engineering and security

- Enforce all limits and authorization server-side, including simultaneous arrivals. Derive player identity/seat from authenticated socket state, never request fields.
- Use cryptographic random reconnection tokens; keep raw tokens out of URLs, logs, commits, room lists, and public state.
- Bound payload sizes, request frequency, pending handshakes, and room lifetime. Validate message schemas; reject invalid actions without changing game state.
- Escape user text on rendering. Prefer explicit public-state allowlists. Spectator UI restrictions are not authorization.
- Persist accepted moves before acknowledging; recover after Durable Object hibernation. Test authorization failures and capacity races.
- Never silently upgrade to a paid Cloudflare plan, broaden GitHub permissions, or expose a credential.
- Apply least privilege to service integration. Origin checks supplement authentication; they do not stop non-browser attackers.

## Workflow

- Use Vue single-file components with `<script setup lang="ts">`, strict TypeScript, Pinia for shared session state, and Vite. Keep components focused; no HTML string rendering or `v-html`.
- Reuse the tested JavaScript engine `src/game.js` on both server and practice client. Maintain its TypeScript declarations alongside protocol types when changing its contract. The active backend uses Hono + strict TypeScript with services and a thin Durable Object adapter. Generate Cloudflare types with `npm run types:server`; `npm run typecheck:server` must pass. The shared engine and isolated legacy GameRoom remain JavaScript with declaration boundaries; do not claim their implementations are TypeScript-checked.
- JavaScript output targets ES2026 in Vite (development and production). TypeScript 6 currently lacks an ES2026 target, so use ESNext for type checking only; switch when the stable compiler supports ES2026. CSS targets are configured separately.
- Require `npm run check` (ESLint with zero warnings + vue-tsc), `npm test`, `npm run format:check`, and `npm run build`. Use real local Worker integration checks for protocol/transport changes.
- Test dangerous/large-load capacity scenarios locally, not against users on production.
- Frontend changes deploy automatically from `main`. Backend deploy is separate: `npm run deploy:server`. Confirm both versions before reporting release.
- Keep durable schema migrations backward-compatible. Do not erase live room state to simplify tests.
- Add meaningful tests for changed behavior and update documentation in the same change.

## Dependency maintenance

- Keep JavaScript and Python libraries on the latest stable releases, including major versions. Do not use prereleases or floating CDN/latest URLs in production.
- Dependabot checks npm and GitHub Actions daily and opens update PRs. Commit manifest and lockfile updates together; require tests, syntax checks, build, and applicable Worker integration checks before merging. Failed upgrades must be repaired, not silently ignored or pinned indefinitely.
- Python currently has no dependency manifest in this project. When adding Python dependencies, add a managed manifest/lockfile, Python CI checks, and a matching pip or uv Dependabot entry in the same change. Do not add an empty Python environment merely for the updater.
- Automated update PRs are not automatic production releases. Do not claim updates are active until the configuration is on the default branch.

## Internationalization and libraries

- Prefer maintained libraries for standard capabilities; use i18next, i18next-vue, and its browser language detector for localization. Do not build a custom translation engine.
- Use semantic codes (for example `lounge.createRoom`), never Korean/English sentences as keys. All user-facing text belongs in `src/locales/ko.json` and `src/locales/en.json`. Keep key and placeholder parity.
- Add languages through `src/locales/index.js`. English is the fallback; preserve the selected language across reloads.
- Errors and game logs carry `{code, params}`; localize at rendering, not when storing game state. Use Vue text interpolation for translated text; language packs must not contain HTML.

## Interaction quality

- Verify the full interaction, not just the resulting value: opening, selecting, dismissal, keyboard focus, and repeated use. Include narrow-screen checks for changed controls.
- Preserve native form control nodes during live updates, especially open selects. Do not steal focus or scroll during rerenders.
- Report device-specific verification limits honestly; desktop or narrow viewport checks are not real iPhone Safari testing.

## Release notes (required for every version change)

- Every version bump must update `package.json`, both root versions in `package-lock.json`, and prepend one entry to `src/release-notes.json` in the same change. Keep earlier entries; the version modal shows the latest five.
- Give each version its own semantic `patches.*` key with one short sentence in every registered locale. Describe only changes players will notice. For maintenance or minor fixes without meaningful player impact, write only “버그 수정” / “Bug fixes.” Do not list implementation details, CI, dependency names or commit IDs in the modal.
- Before release, run `npm run release:check`; it is also mandatory through `npm run check`, the build prehook and the server-deploy prehook. Never bypass these checks to ship a version without its note. Verify header/footer version triggers, dismissal, focus restoration and narrow screens when changing this UI.
- Summaries must describe changes actually included in that version. Do not invent historical version numbers for patches that previously shipped under the same version; summarize those changes together.
