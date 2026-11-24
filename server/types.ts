import type { LobbyState, RoundState, RoomTitle } from '../src/types';

export type GameState = LobbyState | RoundState;
export interface Member {
  hash?: string;
  bot?: boolean;
  idle?: boolean;
  offlineSince?: number | null;
}
export interface Room {
  id: string;
  title: RoomTitle;
  state: GameState;
  members: (Member | null)[];
  lastActive: number;
  lastProgress: number;
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
  idle?: boolean;
}
export type AuthenticatedAttachment = Attachment & { hash: string };
export type JsonObject = Record<string, unknown>;
