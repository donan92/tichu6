# Private rooms and room engines

Private rooms share the existing five-room / thirty-connected-identity limits.
The creator chooses private before creation. Visibility cannot be toggled later.

## Invitations

- Cryptographic rejection sampling produces six characters from A–Z and 0–9.
  Codes are unique among current rooms and expire when their room is deleted.
- The directory exposes only a private flag, never the code. Every authenticated
  seated member receives the code in their private snapshot, including reconnects.
- Share copies a URL with a `#join=CODE` fragment. On opening, the client reads
  and removes the fragment, asks for a nickname if needed, and sends the code in
  the authenticated WebSocket body. Codes are not request paths or query strings.
- One six-character text input supports paste, uppercase normalization, Enter,
  native modal focus containment, Escape dismissal and focus restoration.
- The server rejects private spectators, including hello/resume watch attempts,
  and rejects direct-ID admission without prior membership. Code entry never
  overrides game phase, seat capacity, nickname uniqueness or one-game membership.
- Guess attempts are persisted per identity: five per minute, in addition to
  existing socket/IP limits. Reconnecting does not clear the attempt counter.
  There are no accounts; a new identity remains a new identity.
- A shared invitation is a bearer credential. Anyone with it can join an available
  seat. There is no code rotation, kick/ban system, or public spectator mode.

## Room engine separation

ROOM_ENGINES selects one RoomEngine Durable Object by room UUID. Deal generation,
accepted action evaluation and bot choice execute there. An engine persists its
last successful request hash/result before responding so retries survive object
reconstruction. Error results are not cached. Objects are instantiated lazily on
first game operation; idle result caches expire after 24 hours.

The Lounge remains authoritative for admission, membership, sockets, clocks,
training records and the final committed room snapshot. Engine outputs are
internal transition results, not public room state. The Worker exposes no direct
RoomEngine route. Tests without a namespace use the same shared engine locally;
production binds ROOM_ENGINES explicitly.

This is compute separation, **not complete room ownership sharding**: the Lounge
still serializes admission/actions, schedules timers and retains room snapshots.
It therefore remains a scaling bottleneck. No increased capacity or throughput
claim has been made. A subsequent full split needs per-room connections/alarms,
directory leases, cross-object identity reservation, and crash-safe handoff.
It must not be implemented by deleting existing rooms or dropping global limits.

Migration v3 adds a new SQLite class. Existing Lounge and legacy GameRoom classes,
storage keys, membership and reconnect credentials remain unchanged.
