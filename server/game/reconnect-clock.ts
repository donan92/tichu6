import { syncDeadline, TURN_MS } from '../../src/game-clock.ts';
import type { Room } from '../types.ts';
export const RECONNECT_MS = 180_000;
// One grace allowance per turn: reconnect flapping cannot restart the clock.
export function syncReconnectClock(
  room: Room,
  online: boolean[],
  now = Date.now(),
) {
  const s = room.state;
  syncDeadline(s, now);
  if (s.phase !== 'play' || s.turn == null) {
    delete room.reconnectTurn;
    return;
  }
  if (room.reconnectTurn?.key !== s.deadlineKey) delete room.reconnectTurn;
  const member = room.members[s.turn];
  if (!member || member.bot || member.idle) {
    if (room.reconnectTurn && !room.reconnectTurn.resumed)
      s.deadline = now + TURN_MS;
    delete room.reconnectTurn;
    return;
  }
  let wait = room.reconnectTurn;
  if (
    !online[s.turn] &&
    !wait &&
    member.offlineSince != null &&
    now < member.offlineSince + RECONNECT_MS
  ) {
    wait = room.reconnectTurn = {
      key: s.deadlineKey!,
      until: member.offlineSince + RECONNECT_MS,
      resumed: false,
    };
    s.deadline = wait.until + TURN_MS;
  }
  if (wait && !wait.resumed && online[s.turn]) {
    s.deadline = Math.min(wait.until + TURN_MS, now + TURN_MS);
    wait.resumed = true;
  }
}
