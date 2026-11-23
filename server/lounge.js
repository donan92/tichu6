import { AppError, event, errorEvent } from '../src/messages.js';
import {
  newGame,
  shuffle,
  startRound,
  act,
  botAction,
  view,
  points,
  exchangeReview,
} from '../src/game.js';
const GRACE = 45000,
  TTL = 86400000,
  IDLE = 30 * 60 * 1000;
export function nickname(input) {
  if (typeof input !== 'string' || !/^[A-Za-z0-9]{1,8}$/.test(input))
    throw new AppError('error.invalidNickname');
  return input;
}
export function publicView(s) {
  return {
    phase: s.phase,
    round: s.round,
    scores: s.scores,
    revision: s.revision,
    names: s.names,
    log: s.log,
    counts: s.hands.map((h) => h.length),
    ready: s.ready || [],
    calls: s.calls || [],
    played: s.played || [],
    finish: s.finish || [],
    top: s.top || null,
    turn: s.turn ?? null,
    last: s.last ?? null,
    passed: s.passed || [],
    wish: s.wish || null,
    delta: s.delta || null,
    exchangeReady: (s.exchanges || []).map(Boolean),
    capturedPoints: (s.captured || []).map(points),
    seat: -1,
    hand: [],
  };
}
function title() {
  const a = ['moon', 'blue', 'sunset', 'star', 'quiet', 'happy'],
    b = ['garden', 'attic', 'forest', 'table', 'tea', 'lounge'],
    n = crypto.getRandomValues(new Uint32Array(3));
  return {
    adjective: a[n[0] % a.length],
    noun: b[n[1] % b.length],
    number: String(n[2] % 1000).padStart(3, '0'),
  };
}
export class Lounge {
  constructor(ctx) {
    this.ctx = ctx;
    this.data = { rooms: {} };
    ctx.blockConcurrencyWhile(async () => {
      this.data = (await ctx.storage.get('lounge')) || { rooms: {} };
      this.data.activity ||= {};
      // Old hibernated sockets get a full idle window when first upgraded.
      for (const ws of this.users()) {
        const { hash } = this.attachment(ws);
        this.data.activity[hash] ??= Date.now();
      }
      await this.persist();
      await this.schedule();
    });
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    );
  }
  sockets() {
    return this.ctx.getWebSockets().filter((s) => s.readyState === 1);
  }
  users() {
    return this.sockets().filter((s) => s.deserializeAttachment()?.hash);
  }
  attachment(ws) {
    return ws.deserializeAttachment() || {};
  }
  online(room) {
    return room.members.map(
      (m) =>
        !!m &&
        !m.bot &&
        this.users().some((ws) => {
          const a = this.attachment(ws);
          return a.hash === m.hash && a.room === room.id && !a.watch;
        }),
    );
  }
  async persist() {
    await this.ctx.storage.put('lounge', this.data);
  }
  async exclusive(fn) {
    let error;
    await this.ctx.blockConcurrencyWhile(async () => {
      try {
        await fn();
      } catch (e) {
        error = e;
      }
    });
    if (error) throw error;
  }
  send(ws, msg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* Socket may already be closed; presence cleanup still runs. */
    }
  }
  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket required', { status: 426 });
    if (this.sockets().length >= 40)
      return new Response('Too many connections', { status: 429 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({
      created: Date.now(),
      window: Date.now(),
      requests: 0,
    });
    await this.schedule();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  directory(hash) {
    return Object.values(this.data.rooms).map((r) => ({
      id: r.id,
      title: r.title,
      phase: r.state.phase,
      round: r.state.round,
      scores: r.state.scores,
      players: r.members.filter(Boolean).length,
      online: this.online(r).filter(Boolean).length,
      spectators: this.users().filter((ws) => {
        const a = this.attachment(ws);
        return a.room === r.id && a.watch;
      }).length,
      mine: r.members.some((m) => m?.hash === hash),
    }));
  }
  broadcast() {
    const users = this.users();
    for (const ws of users) {
      const a = this.attachment(ws),
        r = this.data.rooms[a.room];
      this.send(ws, {
        type: 'directory',
        rooms: this.directory(a.hash),
        count: users.length,
      });
      if (!r) {
        this.send(ws, { type: 'hall' });
        continue;
      }
      const seat = a.watch
        ? -1
        : r.members.findIndex((m) => m?.hash === a.hash);
      const online = this.online(r);
      const snapshot = publicView(r.state);
      snapshot.names = r.members.map((m, i) => (m ? r.state.names[i] : ''));
      if (seat >= 0) {
        snapshot.seat = seat;
        snapshot.hand = view(r.state, seat).hand;
        snapshot.exchangeReview = exchangeReview(r.state, seat);
      }
      this.send(ws, {
        type: 'state',
        value: {
          ...snapshot,
          roomId: r.id,
          title: r.title,
          spectator: seat < 0,
          leader: online.findIndex(Boolean),
          offline: online.map((x, i) => !x && !r.members[i]?.bot),
          bots: r.members.map((m) => !!(m?.bot || m?.idle)),
          paused: false,
        },
        online,
      });
    }
  }
  refreshPresence() {
    const now = Date.now();
    for (const r of Object.values(this.data.rooms)) {
      const online = this.online(r);
      r.members.forEach((m, i) => {
        if (m) {
          if (online[i]) m.offlineSince = null;
          else m.offlineSince ??= now;
        }
      });
      if (online.some(Boolean)) r.lastActive = now;
    }
  }
  activeMembership(hash) {
    return Object.values(this.data.rooms).find(
      (r) =>
        r.members.some((m) => m?.hash === hash) &&
        !['lobby', 'matchEnd'].includes(r.state.phase),
    );
  }
  leaveWaiting(hash, except) {
    for (const r of Object.values(this.data.rooms))
      if (r.id !== except && ['lobby', 'matchEnd'].includes(r.state.phase)) {
        r.members = r.members.map((m, i) => {
          if (m?.hash !== hash) return m;
          r.state.names[i] = '';
          return null;
        });
      }
  }
  enter(ws, id, watch, name) {
    const a = this.attachment(ws),
      r = this.data.rooms[id];
    if (!r) throw new AppError('error.roomClosed');
    const own = r.members.findIndex((m) => m?.hash === a.hash);
    if (own >= 0) {
      watch = false;
      r.state.names[own] = name;
      r.members[own].idle = false;
    }
    if (!watch && own < 0) {
      const active = this.activeMembership(a.hash);
      if (active && active.id !== id)
        throw new AppError('error.activeGameWatch');
      if (r.state.phase !== 'lobby') throw new AppError('error.watchOnly');
      const seat = r.members.indexOf(null);
      if (seat < 0) throw new AppError('error.seatsFull');
      r.members[seat] = { hash: a.hash, offlineSince: null };
      r.state.names[seat] = name;
    }
    this.leaveWaiting(a.hash, id);
    a.room = id;
    a.watch = watch;
    a.name = name;
    ws.serializeAttachment(a);
    r.lastActive = Date.now();
  }
  expireIdle(now) {
    for (const ws of this.users()) {
      const a = this.attachment(ws);
      if (now - (this.data.activity[a.hash] ?? now) < IDLE) continue;
      this.leaveWaiting(a.hash, null);
      for (const r of Object.values(this.data.rooms))
        for (const m of r.members)
          if (m?.hash === a.hash) {
            m.idle = true;
            m.offlineSince = now - GRACE;
          }
      // Revoke socket authorization before closing; queued actions cannot revive it.
      ws.serializeAttachment({ created: now, idle: true });
      ws.close(4009, 'Idle timeout');
    }
  }
  async webSocketMessage(ws, raw) {
    try {
      if (typeof raw !== 'string' || raw.length > 4096) {
        this.send(ws, { type: 'error', ...event('error.payload') });
        ws.close(1009, 'Payload too large');
        return;
      }
      let a = this.attachment(ws);
      const now = Date.now();
      if (now - (a.window || 0) >= 10000) {
        a.window = now;
        a.requests = 0;
      }
      a.requests = (a.requests || 0) + 1;
      ws.serializeAttachment(a);
      if (a.requests > 30) {
        this.send(ws, { type: 'error', ...event('error.rateLimit') });
        ws.close(4008, 'Rate limited');
        return;
      }
      const msg = JSON.parse(raw);
      if (!msg || Array.isArray(msg) || typeof msg.type !== 'string')
        throw new AppError('error.invalidRequest');
      if (msg.type === 'hello') {
        if (a.hash) throw new AppError('error.alreadyConnected');
        const name = nickname(msg.name);
        if (typeof msg.token !== 'string' || !/^[a-f0-9]{64}$/.test(msg.token))
          throw new AppError('error.invalidToken');
        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(msg.token),
        );
        const hash = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join('');
        await this.exclusive(async () => {
          this.expireIdle(now);
          const lastActivity = this.data.activity[hash];
          if (
            lastActivity != null &&
            now - lastActivity >= IDLE &&
            msg.manual !== true
          ) {
            ws.serializeAttachment({ created: now, idle: true });
            await this.persist();
            ws.close(4009, 'Idle timeout');
            this.broadcast();
            await this.schedule();
            return;
          }
          const existing = this.users().find(
            (s) => this.attachment(s).hash === hash,
          );
          if (!existing && this.users().length >= 30)
            throw new AppError('error.loungeFull');
          const old = existing ? this.attachment(existing) : null;
          if (existing) {
            existing.serializeAttachment({ created: now });
            existing.close(4001, 'Replaced');
          }
          this.data.activity[hash] =
            msg.manual === true ? now : (lastActivity ?? now);
          a = { ...a, hash, name, room: null, watch: false };
          ws.serializeAttachment(a);
          const resume =
            typeof msg.roomId === 'string' ? msg.roomId : old?.room;
          if (resume && this.data.rooms[resume]) {
            const r = this.data.rooms[resume];
            if (r.members.some((m) => m?.hash === hash) || msg.watch === true)
              this.enter(ws, resume, msg.watch === true, name);
          }
          this.refreshPresence();
          this.cleanup();
          await this.persist();
          this.send(ws, { type: 'welcome' });
          this.broadcast();
        });
      } else {
        if (!a.hash) throw new AppError('error.enterFirst');
        await this.exclusive(async () => {
          this.expireIdle(now);
          a = this.attachment(ws);
          if (a.idle) {
            this.refreshPresence();
            this.cleanup();
            await this.persist();
            this.broadcast();
            await this.schedule();
            return;
          }
          if (!a.hash) throw new AppError('error.replaced');
          if (msg.type === 'create') {
            const name = nickname(msg.name);
            if (this.activeMembership(a.hash))
              throw new AppError('error.activeGame');
            if (Object.keys(this.data.rooms).length >= 5)
              throw new AppError('error.roomsFull');
            // A participant may own only one waiting seat; creation never adds a sixth room.
            const id = crypto.randomUUID();
            this.data.rooms[id] = {
              id,
              title: title(),
              state: newGame(Array(6).fill('')),
              members: Array(6).fill(null),
              lastActive: Date.now(),
            };
            this.enter(ws, id, false, name);
          } else if (msg.type === 'join') {
            if (
              typeof msg.roomId !== 'string' ||
              !/^[a-f0-9-]{36}$/.test(msg.roomId) ||
              typeof msg.watch !== 'boolean'
            )
              throw new AppError('error.invalidRoom');
            this.enter(ws, msg.roomId, msg.watch, nickname(msg.name));
          } else if (msg.type === 'forfeit') {
            const r = this.data.rooms[a.room];
            const seat = r?.members.findIndex((m) => m?.hash === a.hash);
            if (
              !r ||
              a.watch ||
              seat < 0 ||
              ['lobby', 'matchEnd'].includes(r.state.phase)
            )
              throw new AppError('error.cannotForfeit');
            // Surrender removes the identity's seat claim; future joins are spectators only.
            r.members[seat] = { bot: true };
            a.room = null;
            a.watch = false;
            ws.serializeAttachment(a);
          } else if (msg.type === 'leave') {
            this.leaveWaiting(a.hash, null);
            a.room = null;
            a.watch = false;
            ws.serializeAttachment(a);
          } else if (msg.type === 'action') {
            const r = this.data.rooms[a.room],
              seat = r?.members.findIndex((m) => m?.hash === a.hash);
            if (!r || a.watch || seat < 0)
              throw new AppError('error.spectator');
            if (
              !Number.isSafeInteger(msg.revision) ||
              msg.revision !== r.state.revision
            )
              throw new AppError('error.staleState');
            const action = msg.action;
            if (
              !action ||
              Array.isArray(action) ||
              ![
                'start',
                'next',
                'grand',
                'exchange',
                'tichu',
                'pass',
                'collect',
                'play',
              ].includes(action.type)
            )
              throw new AppError('error.invalidAction');
            if (action.type === 'grand' && typeof action.call !== 'boolean')
              throw new AppError('error.invalidCall');
            if (
              ['play', 'exchange'].includes(action.type) &&
              (!Array.isArray(action.ids) ||
                action.ids.length > 18 ||
                action.ids.some(
                  (id) => typeof id !== 'string' || id.length > 30,
                ))
            )
              throw new AppError('error.invalidCards');
            for (const field of ['target', 'wish', 'phoenixRank'])
              if (
                action[field] != null &&
                (!Number.isInteger(action[field]) ||
                  action[field] < 0 ||
                  action[field] > 14)
              )
                throw new AppError('error.invalidChoice');
            if (['start', 'next'].includes(action.type)) {
              const online = this.online(r);
              if (seat !== online.findIndex(Boolean))
                throw new AppError('error.coordinator');
              // Validate and deal before changing membership: rejected starts are atomic.
              const next = startRound(structuredClone(r.state));
              if (r.state.phase === 'lobby') {
                const humans = shuffle(
                  r.members
                    .map(
                      (member, i) =>
                        member && {
                          member,
                          name: r.state.names[i],
                        },
                    )
                    .filter(Boolean),
                );
                const slots = [shuffle([0, 2, 4]), shuffle([1, 3, 5])];
                const firstTeam = shuffle([0, 1])[0];
                const seats = Array(6).fill(null);
                humans.forEach((entry, i) => {
                  seats[slots[(i + firstTeam) % 2].pop()] = entry;
                });
                for (let i = 0; i < 6; i++)
                  seats[i] ||= { member: { bot: true }, name: `Bot${i + 1}` };
                r.members = seats.map((entry) => entry.member);
                next.names = seats.map((entry) => entry.name);
              }
              r.state = next;
            } else r.state = act(r.state, seat, action);
            r.lastActive = Date.now();
          } else throw new AppError('error.unsupported');
          this.data.activity[a.hash] = now;
          this.refreshPresence();
          this.cleanup();
          await this.persist();
          this.broadcast();
        });
      }
      await this.schedule();
    } catch (error) {
      this.send(ws, { type: 'error', ...errorEvent(error) });
      if (!this.attachment(ws).hash && !this.attachment(ws).idle)
        ws.close(4003, 'Admission rejected');
    }
  }
  cleanup() {
    for (const [hash, at] of Object.entries(this.data.activity))
      if (
        Date.now() - at >= TTL &&
        !this.users().some((ws) => this.attachment(ws).hash === hash)
      )
        delete this.data.activity[hash];
    for (const [id, r] of Object.entries(this.data.rooms))
      if (
        !r.members.some((m) => m && !m.bot) ||
        (Date.now() - r.lastActive >= TTL && !this.online(r).some(Boolean))
      ) {
        delete this.data.rooms[id];
        for (const ws of this.users()) {
          const a = this.attachment(ws);
          if (a.room === id) {
            a.room = null;
            a.watch = false;
            ws.serializeAttachment(a);
          }
        }
      }
  }
  async disconnected(ws) {
    await this.exclusive(async () => {
      ws.serializeAttachment({ created: Date.now() });
      this.refreshPresence();
      this.cleanup();
      await this.persist();
      this.broadcast();
    });
    await this.schedule();
  }
  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1000 ? 1000 : 1001);
    } catch {
      /* Socket may already be closed; presence cleanup still runs. */
    }
    await this.disconnected(ws);
  }
  async webSocketError(ws) {
    try {
      ws.close(1011);
    } catch {
      /* Socket may already be closed; presence cleanup still runs. */
    }
    await this.disconnected(ws);
  }
  async schedule() {
    const now = Date.now();
    let at = Infinity;
    for (const time of Object.values(this.data.activity))
      at = Math.min(at, time + TTL);
    for (const ws of this.sockets())
      if (!this.attachment(ws).hash)
        at = Math.min(at, (this.attachment(ws).created || now) + 10000);
      else
        at = Math.min(
          at,
          (this.data.activity[this.attachment(ws).hash] ?? now) + IDLE,
        );
    for (const r of Object.values(this.data.rooms)) {
      at = Math.min(at, r.lastActive + TTL);
      const online = this.online(r),
        s = r.state;
      r.members.forEach((m, i) => {
        if (!m || online[i]) return;
        const needs =
          s.phase === 'lobby' ||
          ((online.some(Boolean) || r.members.some((member) => member?.idle)) &&
            ((s.phase === 'grand' && !s.ready[i]) ||
              (s.phase === 'exchange' && !s.exchanges[i]) ||
              (s.phase === 'play' && s.turn === i) ||
              (s.phase === 'trick' && s.last === i)));
        if (needs)
          at = Math.min(
            at,
            Math.max(
              now + 2000,
              m.bot || m.idle ? now + 2000 : (m.offlineSince ?? now) + GRACE,
            ),
          );
      });
    }
    if (Number.isFinite(at))
      await this.ctx.storage.setAlarm(Math.max(now + 1000, at));
    else await this.ctx.storage.deleteAlarm();
  }
  async alarm() {
    await this.exclusive(async () => {
      const now = Date.now();
      for (const ws of this.sockets())
        if (
          !this.attachment(ws).hash &&
          now - (this.attachment(ws).created || 0) >= 10000
        )
          ws.close(4003, 'Handshake timeout');
      this.expireIdle(now);
      this.refreshPresence();
      for (const r of Object.values(this.data.rooms)) {
        const s = r.state,
          online = this.online(r),
          eligible = (i) =>
            r.members[i] &&
            !online[i] &&
            (r.members[i].bot ||
              r.members[i].idle ||
              now - (r.members[i].offlineSince ?? now) >= GRACE);
        if (s.phase === 'lobby') {
          r.members = r.members.map((m, i) => {
            if (!eligible(i)) return m;
            s.names[i] = '';
            return null;
          });
        } else if (online.some(Boolean) || r.members.some((m) => m?.idle)) {
          const seat =
            s.phase === 'grand'
              ? s.ready.findIndex((x, i) => !x && eligible(i))
              : s.phase === 'exchange'
                ? s.exchanges.findIndex((x, i) => !x && eligible(i))
                : s.phase === 'play'
                  ? s.turn
                  : s.phase === 'trick'
                    ? s.last
                    : -1;
          if (seat >= 0 && eligible(seat))
            r.state = act(s, seat, botAction(s, seat));
        }
      }
      this.cleanup();
      await this.persist();
      this.broadcast();
    });
    await this.schedule();
  }
}
