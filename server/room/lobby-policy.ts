import type { Room } from '../types';
export function hostSeat(room: Room, online: boolean[]) {
  const old = room.members.findIndex((m) => m?.hash === room.hostHash);
  return old >= 0 && online[old] ? old : online.findIndex(Boolean);
}
export function syncLobby(room: Room, online: boolean[], now = Date.now()) {
  if (room.state.phase !== 'lobby') return;
  const host = hostSeat(room, online);
  if (host >= 0) room.hostHash = room.members[host]?.hash;
  room.seatMap ??= Array(6).fill(null);
  room.seatMap = room.seatMap.map((i) =>
    i != null && room.members[i] ? i : null,
  );
  const ready =
    room.members.every((m, i) => !!m && !m.bot && online[i]) &&
    (room.teamMode !== 'manual' || room.seatMap.every((i) => i != null));
  if (!ready) room.autoStartAt = null;
  else room.autoStartAt ??= now + 10000;
}
