import { hostSeat } from './lobby-policy.ts';
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
    scoreHistory: s.scoreHistory || [],
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
    dragonTransfer: round?.dragonTransfer,
    dogTransfer: round?.dogTransfer,
    callResults: round?.callResults || [],
    deadline: round?.deadline ?? null,
    deadlineDuration: round?.deadlineDuration ?? null,
    extensionUsed: round?.extensionUsed ?? false,
    callConfirmUsed: round?.callConfirmUsed ?? [],
    dogPending: round?.dogPending ?? null,
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
    const users = this.connections
      .users()
      .map((ws) => this.connections.attachment(ws));
    return Object.values(this.repository.data.rooms).map((r) => ({
      id: r.id,
      privateRoom: !!r.inviteCode,
      title: r.title,
      phase: r.state.phase,
      round: r.state.round,
      scores: r.state.scores,
      players: r.members.filter(Boolean).length,
      canJoin:
        r.state.phase === 'lobby' &&
        r.members.filter((m) => m && !m.bot).length < 6,
      online: this.connections.online(r).filter(Boolean).length,
      spectators: users.filter((a) => a.room === r.id && a.watch).length,
      mine: r.members.some((m) => m?.hash === hash),
    }));
  }
  state(
    r: Room,
    hash: string,
    watch: boolean,
    online = this.connections.online(r),
  ) {
    const seat = watch ? -1 : r.members.findIndex((m) => m?.hash === hash);
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
    const manual = r.state.phase === 'lobby' && r.teamMode === 'manual';
    const map = r.seatMap ?? Array(6).fill(null);
    const assigned = manual ? map.indexOf(seat) : seat;
    const leader = hostSeat(r, online);
    const waitingPlayers = manual
      ? r.members.flatMap((m, i) =>
          m && !map.includes(i)
            ? [{ name: r.state.names[i], own: i === seat }]
            : [],
        )
      : [];
    if (manual)
      snapshot.names = map.map((i) => (i == null ? '' : r.state.names[i]));
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
        privateRoom: !!r.inviteCode,
        ...(seat >= 0 && r.inviteCode ? { inviteCode: r.inviteCode } : {}),
        title: r.title,
        spectator: seat < 0,
        leader: manual ? map.indexOf(leader) : leader,
        isHost: seat >= 0 && seat === leader,
        teamMode: r.teamMode ?? 'random',
        assignedSeat: assigned,
        autoStartAt: r.autoStartAt ?? null,
        waitingPlayers,
        participantCount: r.members.filter(Boolean).length,
        offline: online.map((x, i) => !x && !r.members[i]?.bot),
        bots: manual
          ? map.map((i) => i != null && !!r.members[i]?.bot)
          : r.members.map((m) => !!(m?.bot || m?.idle)),
        paused: false,
      },
      online: manual ? map.map((i) => i != null && online[i]) : online,
    };
  }
  broadcast() {
    const users = this.connections.users();
    // Compute shared directory/presence once per broadcast, never cache private hands.
    const directory = this.directory('');
    const members = new Map(
      Object.values(this.repository.data.rooms).map((r) => [
        r.id,
        new Set(r.members.flatMap((m) => (m ? [m.hash] : []))),
      ]),
    );
    const online = new Map(
      Object.values(this.repository.data.rooms).map((r) => [
        r.id,
        this.connections.online(r),
      ]),
    );
    for (const ws of users) {
      const a = this.connections.authenticated(ws);
      const room = a.room ? this.repository.data.rooms[a.room] : undefined;
      this.connections.send(ws, {
        type: 'directory',
        rooms: directory.map((r) => ({
          ...r,
          mine: members.get(r.id)!.has(a.hash),
        })),
        count: users.length,
      });
      this.connections.send(
        ws,
        room
          ? this.state(room, a.hash, !!a.watch, online.get(room.id))
          : { type: 'hall' },
      );
    }
  }
}
