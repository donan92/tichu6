import { act, botAction, recipientSeats } from './game.js';
import type { GameAction, LobbyState, RoundState } from './types';
export const TURN_MS = 30_000;
export const TRICK_MS = 5_000;
// Stable across reconnects, unrelated declarations and Durable Object hibernation.
export function syncDeadline(state: LobbyState | RoundState, now = Date.now()) {
  if (state.phase === 'lobby') return;
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
    state.deadlineDuration =
      state.phase === 'trick'
        ? state.top?.cards[0]?.special === 'dragon'
          ? TURN_MS
          : TRICK_MS
        : TURN_MS;
    state.deadline = now + state.deadlineDuration;
    state.extensionUsed = false;
  }
}
export function dueAction(
  state: RoundState,
  now = Date.now(),
): { seat: number; action: GameAction } | null {
  if (state.deadline == null || now < state.deadline) return null;
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
