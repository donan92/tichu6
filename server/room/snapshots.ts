import {
  exchangeReview,
  points,
  view,
  visibleHistory,
  visibleLog,
} from '../../src/game.js';
import type { GameView } from '../../src/types';
import type { GameState, Room } from '../types.ts';
import type { RoomRepository } from '../persistence/room.repository.ts';
import type { Connections } from '../transport/connections.ts';

// Explicit allowlist: adding a private engine/storage field cannot expose it.
export function publicView(s: GameState): GameView {
  const base = {
    phase: s.phase,
    round: s.round,
    scores: s.scores,
    revision: s.revision,
    names: s.names,
    log: visibleLog(s),
    seat: -1,
    hand: [],
  };
  const round = s.phase === 'lobby' ? undefined : s;
  const fields = {
    trickHistory: visibleHistory(s),
    trickNumber: round?.trickNumber,
    callResults: round?.callResults || [],
    deadline: round?.deadline ?? null,
    dragonTarget: round?.dragonTarget ?? null,
    counts: s.hands.map((h) => h.length),
    ready: round?.ready || [],
    calls: round?.calls || [],
    played: round?.played || [],
    finish: round?.finish || [],
    top: round?.top || null,
    turn: round?.turn ?? null,
    last: round?.last ?? null,
    passed: round?.passed || [],
    wish: round?.wish || null,
    delta: round?.delta || null,
    exchangeReady: (round?.exchanges || []).map(Boolean),
    capturedPoints: (round?.captured || []).map(points),
  };
  return s.phase === 'lobby'
    ? { ...base, ...fields, phase: 'lobby' }
    : { ...base, ...fields, phase: s.phase };
}
export class Snapshots {
  readonly repository: RoomRepository;
  readonly connections: Connections;
  constructor(repository: RoomRepository, connections: Connections) {
    this.repository = repository;
    this.connections = connections;
  }
  directory(hash: string) {
    return Object.values(this.repository.data.rooms).map((r) => ({
      id: r.id,
      title: r.title,
      phase: r.state.phase,
      round: r.state.round,
      scores: r.state.scores,
      players: r.members.filter(Boolean).length,
      online: this.connections.online(r).filter(Boolean).length,
      spectators: this.connections.users().filter((ws) => {
        const a = this.connections.attachment(ws);
        return a.room === r.id && a.watch;
      }).length,
      mine: r.members.some((m) => m?.hash === hash),
    }));
  }
  state(r: Room, hash: string, watch: boolean) {
    const seat = watch ? -1 : r.members.findIndex((m) => m?.hash === hash);
    const online = this.connections.online(r);
    const snapshot = publicView(r.state);
    snapshot.names = r.members.map((m, i) => (m ? r.state.names[i] : ''));
    if (seat >= 0) {
      snapshot.seat = seat;
      snapshot.hand =
        r.state.phase === 'lobby'
          ? r.state.hands[seat]
          : view(r.state, seat).hand;
      snapshot.exchangeReview = exchangeReview(r.state, seat);
    }
    return {
      type: 'state' as const,
      value: {
        ...snapshot,
        reconnectUntil:
          r.state.phase === 'play' &&
          r.reconnectTurn?.key === r.state.deadlineKey &&
          !r.reconnectTurn?.resumed
            ? r.reconnectTurn?.until
            : null,
        roomId: r.id,
        title: r.title,
        spectator: seat < 0,
        leader: online.findIndex(Boolean),
        offline: online.map((x, i) => !x && !r.members[i]?.bot),
        bots: r.members.map((m) => !!(m?.bot || m?.idle)),
        paused: false,
      },
      online,
    };
  }
  broadcast() {
    const users = this.connections.users();
    for (const ws of users) {
      const a = this.connections.authenticated(ws);
      const room = a.room ? this.repository.data.rooms[a.room] : undefined;
      this.connections.send(ws, {
        type: 'directory',
        rooms: this.directory(a.hash),
        count: users.length,
      });
      this.connections.send(
        ws,
        room ? this.state(room, a.hash, !!a.watch) : { type: 'hall' },
      );
    }
  }
}
