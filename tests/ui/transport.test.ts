import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Room, savedRoom } from '../../src/server-room';
import { newGame, startRound, view } from '../../src/game.js';
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  onerror?: () => void;
  constructor(public url: string) {
    Socket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
  close(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}
const rooms: Room[] = [];
function client() {
  const callbacks = {
    onMessage: vi.fn(),
    onStatus: vi.fn(),
    onError: vi.fn(),
    onNotice: vi.fn(),
  };
  const room = new Room(callbacks);
  rooms.push(room);
  return { room, callbacks };
}
beforeEach(() => {
  localStorage.clear();
  Socket.instances = [];
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', Socket);
});
afterEach(() => {
  rooms.splice(0).forEach((room) => room.close());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('keeps credentials out of URLs and resumes the same token and room', async () => {
  const { room } = client();
  const opened = room.open('Alice');
  const first = Socket.instances[0];
  first.open();
  const hello = JSON.parse(first.sent[0]);
  expect(hello.token).toMatch(/^[a-f0-9]{64}$/);
  expect(first.url).not.toContain(hello.token);
  first.receive({ type: 'welcome' });
  await opened;
  first.receive({
    type: 'state',
    value: {
      ...view(startRound(newGame()), 2),
      roomId: 'room',
      spectator: false,
    },
    online: Array(6).fill(true),
  });
  first.close(1006);
  await vi.advanceTimersByTimeAsync(2000);
  const second = Socket.instances[1];
  second.open();
  const resumed = JSON.parse(second.sent[0]);
  expect(resumed.token).toBe(hello.token);
  expect(resumed.roomId).toBe('room');
  expect(savedRoom()?.roomId).toBe('room');
  second.receive({ type: 'welcome' });
  expect(room.connected()).toBe(true);
});
it('settles admission when the server closes with a terminal code before welcome', async () => {
  const { room, callbacks } = client();
  const result = room.open('Alice').catch((error) => error);
  Socket.instances[0].close(4001);
  expect((await result).code).toBe('error.otherTab');
  expect(callbacks.onError).toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60000);
  expect(Socket.instances).toHaveLength(1);
});
it('rejects admission errors without retrying or exposing token in callbacks', async () => {
  const { room, callbacks } = client();
  const result = room.open('Alice').catch((error) => error);
  Socket.instances[0].open();
  Socket.instances[0].receive({ type: 'error', code: 'error.loungeFull' });
  expect((await result).code).toBe('error.loungeFull');
  expect(callbacks.onError).toHaveBeenCalledWith({
    type: 'error',
    code: 'error.loungeFull',
  });
  await vi.advanceTimersByTimeAsync(20000);
  expect(Socket.instances).toHaveLength(1);
});
it('ignores stale socket state after reconnect and stops heartbeat on close', async () => {
  const { room, callbacks } = client();
  const result = room.open('Alice');
  const first = Socket.instances[0];
  first.open();
  first.receive({ type: 'welcome' });
  await result;
  first.close(1006);
  await vi.advanceTimersByTimeAsync(2000);
  const second = Socket.instances[1];
  second.open();
  second.receive({ type: 'welcome' });
  first.receive({ type: 'hall' });
  expect(callbacks.onMessage).not.toHaveBeenCalled();
  room.close();
  const sent = second.sent.length;
  await vi.advanceTimersByTimeAsync(60000);
  expect(second.sent).toHaveLength(sent);
  expect(Socket.instances).toHaveLength(2);
});
it('does not send requests while disconnected', () => {
  const { room } = client();
  expect(() => room.request({ type: 'leave' })).toThrow();
});
it('rejects malformed persisted credentials and normalizes optional fields', () => {
  localStorage.setItem('tichu6-session-v4', JSON.stringify({ token: 'bad' }));
  expect(savedRoom()).toBeNull();
  localStorage.setItem(
    'tichu6-session-v4',
    JSON.stringify({
      token: 'a'.repeat(64),
      name: 5,
      roomId: {},
      watch: 'true',
    }),
  );
  expect(savedRoom()).toEqual({
    token: 'a'.repeat(64),
    name: '',
    roomId: null,
    watch: false,
  });
});
