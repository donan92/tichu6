export type Phase =
  'lobby' | 'grand' | 'exchange' | 'play' | 'trick' | 'roundEnd' | 'matchEnd';
export interface Message {
  code: string;
  params?: Record<string, unknown>;
}
export type RoomTitle =
  string | { adjective: string; noun: string; number: string };
export interface Card {
  id: string;
  rank: number;
  suit: number;
  special?: 'mahjong' | 'dog' | 'phoenix' | 'dragon';
}
export interface Combination {
  kind: string;
  power: number;
  size: number;
  bomb: number;
  phoenixRank?: number;
}
export interface ExchangeReview {
  partner: number;
  sent?: Card;
  received?: Card;
}
export interface TrickHistory {
  round: number;
  trick: number;
  entries: (Message | string)[];
}
export interface CallResult {
  seat: number;
  call: number;
  success: boolean;
  delta: number;
}
export interface PublicBase {
  scoreHistory?: { round: number; delta: number[]; scores: number[] }[];
  dogTransfer?: { round: number; trick: number; recipient: number };
  dragonTransfer?: { round: number; trick: number; recipient: number };
  trickHistory?: TrickHistory[];
  trickNumber?: number;
  callResults?: CallResult[];
  deadline?: number | null;
  deadlineDuration?: number | null;
  extensionUsed?: boolean;
  callConfirmUsed?: boolean[];
  dogPending?: number | null;
  reconnectUntil?: number | null;
  dragonTarget?: number | null;
  exchangeReview?: ExchangeReview[];
  phase: Phase;
  names: string[];
  round: number;
  scores: number[];
  revision: number;
  log: (Message | string)[];
  seat: number;
  hand: Card[];
  roomId?: string;
  title?: RoomTitle;
  spectator?: boolean;
  leader?: number;
  isHost?: boolean;
  teamMode?: 'random' | 'manual';
  seatMap?: (number | null)[];
  waitingPlayers?: { name: string; own: boolean }[];
  assignedSeat?: number;
  autoStartAt?: number | null;
  participantCount?: number;
  paused?: boolean;
  offline?: boolean[];
  bots?: boolean[];
}
export interface LobbyView extends PublicBase {
  phase: 'lobby';
}
export interface RoundView extends PublicBase {
  phase: Exclude<Phase, 'lobby'>;
  ready: boolean[];
  calls: number[];
  played: boolean[];
  finish: number[];
  top: (Combination & { cards: Card[] }) | null;
  turn: number | null;
  last: number | null;
  passed: number[];
  wish: number | null;
  delta: number[] | null;
  counts: number[];
  exchangeReady: boolean[];
  capturedPoints: number[];
}
export type GameView = LobbyView | RoundView;
export interface LobbyState {
  scoreHistory?: PublicBase['scoreHistory'];
  phase: 'lobby';
  names: string[];
  round: number;
  scores: number[];
  revision: number;
  log: (Message | string)[];
  hands: Card[][];
}
export interface RoundState extends Omit<
  RoundView,
  'seat' | 'hand' | 'counts' | 'exchangeReady' | 'capturedPoints'
> {
  hands: Card[][];
  first: string[][];
  exchanges: (string[] | null)[];
  captured: Card[][];
  pile: Card[];
  exchangeReviewClosed?: boolean;
  deadlineKey?: string | null;
  deadlineStartedAt?: number;
  dogSelectionExpiresAt?: number;
  dogPreviousClock?: Pick<
    RoundState,
    | 'deadline'
    | 'deadlineKey'
    | 'deadlineDuration'
    | 'deadlineStartedAt'
    | 'extensionUsed'
  >;
}
export type GameAction =
  | { type: 'prepareCall'; call: 100 | 200 }
  | { type: 'teamMode'; mode: 'random' | 'manual' }
  | { type: 'chooseSeat'; target: number }
  | { type: 'setBot'; target: number; enabled: boolean }
  | {
      type:
        | 'start'
        | 'next'
        | 'tichu'
        | 'pass'
        | 'prepareDog'
        | 'cancelDog'
        | 'extendTime';
    }
  | { type: 'grand'; call: boolean }
  | { type: 'exchange'; ids: string[] }
  | { type: 'dragonTarget'; target: number }
  | { type: 'collect'; target?: number | null }
  | {
      type: 'play';
      ids: string[];
      wish?: number | null;
      target?: number | null;
      phoenixRank?: number | null;
    };
export interface RoomSummary {
  id: string;
  title: RoomTitle;
  phase: Phase;
  round: number;
  scores: number[];
  players: number;
  canJoin?: boolean;
  online: number;
  spectators: number;
  mine: boolean;
}
export type ServerMessage =
  | { type: 'welcome' }
  | { type: 'directory'; rooms: RoomSummary[]; count: number }
  | { type: 'hall' }
  | { type: 'state'; value: GameView; online: boolean[] }
  | ({ type: 'error' } & Message);
export type ClientRequest =
  | { type: 'create'; name: string }
  | { type: 'join'; roomId: string; watch: boolean; name: string }
  | { type: 'leave' | 'forfeit' }
  | { type: 'action'; revision: number; action: GameAction };
