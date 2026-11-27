import { AppError } from '../../src/messages.js';
import { newGame } from '../../src/game.js';
import { MAX_ROOMS } from '../policy.ts';
import { nickname } from '../transport/protocol.ts';
import type { RoomRepository } from '../persistence/room.repository.ts';
import type { Connections } from '../transport/connections.ts';
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

export class RoomService {
  readonly repository: RoomRepository;
  readonly connections: Connections;
  constructor(repository: RoomRepository, connections: Connections) {
    this.repository = repository;
    this.connections = connections;
  }
  assertNameAvailable(hash: string, name: string) {
    const key = name.toLowerCase();
    const connected = this.connections.users().some((ws) => {
      const a = this.connections.attachment(ws);
      return a.hash !== hash && a.name?.toLowerCase() === key;
    });
    const reserved = Object.values(this.repository.data.rooms).some((room) =>
      room.members.some(
        (member, seat) =>
          member?.hash &&
          member.hash !== hash &&
          room.state.names[seat]?.toLowerCase() === key,
      ),
    );
    if (connected || reserved) throw new AppError('error.nicknameTaken');
  }
  activeMembership(hash: string) {
    return Object.values(this.repository.data.rooms).find(
      (r) =>
        r.members.some((m) => m?.hash === hash) &&
        !['lobby', 'matchEnd'].includes(r.state.phase),
    );
  }
  leaveWaiting(hash: string, except: string | null) {
    for (const r of Object.values(this.repository.data.rooms))
      if (r.id !== except && ['lobby', 'matchEnd'].includes(r.state.phase)) {
        r.members = r.members.map((m, i) => {
          if (m?.hash !== hash) return m;
          r.state.names[i] = '';
          r.seatMap = r.seatMap?.map((slot) => (slot === i ? null : slot));
          r.autoStartAt = null;
          return null;
        });
      }
  }
  enter(
    ws: WebSocket,
    id: string,
    watch: boolean,
    name: string,
    code?: unknown,
  ) {
    const a = this.connections.authenticated(ws),
      r = this.repository.data.rooms[id];
    if (!r) throw new AppError('error.roomClosed');
    if (r.inviteCode) {
      if (watch) throw new AppError('error.privateSpectator');
      if (!r.members.some((m) => m?.hash === a.hash) && code !== r.inviteCode)
        throw new AppError('error.invalidInviteCode');
    }
    this.assertNameAvailable(a.hash, name);
    const active = this.activeMembership(a.hash);
    if (active && active.id !== id) throw new AppError('error.activeGame');
    const own = r.members.findIndex((m) => m?.hash === a.hash);
    if (own >= 0) {
      watch = false;
      r.state.names[own] = name;
      r.members[own]!.idle = false;
      r.members[own]!.trainingConsent = a.trainingConsent === true;
    }
    if (!watch && own < 0) {
      if (r.state.phase !== 'lobby') throw new AppError('error.watchOnly');
      // Human arrivals replace the first bot in displayed seat order.
      const bot =
        r.teamMode === 'manual'
          ? r.seatMap?.find((i) => i != null && r.members[i]?.bot)
          : undefined;
      const seat = bot ?? r.members.indexOf(null);
      if (seat < 0) throw new AppError('error.seatsFull');
      r.seatMap = r.seatMap?.map((i) => (i === seat ? null : i));
      r.autoStartAt = null;
      r.members[seat] = {
        hash: a.hash,
        offlineSince: null,
        trainingConsent: a.trainingConsent === true,
      };
      r.state.names[seat] = name;
    }
    this.leaveWaiting(a.hash, id);
    a.room = id;
    a.watch = watch;
    a.name = name;
    ws.serializeAttachment(a);
    r.lastActive = Date.now();
  }

  create(ws: WebSocket, input: unknown, privateRoom = false) {
    const a = this.connections.authenticated(ws);
    const name = nickname(input);
    this.assertNameAvailable(a.hash, name);
    if (this.activeMembership(a.hash)) throw new AppError('error.activeGame');
    if (Object.keys(this.repository.data.rooms).length >= MAX_ROOMS)
      throw new AppError('error.roomsFull');
    let inviteCode: string | undefined;
    if (privateRoom) {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      do {
        inviteCode = '';
        while (inviteCode.length < 6) {
          const byte = crypto.getRandomValues(new Uint8Array(1))[0];
          if (byte < 252) inviteCode += alphabet[byte % 36];
        }
      } while (
        Object.values(this.repository.data.rooms).some(
          (r) => r.inviteCode === inviteCode,
        )
      );
    }
    const id = crypto.randomUUID();
    this.repository.data.rooms[id] = {
      id,
      inviteCode,
      hostHash: a.hash,
      teamMode: 'random',
      seatMap: Array(6).fill(null),
      title: title(),
      state: newGame(Array(6).fill('')),
      members: Array(6).fill(null),
      lastActive: Date.now(),
      lastProgress: Date.now(),
    };
    this.enter(ws, id, false, name, inviteCode);
  }
  leave(ws: WebSocket) {
    const a = this.connections.authenticated(ws);
    if (this.activeMembership(a.hash)) throw new AppError('error.activeGame');
    this.leaveWaiting(a.hash, null);
    a.room = null;
    a.watch = false;
    ws.serializeAttachment(a);
  }
  forfeit(ws: WebSocket) {
    const a = this.connections.authenticated(ws);
    const room = a.room ? this.repository.data.rooms[a.room] : undefined;
    const seat = room?.members.findIndex((m) => m?.hash === a.hash) ?? -1;
    if (
      !room ||
      a.watch ||
      seat < 0 ||
      ['lobby', 'matchEnd'].includes(room.state.phase)
    )
      throw new AppError('error.cannotForfeit');
    room.members[seat] = { bot: true };
    a.room = null;
    a.watch = false;
    ws.serializeAttachment(a);
  }
}
