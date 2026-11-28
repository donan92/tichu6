import type {
  Card,
  ExchangeReview,
  Combination,
  GameAction,
  LobbyState,
  RoundState,
  RoundView,
} from './types';
export const BOT_POLICY_VERSION: string;
export const LABEL: Record<number, string>;
export function team(seat: number): number;
export function partners(seat: number): number[];
export function deck(): Card[];
export function shuffle<T>(items: T[]): T[];
export function sortCards(cards: Card[]): Card[];
export function points(cards: Card[]): number;
export function classify(
  cards: Card[],
  top?: Combination | null,
  phoenixRank?: number | null,
): Combination | null;
export function beats(
  play: Combination | null,
  top: Combination | null,
): boolean;
export function newGame(names?: string[]): LobbyState;
export function startRound(
  state: LobbyState | RoundState,
  cards?: Card[],
): RoundState;
export function act(
  state: RoundState,
  seat: number,
  action: GameAction,
): RoundState;
/** Personalized hand plus public card totals; capturedCounts never contains card identities. */
export function view(state: RoundState, seat: number): RoundView;
export function currentTrickStarter(
  state: LobbyState | RoundState,
): number | null;
export function botAction(state: RoundState, seat: number): GameAction;

export function exchangeReview(
  state: LobbyState | RoundState,
  seat: number,
): ExchangeReview[];

export function visibleHistory(
  state: LobbyState | RoundState,
): import('./types').TrickHistory[];

export function visibleLog(
  state: LobbyState | RoundState,
): (import('./types').Message | string)[];

export function legalPlays(
  hand: Card[],
  top?: Combination | null,
  wish?: number | null,
): { cards: Card[]; play: Combination }[];

export function recipientSeats(
  state: RoundState,
  seat: number,
  kind: 'dog' | 'dragon',
): number[];
