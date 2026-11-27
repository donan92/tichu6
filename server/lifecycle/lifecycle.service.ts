import { botDelay } from '../../src/game-clock.ts';
import { GameExecutor } from '../game/executor.ts';
import { syncLobby } from '../room/lobby-policy.ts';
import { syncReconnectClock } from '../game/reconnect-clock.ts';
import { TRAINING_RETENTION_MS } from '../training/records.ts';
import { GRACE, TTL, IDLE, ROOM_IDLE, ROOM_EMPTY } from '../policy.ts';
import type { RoomRepository } from '../persistence/room.repository.ts';
import type { Connections } from '../transport/connections.ts';
import type { RoomService } from '../room/room.service.ts';
export class LifecycleService {
  readonly executor: GameExecutor;
  readonly repository: RoomRepository;
  readonly connections: Connections;
  readonly rooms: RoomService;
  constructor(
    repository: RoomRepository,
    connections: Connections,
    rooms: RoomService,
    executor = new GameExecutor(),
  ) {
    this.executor = executor;
    this.repository = repository;
    this.connections = connections;
    this.rooms = rooms;
  }
  refreshPresence() {
    const now = Date.now();
    const rooms = Object.values(this.repository.data.rooms);
    const presence = this.connections.presence(rooms);
    for (const r of rooms) {
      const online = presence.get(r.id)!;
      r.members.forEach((m, i) => {
        if (m) {
          if (online[i]) m.offlineSince = null;
          else m.offlineSince ??= now;
        }
      });
      syncReconnectClock(r, online, now);
      syncLobby(r, online, now);
      if (online.some(Boolean)) {
        r.lastActive = now;
        r.emptySince = null;
      } else r.emptySince ??= now;
    }
  }
  expireIdle(now: number) {
    for (const ws of this.connections.users()) {
      const a = this.connections.authenticated(ws);
      if (now - (this.repository.data.activity[a.hash] ?? now) < IDLE) continue;
      this.rooms.leaveWaiting(a.hash, null);
      for (const r of Object.values(this.repository.data.rooms))
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
  expireStalledRooms(now: number) {
    let changed = false;
    for (const [id, r] of Object.entries(this.repository.data.rooms)) {
      const emptyExpired =
        r.emptySince != null &&
        !this.connections.online(r).some(Boolean) &&
        now - r.emptySince >= ROOM_EMPTY;
      if (!emptyExpired && now - (r.lastProgress ??= now) < ROOM_IDLE) continue;
      delete this.repository.data.rooms[id];
      changed = true;
      for (const ws of this.connections.users()) {
        const a = this.connections.attachment(ws);
        if (a.room !== id) continue;
        a.room = null;
        a.watch = false;
        ws.serializeAttachment(a);
      }
    }
    return changed;
  }
  cleanup() {
    this.expireStalledRooms(Date.now());
    for (const [hash, at] of Object.entries(this.repository.data.activity))
      if (
        Date.now() - at >= TTL &&
        !this.connections
          .users()
          .some((ws) => this.connections.attachment(ws).hash === hash)
      )
        delete this.repository.data.activity[hash];
    for (const [id, r] of Object.entries(this.repository.data.rooms))
      if (
        !r.members.some((m) => m && !m.bot) ||
        (Date.now() - r.lastActive >= TTL &&
          !this.connections.online(r).some(Boolean))
      ) {
        delete this.repository.data.rooms[id];
        for (const ws of this.connections.users()) {
          const a = this.connections.attachment(ws);
          if (a.room === id) {
            a.room = null;
            a.watch = false;
            ws.serializeAttachment(a);
          }
        }
      }
  }
  async schedule() {
    const now = Date.now();
    let at = Infinity;
    for (const session of this.repository.training.sessions)
      at = Math.min(at, session.createdAt + TRAINING_RETENTION_MS + 1);
    for (const time of Object.values(this.repository.data.activity))
      at = Math.min(at, time + TTL);
    for (const ws of this.connections.sockets())
      if (!this.connections.attachment(ws).hash)
        at = Math.min(
          at,
          (this.connections.attachment(ws).created || now) + 10000,
        );
      else
        at = Math.min(
          at,
          (this.repository.data.activity[
            this.connections.authenticated(ws).hash
          ] ?? now) + IDLE,
        );
    const rooms = Object.values(this.repository.data.rooms);
    const presence = this.connections.presence(rooms);
    for (const r of rooms) {
      at = Math.min(at, r.lastProgress + ROOM_IDLE);
      if (r.emptySince != null) at = Math.min(at, r.emptySince + ROOM_EMPTY);
      if (r.state.phase === 'lobby' && r.autoStartAt != null)
        at = Math.min(at, r.autoStartAt);
      if (r.state.phase !== 'lobby' && r.state.deadline != null)
        at = Math.min(at, r.state.deadline);
      const online = presence.get(r.id)!,
        s = r.state;
      for (const [i, m] of r.members.entries()) {
        if (!m || online[i]) continue;
        const needs =
          s.phase === 'lobby' ||
          ((online.some(Boolean) || r.members.some((member) => member?.idle)) &&
            ((s.phase === 'grand' && !s.ready[i]) ||
              (s.phase === 'exchange' && !s.exchanges[i]) ||
              (s.phase === 'play' && s.turn === i && (m.bot || m.idle)) ||
              (s.phase === 'trick' && s.last === i && (m.bot || m.idle))));
        if (
          needs &&
          (m.bot || m.idle) &&
          (s.phase === 'play' || s.phase === 'trick')
        ) {
          at = Math.min(
            at,
            now + botDelay(s, await this.executor.bot(r.id, s, i), now),
          );
        } else if (needs)
          at = Math.min(
            at,
            Math.max(
              now + 2000,
              m.bot || m.idle ? now + 2000 : (m.offlineSince ?? now) + GRACE,
            ),
          );
      }
    }
    await this.repository.alarm.update(
      Number.isFinite(at) ? Math.max(now + 1000, at) : null,
    );
  }
}
