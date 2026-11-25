import type { LobbyState, RoundState, RoomTitle } from '../src/types';

export type GameState = LobbyState | RoundState;
export interface Member {
  hash?: string;
  bot?: boolean;
  idle?: boolean;
  offlineSince?: number | null;
  trainingConsent?: boolean;
}
export interface Room {
  teamMode?: 'random' | 'manual';
  seatMap?: (number | null)[];
  hostHash?: string;
  autoStartAt?: number | null;
  reconnectTurn?: { key: string; until: number; resumed: boolean };
  id: string;
  title: RoomTitle;
  state: GameState;
  members: (Member | null)[];
  lastActive: number;
  lastProgress: number;
  trainingSession?: string;
  trainingMatch?: string;
}
export interface LoungeData {
  rooms: Record<string, Room>;
  activity: Record<string, number>;
}
export interface Attachment {
  created?: number;
  window?: number;
  requests?: number;
  hash?: string;
  name?: string;
  room?: string | null;
  watch?: boolean;
  trainingConsent?: boolean;
  idle?: boolean;
}
export type AuthenticatedAttachment = Attachment & { hash: string };
export type JsonObject = Record<string, unknown>;
