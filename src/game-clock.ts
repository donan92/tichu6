import { act, botAction, recipientSeats } from './game.js';
import type { GameAction, LobbyState, RoundState } from './types';
export const PREPARATION_MS = 180_000;
export const TURN_MS = 30_000;
export const TRICK_MS = 5_000;
// Stable across reconnects, unrelated declarations and Durable Object hibernation.
export function syncDeadline(state: LobbyState | RoundState, now = Date.now()) {
  if (state.phase === 'lobby') return;
  if (state.phase === 'grand' || state.phase === 'exchange') {
    const key = `${state.round}:preparation`;
    if (state.deadlineKey !== key || !Number.isFinite(state.deadline)) {
      state.deadlineKey = key;
      state.deadline = now + PREPARATION_MS;
      state.deadlineDuration = PREPARATION_MS;
    }
    return;
  }
  if (state.phase !== 'play' && state.phase !== 'trick') {
    state.deadline = null;
    state.deadlineKey = null;
    return;
  }
  const key = [
    state.round,
    state.phase,
    state.turn,
    state.last,
    state.dogPending,
    state.top?.cards.map((c) => c.id).join(','),
    state.passed.join(','),
  ].join(':');
  if (state.deadlineKey !== key || !Number.isFinite(state.deadline)) {
    state.deadlineKey = key;
    state.deadlineStartedAt = now;
    state.deadlineDuration =
      state.phase === 'trick'
        ? state.top?.cards[0]?.special === 'dragon'
          ? TURN_MS
          : TRICK_MS
        : TURN_MS;
    state.deadline = now + state.deadlineDuration;
    if (state.dogPending != null) {
      state.dogSelectionExpiresAt ??= state.deadline;
      state.deadline = state.dogSelectionExpiresAt;
    } else {
      delete state.dogSelectionExpiresAt;
      delete state.dogPreviousClock;
    }
    state.extensionUsed = false;
  }
}
export function dueAction(
  state: RoundState,
  now = Date.now(),
): { seat: number; action: GameAction } | null {
  if (state.deadline == null || now < state.deadline) return null;
  if (state.phase === 'grand' || state.phase === 'exchange') {
    const seat =
      state.phase === 'grand'
        ? state.ready.findIndex((ready) => !ready)
        : state.exchanges.findIndex((cards) => !cards);
    if (seat < 0) return null;
    return {
      seat,
      action:
        state.phase === 'grand'
          ? { type: 'grand', call: false }
          : botAction(state, seat),
    };
  }
  if (state.phase === 'trick' && state.last != null)
    return {
      seat: state.last,
      action: {
        type: 'collect',
        target: recipientSeats(state, state.last, 'dragon').includes(
          state.dragonTarget ?? -1,
        )
          ? state.dragonTarget
          : recipientSeats(state, state.last, 'dragon')[0],
      },
    };
  if (state.phase !== 'play' || state.turn == null) return null;
  const seat = state.turn;
  try {
    act(state, seat, { type: 'pass' });
    return { seat, action: { type: 'pass' } };
  } catch {
    // A lead or an enforceable wish cannot be passed under the game rules.
    return { seat, action: botAction(state, seat) };
  }
}

// Bot thinking time is independent of human deadline extensions.
export function botDelay(
  state: RoundState,
  action: GameAction,
  now: number,
  ordinary = 2000,
) {
  if (action.type !== 'pass' && state.phase !== 'trick') return ordinary;
  const started =
    state.deadlineStartedAt ??
    (state.deadline ?? now) - (state.deadlineDuration ?? TURN_MS);
  return Math.max(
    0,
    started + (action.type === 'pass' ? 5000 : TRICK_MS) - now,
  );
}
