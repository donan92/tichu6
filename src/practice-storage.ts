import { deck, view } from './game.js';
import type { Card, RoundState } from './types';

export const PRACTICE_KEY = 'tichu6-practice-v1';
const MAX_BYTES = 256_000;
const cards = new Map(deck().map((card) => [card.id, card]));
const validCard = (card: Card) => {
  const original = card && cards.get(card.id);
  return (
    !!original &&
    original.rank === card.rank &&
    original.suit === card.suit &&
    original.special === card.special
  );
};
const validSeat = (seat: number | null) =>
  seat === null || (Number.isInteger(seat) && seat >= 0 && seat < 6);
interface PracticeSave {
  version: 1;
  nickname: string;
  state: RoundState;
}
// This is local practice data only, never a server identity or authoritative move.
export function savePractice(state: RoundState, nickname: string) {
  const value = JSON.stringify({ version: 1, nickname, state });
  if (value.length > MAX_BYTES) throw new Error('Practice save too large');
  localStorage.setItem(PRACTICE_KEY, value);
}
export function clearPractice() {
  localStorage.removeItem(PRACTICE_KEY);
}
export function loadPractice(): PracticeSave | null {
  const raw = localStorage.getItem(PRACTICE_KEY);
  if (!raw) return null;
  if (raw.length > MAX_BYTES) throw new Error('Invalid practice save');
  const saved = JSON.parse(raw) as PracticeSave;
  const state = saved?.state;
  if (
    saved?.version !== 1 ||
    typeof saved.nickname !== 'string' ||
    !/^[A-Za-z0-9]{0,8}$/.test(saved.nickname) ||
    !state ||
    !['grand', 'exchange', 'play', 'trick', 'roundEnd', 'matchEnd'].includes(
      state.phase,
    ) ||
    !Number.isInteger(state.round) ||
    state.round < 1 ||
    ![
      state.names,
      state.hands,
      state.first,
      state.captured,
      state.ready,
      state.calls,
      state.played,
      state.exchanges,
    ].every((a) => Array.isArray(a) && a.length === 6) ||
    ![state.scores, state.log, state.finish, state.passed, state.pile].every(
      Array.isArray,
    ) ||
    !state.names.every((n) => typeof n === 'string') ||
    !state.hands.every((a) => Array.isArray(a) && a.length <= 18) ||
    !state.first.every(Array.isArray) ||
    !state.captured.every(Array.isArray) ||
    !state.hands.flat().every(validCard) ||
    !state.captured.flat().every(validCard) ||
    !state.pile.every(validCard) ||
    !state.first
      .flat()
      .every((id) => typeof id === 'string' && cards.has(id)) ||
    !state.exchanges.every(
      (a) =>
        a === null ||
        (Array.isArray(a) && a.length === 2 && a.every((id) => cards.has(id))),
    ) ||
    !state.ready.every((v) => typeof v === 'boolean') ||
    !state.played.every((v) => typeof v === 'boolean') ||
    !state.calls.every((v) => [0, 100, 200].includes(v)) ||
    state.scores.length !== 2 ||
    !state.scores.every(Number.isFinite) ||
    !validSeat(state.turn) ||
    !validSeat(state.last) ||
    !state.finish.every((v) => v !== null && validSeat(v)) ||
    !state.passed.every((v) => v !== null && validSeat(v)) ||
    (state.top !== null &&
      (!state.top ||
        !Array.isArray(state.top.cards) ||
        !state.top.cards.every(validCard)))
  )
    throw new Error('Invalid practice save');
  // Exercise the same projection used by the UI before activating bot timers.
  view(state, 0);
  return saved;
}
