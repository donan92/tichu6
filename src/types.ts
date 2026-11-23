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
export interface PublicBase {
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
}
export type GameAction =
  | { type: 'start' | 'next' | 'tichu' | 'pass' }
  | { type: 'grand'; call: boolean }
  | { type: 'exchange'; ids: string[] }
  | { type: 'collect'; target: number }
  | {
      type: 'play';
      ids: string[];
      wish: number | null;
      target: number;
      phoenixRank: number | null;
    };
export interface RoomSummary {
  id: string;
  title: RoomTitle;
  phase: Phase;
  round: number;
  scores: number[];
  players: number;
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
