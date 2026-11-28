import { AppError } from '../../src/messages.js';
import type { Attachment, AuthenticatedAttachment, Room } from '../types.ts';

export class Connections {
  readonly ctx: DurableObjectState;
  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }
  sockets() {
    return this.ctx.getWebSockets().filter((s) => s.readyState === 1);
  }
  users() {
    return this.sockets().filter((s) => this.attachment(s).hash);
  }
  attachment(ws: WebSocket): Attachment {
    // Attachments are server-owned, never populated directly from client JSON.
    return (ws.deserializeAttachment() as Attachment | null) || {};
  }
  authenticated(ws: WebSocket): AuthenticatedAttachment {
    const a = this.attachment(ws);
    if (!a.hash) throw new AppError('error.enterFirst');
    return { ...a, hash: a.hash };
  }
  online(room: Room) {
    const users = this.users().map((ws) => this.attachment(ws));
    return room.members.map(
      (m) =>
        !!m &&
        !m.bot &&
        users.some((a) => a.hash === m.hash && a.room === room.id && !a.watch),
    );
  }
  presence(rooms: Room[]) {
    const active = new Set(
      this.users().flatMap((ws) => {
        const a = this.attachment(ws);
        return a.room && !a.watch ? [`${a.room}:${a.hash}`] : [];
      }),
    );
    return new Map(
      rooms.map((room) => [
        room.id,
        room.members.map(
          (m) => !!m && !m.bot && active.has(`${room.id}:${m.hash}`),
        ),
      ]),
    );
  }
  send(ws: WebSocket, message: unknown) {
    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch {
      /* Disconnected sockets are cleaned up by their close event. */
      return false;
    }
  }
}
