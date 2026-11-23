# Agent instructions

## Product and decisions
- Korean six-player Tichu, alternating teams A/B, 108 cards. Exactly four same-rank cards make a rank bomb.
- Static HTML/CSS/JavaScript frontend on Cloudflare Pages; authoritative Workers + SQLite Durable Objects backend. No PeerJS or browser-host authority.
- Public lounge: at most 30 connected identities including players and spectators; at most five rooms. Random required room titles; nicknames one to eight ASCII letters (A-Z/a-z) or digits (0-9), case preserved; reject whitespace and other characters.
- Spectators see public state only. Never transmit private hands, exchange choices, identity hashes, or reconnection credentials to them.
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
- Keep vanilla JS and reuse `src/game.js`; do not add a frontend framework or build dependency without a concrete need.
- Use `npm test` and `npm run check`; use real local Worker integration checks for protocol changes.
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
- Prefer maintained libraries for standard capabilities; use i18next and its browser language detector for localization. Do not build a custom translation engine.
- Use semantic codes (for example `lounge.createRoom`), never Korean/English sentences as keys. All user-facing text belongs in `src/locales/ko.json` and `src/locales/en.json`. Keep key and placeholder parity.
- Add languages through `src/locales/index.js`. English is the fallback; preserve the selected language across reloads.
- Errors and game logs carry `{code, params}`; localize at rendering, not when storing game state. Escape translated text at the HTML boundary; language packs must not contain HTML.
