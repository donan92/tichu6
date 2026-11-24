import { AppError } from '../../src/messages.js';
import { startRound, act, botAction, shuffle } from '../../src/game.js';
import { gameAction } from '../transport/protocol.ts';
import { GRACE } from '../policy.ts';
import type { Member, JsonObject } from '../types.ts';
import type { RoomRepository } from '../persistence/room.repository.ts';
import type { Connections } from '../transport/connections.ts';

export class GameService {
  readonly repository: RoomRepository;
  readonly connections: Connections;
  constructor(repository: RoomRepository, connections: Connections) {
    this.repository = repository;
    this.connections = connections;
  }
  apply(ws: WebSocket, msg: JsonObject) {
    const a = this.connections.authenticated(ws);
    const r = a.room ? this.repository.data.rooms[a.room] : undefined;
    const seat = r?.members.findIndex((m) => m?.hash === a.hash) ?? -1;
    if (!r || a.watch || seat < 0) throw new AppError('error.spectator');
    if (
      !Number.isSafeInteger(msg.revision) ||
      msg.revision !== r.state.revision
    )
      throw new AppError('error.staleState');
    const action = gameAction(msg.action);
    if (action.type === 'start' || action.type === 'next') {
      if (seat !== this.connections.online(r).findIndex(Boolean))
        throw new AppError('error.coordinator');
      // Deal/validate before changing membership; rejected starts stay atomic.
      const next = startRound(structuredClone(r.state));
      if (r.state.phase === 'lobby') {
        const humans = shuffle(
          r.members.flatMap((member, i) =>
            member ? [{ member, name: r.state.names[i] }] : [],
          ),
        );
        const slots = [shuffle([0, 2, 4]), shuffle([1, 3, 5])];
        const firstTeam = shuffle([0, 1])[0];
        const seats: ({ member: Member; name: string } | null)[] =
          Array(6).fill(null);
        humans.forEach((entry, i) => {
          const slot = slots[(i + firstTeam) % 2].pop();
          if (slot === undefined) throw new Error('Seat allocation exhausted');
          seats[slot] = entry;
        });
        const filled = seats.map(
          (entry, i) => entry || { member: { bot: true }, name: `Bot${i + 1}` },
        );
        r.members = filled.map((entry) => entry.member);
        next.names = filled.map((entry) => entry.name);
      }
      r.state = next;
    } else {
      if (r.state.phase === 'lobby') throw new AppError('error.invalidAction');
      r.state = act(r.state, seat, action);
    }
    r.lastActive = Date.now();
    r.lastProgress = Date.now();
  }
  advanceBots(now: number) {
    for (const r of Object.values(this.repository.data.rooms)) {
      const s = r.state,
        online = this.connections.online(r);
      const eligible = (i: number) => {
        const member = r.members[i];
        return (
          member &&
          !online[i] &&
          (member.bot ||
            member.idle ||
            now - (member.offlineSince ?? now) >= GRACE)
        );
      };
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
        if (seat != null && seat >= 0 && eligible(seat)) {
          r.state = act(s, seat, botAction(s, seat));
          r.lastProgress = now;
        }
      }
    }
  }
}
