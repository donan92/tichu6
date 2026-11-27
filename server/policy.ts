// Shared server policy. Timers are persisted/scheduled by Durable Objects.
export const GRACE = 45_000;
export const TTL = 86_400_000;
export const IDLE = 30 * 60 * 1000;
export const ROOM_EMPTY = 10 * 60 * 1000;
export const ROOM_IDLE = 30 * 60 * 1000;
export const MAX_IDENTITIES = 100;
export const MAX_ROOMS = 20;
export const MAX_SOCKETS = 120;
export const ORIGINS = new Set([
  'https://tichu6.pages.dev',
  'https://donan92.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
