import { syncReconnectClock } from './reconnect-clock.ts';
import { syncDeadline, dueAction } from '../../src/game-clock.ts';
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
        r.trainingMatch = crypto.randomUUID();
      }
      r.state = next;
      r.trainingSession = crypto.randomUUID();
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
      if (r.state.phase === 'lobby') continue;
      syncReconnectClock(r, this.connections.online(r), now);
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
                : -1;
        if (
          seat != null &&
          seat >= 0 &&
          eligible(seat) &&
          (s.phase !== 'play' || r.members[seat]?.bot || r.members[seat]?.idle)
        ) {
          const action = botAction(s, seat);
          r.state = act(s, seat, action);
          this.record(r, s, seat, action, 'bot');
          syncReconnectClock(r, this.connections.online(r), now);
          r.lastProgress = now;
        }
      }
    }
  }
}
