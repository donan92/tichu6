# Project status / resume point

## Last released baseline
- v0.3.0, commit `6f60568`: authoritative Worker, SQLite Durable Objects, automatic reconnect, 45-second offline bots, 24-hour inactive-room retention.
- Frontend https://tichu6.pages.dev/
- Worker https://tichu6-server.kelp-swaths-7q.workers.dev
- 31 automated tests passed; six real WebSocket clients, capacity, host departure, same-hand reconnect, and real offline alarm verified.

## Current task — in progress
Implement public lounge (30 total connected users including spectators), five rooms, automatic random titles, nicknames up to five characters, and public-state spectators. Strengthen server security and contributor documentation.

Decisions approved by user:
- Thirty includes people playing and watching, not just idle lobby users.
- Room titles are generated automatically, no manual editing in this version.
- Preserve Cloudflare free-tier deployment.

Current checkpoint:
- Lounge server, frontend, privacy checks, and capacity tests are implemented locally but not yet released.
- Local verification: 39 tests, syntax checks, build, and diff whitespace checks passed. Local WebSocket integration previously passed; rerun after subsequent protocol changes before release.
- Agent/contributor guidance and dependency automation are being committed separately from the unfinished lounge release.

Next:
1. Review local lounge changes and rerun isolated Worker integration checks after rate-limit changes.
2. Run browser smoke tests and update README for the new protocol.
3. Ensure Pages build copies `_headers` (use the new `npm run build` command).
4. Deploy Worker then Pages, verify both, and update this status. Legacy v0.3 rooms require a compatibility review before release.

## Dependency maintenance checkpoint
- User requested automatic latest stable Python/JavaScript library maintenance.
- Added daily npm and GitHub Actions Dependabot configuration (major updates included). Python automation must be added with the first Python dependency manifest.
- This documentation change includes `.github/dependabot.yml`; scheduled updates become active when it reaches the default branch. Automatic merge is not configured.
- Python has no dependencies yet. JavaScript dependency manifests and the lockfile for the lounge implementation remain part of the separate unfinished release.
