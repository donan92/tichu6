import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import I18NextVue from 'i18next-vue';
import App from '../../src/App.vue';
import { i18next } from '../../src/localization';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { useSessionStore } from '../../src/stores/session';
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
it('idle logout stops automatic reconnect while retaining credentials for manual return', async () => {
  const { room, callbacks } = client();
  const opened = room.open('Alice');
  const socket = Socket.instances[0];
  socket.open();
  socket.receive({ type: 'welcome' });
  await opened;
  const token = savedRoom()?.token;
  socket.close(4009);
  expect(callbacks.onError).toHaveBeenCalledWith({
    code: 'error.idleLogout',
    params: {},
  });
  expect(savedRoom()?.idle).toBe(true);
  await vi.advanceTimersByTimeAsync(60000);
  expect(Socket.instances).toHaveLength(1);
  const next = client();
  const pending = next.room.open('Alice');
  const resumed = Socket.instances[1];
  resumed.open();
  expect(JSON.parse(resumed.sent[0])).toMatchObject({ token, manual: true });
  resumed.receive({ type: 'welcome' });
  await pending;
  expect(savedRoom()?.idle).not.toBe(true);
});
it('automatic startup and transport retries do not claim manual activity', async () => {
  const { room } = client();
  const opened = room.open('Alice', false);
  const first = Socket.instances[0];
  first.open();
  expect(JSON.parse(first.sent[0]).manual).toBe(false);
  first.receive({ type: 'welcome' });
  await opened;
  first.close(1006);
  await vi.advanceTimersByTimeAsync(2000);
  const second = Socket.instances[1];
  second.open();
  expect(JSON.parse(second.sent[0]).manual).toBe(false);
});

it('idle logout returns the session to home and clears private game display', async () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  try {
    const session = useSessionStore();
    session.nickname = 'Alice';
    const opened = session.enterHall();
    const socket = Socket.instances[0];
    socket.open();
    socket.receive({ type: 'welcome' });
    await opened;
    socket.receive({
      type: 'state',
      value: { ...view(startRound(newGame()), 0), roomId: 'room' },
      online: Array(6).fill(true),
    });
    session.selected = [session.game?.hand[0].id ?? 'card'];
    expect(session.mode).toBe('room');
    socket.close(4009);
    expect(session.mode).toBe('home');
    expect(session.game).toBeNull();
    expect(session.selected).toEqual([]);
    expect(session.connected).toBe(false);
    expect(session.connectionError?.code).toBe('error.idleLogout');
  } finally {
    disposePinia(pinia);
  }
});

it('synchronizes consent changes made during handshake and removes the listener on close', async () => {
  const { writeTrainingConsent } = await import('../../src/training-consent');
  writeTrainingConsent(true);
  const { room } = client();
  const opening = room.open('Alice');
  const socket = Socket.instances[0];
  socket.open();
  expect(JSON.parse(socket.sent[0]).trainingConsent).toBe(true);
  writeTrainingConsent(false);
  expect(socket.sent).toHaveLength(1);
  socket.receive({ type: 'welcome' });
  await opening;
  expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
    type: 'trainingConsent',
    enabled: false,
  });
  writeTrainingConsent(true);
  expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
    type: 'trainingConsent',
    enabled: true,
  });
  room.close();
  const count = socket.sent.length;
  writeTrainingConsent(false);
  expect(socket.sent).toHaveLength(count);
});

it('sends the new-visitor recording default and preserves explicit opt-outs on reconnect', async () => {
  const { TRAINING_CONSENT_KEY } = await import('../../src/training-consent');
  for (const enabled of [true, false]) {
    if (!enabled) localStorage.setItem(TRAINING_CONSENT_KEY, 'false');
    const { room } = client();
    const opening = room.open('Alice');
    const socket = Socket.instances.at(-1)!;
    socket.open();
    expect(JSON.parse(socket.sent[0]).trainingConsent).toBe(enabled);
    socket.receive({ type: 'welcome' });
    await opening;
    room.close();
  }
});

