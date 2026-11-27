# Production rollout: 100 connected identities

## Capacity

- 100 authenticated browser identities total, including hall visitors, players
  and spectators; 20 rooms with six seats each. Bots do not consume identities.
- 120 transport sockets bound handshake/reconnect headroom; unauthenticated
  sockets expire after ten seconds. Existing per-IP connection and per-socket
  message limits remain. This is not 100 verified people: anonymous clients can
  create multiple identities. Member authentication is a separate project.
- Shared directory and room presence are computed once per broadcast. Private
  hands remain personalized. No state-schema or credential migration.
- A single public Lounge Durable Object still coordinates sockets, clocks and
  commits; v0.8.43 room-engine compute isolation is preserved. This release does not claim
  horizontal room isolation, 500-user support, or 24/7 operation in free quotas.
- Run `npm run test:server` and `npm run test:capacity` against separate fresh
  local Workers via `TEST_API`. Both scripts reject production destinations.
  The capacity scenario exercises 100 sockets / 20 rooms / five simulated people
  and one server bot per room, followed by 20 simultaneous identity reconnects.
  Its two-minute measurements include polling and local processing, not internet
  latency or production-region performance. A longer soak and account usage
  inspection remain needed before promising sustained capacity.

## Domain: pending purchase and ownership confirmation

Preferred candidate: `tichu6.com`. On 2026-11-27, Verisign RDAP returned HTTP404.
That is not a registrar reservation or a final purchase quote. Cloudflare's
published `.com` registration and renewal price is $11.17/year before applicable
checkout taxes; registry price and currency changes can change future renewals.
No domain purchase, payment, auto-renew selection or paid-plan upgrade authorized
or performed by this change.

1. Sign in to the existing Cloudflare account and inspect the exact domain offer.
   Obtain approval of the final price/term before purchasing; complete registrant
   details, agreement and email verification with the owner.
2. Associate the domain with the existing Pages project through Custom domains
   and wait for DNS validation and an active TLS certificate. Add `www` only if
   chosen, then decide the canonical hostname. Do not configure arbitrary CNAMEs
   without associating the hostname with Pages first.
3. Only after ownership is established, add the exact HTTPS origin(s) to
   `server/policy.ts`, deploy the Worker, and test CORS plus WebSocket admission
   and a normal game through the new origin. Never allow wildcard origins.
4. The existing workers.dev backend can remain initially. An optional
   `api.tichu6.com` requires a Worker custom domain and a matching frontend API
   change; it is not required for the new website address.
5. Keep the pages.dev origin working during transition. localStorage belongs to
   each origin: existing guest credentials, saved practice and preferences do
   not automatically transfer. Never carry raw reconnect tokens in URL/query
   strings. Do not redirect ongoing games away from the old origin.
6. Verify both locales, login/entry, room creation, play, spectating, reconnect,
   version modal and mobile layout on the new domain. Update canonical/social
   metadata only when the final domain is live.

## Operations before wider promotion

Inspect Workers / Durable Objects account metrics and daily free quotas, set
owner-approved usage and error notifications, and test backup/restore. Monitor
admission rejections, action latency, reconnect failure and room progress. Do
not log raw messages, private hands or credentials. Paid Workers, WAF products,
member authentication and retention/audit tooling need explicit scope and budget;
this capacity release does not silently enable them.

## Rollback

Redeploy the previous tested frontend and Worker versions together. No stored
rooms are deleted and no schema rollback is required. Lowering limits does not
kick out existing admitted identities; it rejects new identities/room creation
until below the old cap. Keep the old origin available through any domain rollback.
