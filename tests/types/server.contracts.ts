import type { RoomRepository } from '../../server/persistence/room.repository.ts';
import type { SessionService } from '../../server/session/session.service.ts';
import type { RoomService } from '../../server/room/room.service.ts';
import type { GameAction } from '../../src/types';

declare const repository: RoomRepository;
declare const sessions: SessionService;
declare const rooms: RoomService;
declare const socket: WebSocket;
// These must stay rejected by the server typecheck, without any runtime execution.
// @ts-expect-error persisted activity must use numeric timestamps
repository.data.activity['identity'] = 'yesterday';
// @ts-expect-error identity is mandatory at the authenticated session boundary
sessions.admit(socket, {}, { name: 'Player' }, Date.now());
// @ts-expect-error room watching must be a validated boolean
rooms.enter(socket, 'room', 'true', 'Player');
// @ts-expect-error commands require a boolean call, not a string
const invalid: GameAction = { type: 'grand', call: 'true' };
void invalid;