it('shows restoration immediately and waits for authoritative state after welcome', async () => {
  localStorage.setItem(
    'tichu6-session-v4',
    JSON.stringify({
      token: 'a'.repeat(64),
      name: 'Alice',
      roomId: 'saved-room',
      watch: false,
    }),
  );
  const pinia = createPinia();
  setActivePinia(pinia);
  const session = useSessionStore();
  expect(session.restoring).toBe(true);
  const wrapper = mount(App, {
    global: {
      plugins: [pinia, [I18NextVue, { i18next }]],
      stubs: {
        AppHeader: true,
        HomeView: true,
        HallView: true,
        GameView: true,
        RoomView: true,
        TrainingConsent: true,
      },
    },
  });
  try {
    expect(wrapper.find('.connection-loading').exists()).toBe(true);
    expect(wrapper.find('home-view-stub').exists()).toBe(false);
    const socket = Socket.instances[0];
    socket.open();
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      roomId: 'saved-room',
      manual: false,
    });
    socket.receive({ type: 'welcome' });
    socket.receive({ type: 'directory', rooms: [], count: 1 });
    await nextTick();
    expect(session.restoring).toBe(true);
    expect(wrapper.find('.connection-loading').exists()).toBe(true);
    socket.receive({
      type: 'state',
      value: { ...view(startRound(newGame()), 0), roomId: 'saved-room' },
      online: Array(6).fill(true),
    });
    await nextTick();
    expect(session.restoring).toBe(false);
    expect(wrapper.find('game-view-stub').exists()).toBe(true);
    socket.close(1006);
    await nextTick();
    expect(wrapper.find('.connection-loading').exists()).toBe(true);
    expect(session.game?.roomId).toBe('saved-room');
  } finally {
    wrapper.unmount();
    disposePinia(pinia);
  }
});

it('finishes restoration only on hall confirmation, and allows retry after missing state', async () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  const session = useSessionStore();
  session.nickname = 'Alice';
  try {
    const opening = session.enterHall();
    const first = Socket.instances[0];
    first.open();
    first.receive({ type: 'welcome' });
    await opening;
    await vi.advanceTimersByTimeAsync(15000);
    expect(session.restoring).toBe(true);
    expect(session.connectionError?.code).toBe('error.connectFailed');
    expect(session.connected).toBe(false);
    const retry = session.enterHall();
    const second = Socket.instances[1];
    second.open();
    second.receive({ type: 'welcome' });
    await retry;
    expect(session.connectionError).toBeNull();
    expect(session.restoring).toBe(true);
    second.receive({ type: 'hall' });
    expect(session.restoring).toBe(false);
    expect(session.mode).toBe('hall');
    await vi.advanceTimersByTimeAsync(16000);
    expect(session.connectionError).toBeNull();
  } finally {
    disposePinia(pinia);
  }
});

it('cancels a failed restore without forfeiting or deleting reconnection credentials', async () => {
  localStorage.setItem(
    'tichu6-session-v4',
    JSON.stringify({
      token: 'b'.repeat(64),
      name: 'Alice',
      roomId: 'saved-room',
      watch: true,
    }),
  );
  const pinia = createPinia();
  setActivePinia(pinia);
  const session = useSessionStore();
  try {
    const opening = session.enterHall(false);
    const socket = Socket.instances[0];
    socket.open();
    socket.receive({ type: 'error', code: 'error.connectFailed', params: {} });
    await opening;
    expect(session.restoring).toBe(true);
    expect(session.connectionError?.code).toBe('error.connectFailed');
    session.cancelRestore();
    expect(session.restoring).toBe(false);
    expect(session.mode).toBe('home');
    expect(savedRoom()).toMatchObject({
      roomId: 'saved-room',
      token: 'b'.repeat(64),
      watch: true,
    });
    expect(socket.sent.map((value) => JSON.parse(value).type)).not.toContain(
      'forfeit',
    );
    await vi.advanceTimersByTimeAsync(60000);
    expect(Socket.instances).toHaveLength(1);
  } finally {
    disposePinia(pinia);
  }
});
