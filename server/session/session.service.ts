import { AppError } from '../../src/messages.js';
import { nickname } from '../transport/protocol.ts';
import { IDLE, MAX_IDENTITIES } from '../policy.ts';
import type { JsonObject } from '../types.ts';
import type { RoomRepository } from '../persistence/room.repository.ts';
import type { Connections } from '../transport/connections.ts';
import type { RoomService } from '../room/room.service.ts';

export async function authenticateHello(msg: JsonObject) {
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
  return { name, hash };
}
export class SessionService {
  readonly repository: RoomRepository;
  readonly connections: Connections;
  readonly rooms: RoomService;
  constructor(
    repository: RoomRepository,
    connections: Connections,
    rooms: RoomService,
  ) {
    this.repository = repository;
    this.connections = connections;
    this.rooms = rooms;
  }
  // Caller holds the Durable Object concurrency gate across admission and persist.
  admit(
    ws: WebSocket,
    msg: JsonObject,
    identity: { name: string; hash: string },
    now: number,
  ): boolean {
    const { name, hash } = identity;
    const lastActivity = this.repository.data.activity[hash];
    if (
      lastActivity != null &&
      now - lastActivity >= IDLE &&
      msg.manual !== true
    ) {
      ws.serializeAttachment({ created: now, idle: true });
      ws.close(4009, 'Idle timeout');
      return false;
    }
    const existing = this.connections
      .users()
      .find((s) => this.connections.attachment(s).hash === hash);
    if (!existing && this.connections.users().length >= MAX_IDENTITIES)
      throw new AppError('error.loungeFull');
    const old = existing ? this.connections.attachment(existing) : null;
    if (existing) {
      existing.serializeAttachment({ created: now });
      existing.close(4001, 'Replaced');
    }
    this.repository.data.activity[hash] =
      msg.manual === true ? now : (lastActivity ?? now);
    ws.serializeAttachment({
      ...this.connections.attachment(ws),
      hash,
      name,
      room: null,
      watch: false,
      trainingConsent: msg.trainingConsent === true,
    });
    const resume = typeof msg.roomId === 'string' ? msg.roomId : old?.room;
    if (resume && this.repository.data.rooms[resume]) {
      const r = this.repository.data.rooms[resume];
      if (r.members.some((m) => m?.hash === hash) || msg.watch === true)
        this.rooms.enter(ws, resume, msg.watch === true, name);
    }
    return true;
  }
}
