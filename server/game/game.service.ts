import { hostSeat, syncLobby } from '../room/lobby-policy.ts';
import { syncReconnectClock } from './reconnect-clock.ts';
import { syncDeadline, dueAction, botDelay } from '../../src/game-clock.ts';
import {
  prepareTrainingDecision,
  appendTrainingDecision,
  finalizeTrainingSession,
} from '../training/records.ts';
import type { RoundState, GameAction } from '../../src/types.ts';
import type { Room } from '../types.ts';
import { AppError } from '../../src/messages.js';
import {
  startRound,
  act,
  botAction,
  shuffle,
  BOT_POLICY_VERSION,
} from '../../src/game.js';
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
    if (
      action.type === 'teamMode' ||
      action.type === 'chooseSeat' ||
      action.type === 'setBot'
    ) {
      if (r.state.phase !== 'lobby') throw new AppError('error.invalidAction');
      if (action.type === 'setBot') {
        if (seat !== hostSeat(r, this.connections.online(r)))
          throw new AppError('error.coordinator');
        if (r.teamMode !== 'manual') throw new AppError('error.invalidAction');
        const map = r.seatMap ?? Array(6).fill(null);
        const member = map[action.target];
        if (action.enabled) {
          if (member != null) throw new AppError('error.seatOccupied');
          const free = r.members.indexOf(null);
          if (free < 0) throw new AppError('error.seatsFull');
          r.members[free] = { bot: true };
          r.state.names[free] = `Bot${action.target + 1}`;
          map[action.target] = free;
        } else {
          if (member == null || !r.members[member]?.bot)
            throw new AppError('error.invalidChoice');
          r.members[member] = null;
          r.state.names[member] = '';
          map[action.target] = null;
        }
        r.seatMap = map;
        r.autoStartAt = null;
      } else if (action.type === 'teamMode') {
        if (seat !== hostSeat(r, this.connections.online(r)))
          throw new AppError('error.coordinator');
        if (r.teamMode !== action.mode) {
          r.members = r.members.map((m, i) => {
            if (!m?.bot) return m;
            r.state.names[i] = '';
            return null;
          });
          r.teamMode = action.mode;
          r.seatMap = Array(6).fill(null);
          r.autoStartAt = null;
        }
      } else {
        if (r.teamMode !== 'manual') throw new AppError('error.invalidAction');
        const map = r.seatMap ?? Array(6).fill(null);
        if (
          action.target >= 0 &&
          map[action.target] != null &&
          map[action.target] !== seat
        )
          throw new AppError('error.seatOccupied');
        r.seatMap = map.map((i) => (i === seat ? null : i));
        if (action.target >= 0) r.seatMap[action.target] = seat;
        r.autoStartAt = null;
      }
      r.state.revision++;
      syncLobby(r, this.connections.online(r));
    } else if (action.type === 'start' || action.type === 'next') {
      if (seat !== hostSeat(r, this.connections.online(r)))
        throw new AppError('error.coordinator');
      if (r.state.phase === 'lobby' && r.teamMode === 'manual')
        throw new AppError('error.fillSeats');
      this.start(r);
    } else {
      if (r.state.phase === 'lobby') throw new AppError('error.invalidAction');
      const before = r.state;
      r.state = act(before, seat, action);
      this.record(r, before, seat, action, 'human');
    }
    syncDeadline(r.state);
    r.lastActive = Date.now();
    r.lastProgress = Date.now();
  }
  private start(r: Room) {
    // Deal/validate before changing membership; rejected starts stay atomic.
    const next = startRound(structuredClone(r.state));
    if (r.state.phase === 'lobby') {
      if (r.teamMode === 'manual') {
        if (!r.seatMap?.every((i) => i != null && r.members[i]))
          throw new AppError('error.fillSeats');
        const mapped = r.seatMap.map((i) => ({
          member: r.members[i!]!,
          name: r.state.names[i!],
        }));
        const a = shuffle([mapped[0], mapped[2], mapped[4]]),
          b = shuffle([mapped[1], mapped[3], mapped[5]]);
        const filled = Array.from({ length: 6 }, (_, i) =>
          i % 2 ? b.pop()! : a.pop()!,
        );
        r.members = filled.map((entry) => entry.member);
        next.names = filled.map((entry) => entry.name);
      } else {
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
      r.trainingMatch = crypto.randomUUID();
      r.autoStartAt = null;
      r.seatMap = undefined;
    }
    r.state = next;
    r.trainingSession = crypto.randomUUID();
    syncDeadline(r.state);
    r.lastProgress = Date.now();
  }
  private record(
    r: Room,
    before: RoundState,
    seat: number,
    action: GameAction,
    source: 'human' | 'bot',
    policyVersion = BOT_POLICY_VERSION,
  ) {
    // Record opted-in players, including their offline bot takeover, only.
    if (r.members[seat]?.trainingConsent === true) {
      // Older in-progress rooms predate match grouping; begin grouping only
      // when an opted-in record is actually about to be accepted.
      r.trainingMatch ??= crypto.randomUUID();
      const decision = prepareTrainingDecision(
        before,
        seat,
        action,
        source,
        source === 'bot' ? policyVersion : 'human',
      );
      if (decision) {
        r.trainingSession ??= crypto.randomUUID();
        appendTrainingDecision(
          this.repository.training,
          r.trainingSession,
          decision,
          Date.now(),
          r.trainingMatch,
        );
      }
    }
    if (r.trainingSession && ['roundEnd', 'matchEnd'].includes(r.state.phase)) {
      const state = r.state as RoundState;
      finalizeTrainingSession(this.repository.training, r.trainingSession, {
        scores: state.scores,
        delta: state.delta,
        finish: state.finish,
        winner:
          !state.delta || state.delta[0] === state.delta[1]
            ? null
            : state.delta[0] > state.delta[1]
              ? 0
              : 1,
      });
    }
  }
  advanceTimed(now: number) {
    let changed = false;
    for (const r of Object.values(this.repository.data.rooms)) {
      if (r.state.phase === 'lobby') {
        syncLobby(r, this.connections.online(r), now);
        if (r.autoStartAt != null && now >= r.autoStartAt) {
          this.start(r);
          changed = true;
        }
        continue;
      }
      syncReconnectClock(r, this.connections.online(r), now);
      // Resolve every unfinished preparation decision in this alarm, sharing
      // one deadline across the first ten cards and the exchange phase.
      for (
        let step = 0;
        step < 12 &&
        (r.state.phase === 'grand' || r.state.phase === 'exchange');
        step++
      ) {
        const pending = dueAction(r.state, now);
        if (!pending) break;
        const before = r.state;
        r.state = act(before, pending.seat, pending.action);
        this.record(
          r,
          before,
          pending.seat,
          pending.action,
          'bot',
          'preparation-timeout-v1',
        );
        syncReconnectClock(r, this.connections.online(r), now);
        r.lastProgress = now;
        changed = true;
      }
      const due = dueAction(r.state, now);
      if (!due) continue;
      const before = r.state;
      r.state = act(before, due.seat, due.action);
      // Automatic moves are never labelled as human training decisions.
      this.record(
        r,
        before,
        due.seat,
        due.action,
        'bot',
        before.phase === 'trick' ? 'auto-collect-v1' : 'turn-timeout-v1',
      );
      syncReconnectClock(r, this.connections.online(r), now);
      r.lastProgress = now;
      changed = true;
    }
    return changed;
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
          if (m?.bot || !eligible(i)) return m;
          s.names[i] = '';
          r.seatMap = r.seatMap?.map((slot) => (slot === i ? null : slot));
          r.autoStartAt = null;
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
        if (
          seat != null &&
          seat >= 0 &&
          eligible(seat) &&
          (s.phase !== 'play' || r.members[seat]?.bot || r.members[seat]?.idle)
        ) {
          const action = botAction(s, seat);
          if (botDelay(s, action, now, 0) > 0) continue;
          r.state = act(s, seat, action);
          this.record(r, s, seat, action, 'bot');
          syncReconnectClock(r, this.connections.online(r), now);
          r.lastProgress = now;
        }
      }
    }
  }
}
