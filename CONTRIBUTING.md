# Contributing

Read `AGENTS.md` and `docs/STATUS.md` first. The interface supports English and Korean; code identifiers use English.

## Setup

Use Node.js 22.13 or newer (CI uses Node.js 26), Git, and npm. Install development tools with `npm ci` when a lockfile is present. No Cloudflare credential is required for unit tests or the local Worker.

```sh
npm test
npm run check
npm run format:check
npm run build
npm run dev:server
npm run dev
```

The static preview runs on port 5173; Wrangler uses 8787. See README for selecting the local API. Never test capacity limits against the public service while people may be playing.

## Changes and pull requests

- Create a topic branch and keep the change focused.
- Describe the user-visible problem and behavior, meaningful verification, and any migration or compatibility impact.
- Cover server authorization and malformed requests when changing the protocol. Cover hidden-card privacy when changing snapshots.
- Keep existing game-rule tests green; rule changes need an explicit product decision.
- Update README and the architecture/security docs when behavior changes. Update `docs/STATUS.md` for unfinished handoffs with exact next steps.
- Do not commit `.wrangler/`, `node_modules/`, credentials, access tokens, private game dumps, or real participant identifiers.

## Release

A maintainer deploys the backend with `npm run deploy:server` using their own Cloudflare login. Pushing approved changes to `main` triggers Pages. Check both deployment results and run a small production smoke test. Do not infer a live release from local tests. Paid upgrades and access expansion need explicit owner approval.

## Reporting issues

Include the visible version, browser, the action that failed, expected/actual behavior, and reproduction steps. Redact room/session credentials and private cards. Send security reports privately to the repository owner; do not publish exploitable details or secrets in a public issue.

## Dependency maintenance

- Keep JavaScript and Python libraries on the latest stable releases, including major versions. Do not use prereleases or floating CDN/latest URLs in production.
- Dependabot checks npm and GitHub Actions daily and opens update PRs. Commit manifest and lockfile updates together; require tests, syntax checks, build, and applicable Worker integration checks before merging. Failed upgrades must be repaired, not silently ignored or pinned indefinitely.
- Python currently has no dependency manifest in this project. When adding Python dependencies, add a managed manifest/lockfile, Python CI checks, and a matching pip or uv Dependabot entry in the same change. Do not add an empty Python environment merely for the updater.
- Automated update PRs are not automatic production releases. Do not claim updates are active until the configuration is on the default branch.

## Languages

Use i18next semantic keys, e.g. `lounge.createRoom` or `error.invalidNickname`. Add matching text and named interpolation variables to `src/locales/en.json` and `src/locales/ko.json`. Do not use sentences as keys or concatenate translated sentence fragments. For a new language, add its JSON file and native label to `src/locales/index.js`; the selector and supported-language list derive from that registry.

`npm test` verifies locale key/variable parity, plurals, regional fallback, language-neutral game records, and error privacy. Keep translations as plain text. Vue text interpolation escapes translated output, including toast messages; never use `v-html`. Dependencies are bundled locally with Vite, without a runtime CDN.

## Frontend architecture

- `src/main.ts` mounts Vue, Pinia, and i18next-vue. Views and components use `<script setup lang="ts">`.
- `src/stores/session.ts` owns room membership, connection state, selected cards, and practice scheduling. Keep the WebSocket and raw practice engine state out of deep reactive proxies.
- `src/server-room.ts` owns transport, bounded initial retries, heartbeat, and private local credentials. Preserve the v4 storage key so existing players can reconnect.
- `src/types.ts` defines protocol and game view contracts. Shared `src/game.js` remains the authoritative engine, with a declaration boundary for the TypeScript frontend. Server JavaScript is linted and tested, not TypeScript-checked.
- `npm run lint:fix` fixes lint issues; `npm run format` applies Prettier. CI requires zero lint warnings, strict type checks, formatting, unit/component tests, a build, an audit, and local Worker integration.
- JavaScript uses ES2026 via Vite/Oxc. TypeScript 6.0.3 supports named targets only through ES2025, so its no-emit checker uses ESNext. ESNext is not a fixed synonym for ES2026; Vite controls output. Do not introduce unsupported browser APIs solely because types exist.
- Orval is not used: gameplay uses WebSocket messages, not an OpenAPI HTTP contract. Reconsider if a substantive HTTP API is added.
- The js-beautify subdependency overrides update its vulnerable glob/editorconfig versions. Keep them until upstream adopts fixed releases; validate upgrades with component tests and npm audit.
- Environment files and Worker `.dev.vars` are ignored. Never place secrets in `VITE_*` variables: Vite exposes those to the browser. Account IDs and the public Worker URL are identifiers, not authentication secrets.

## Version and patch-note checklist

For **every version change**, bump `package.json` and the two root version fields
in `package-lock.json`, then prepend `{ "version": "x.y.z", "summary": "patches.semanticKey" }`
to `src/release-notes.json`. Add that key to all registered language packs. Keep old
entries; the modal displays only the newest five, one short sentence per version.

Write for players: new actions, visible improvements, or meaningful fixes. Use
`버그 수정` / `Bug fixes.` for routine changes with no useful player-facing detail.
Avoid technical release logs. The initial history groups patches by their actual
published version; it does not assign new version numbers to older deployments.

`npm run release:check` rejects missing current-version notes, duplicate or
misordered versions, inconsistent lockfile versions, missing translations, and
multiline/overlong summaries. It runs automatically in `npm run check` (and CI),
before `npm run build` (Pages), and before `npm run deploy:server`. Update the note
before running those commands; do not bypass the hooks. This validates completeness,
not editorial accuracy, so review the one-line summary before merging.
