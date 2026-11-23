import { AppError, event as messageEvent } from './messages.js';
import type { ClientRequest, Message, ServerMessage } from './types';
export const API = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://localhost:8787'
  : 'https://tichu6-server.kelp-swaths-7q.workers.dev';
const KEY = 'tichu6-session-v4';
interface SavedSession {
  token: string;
  name: string;
  roomId: string | null;
  watch: boolean;
}
export function savedRoom(): SavedSession | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (
      !value ||
      typeof value !== 'object' ||
      !('token' in value) ||
      typeof value.token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(value.token)
    )
      return null;
    return {
      token: value.token,
      name: 'name' in value && typeof value.name === 'string' ? value.name : '',
      roomId:
        'roomId' in value && typeof value.roomId === 'string'
          ? value.roomId
          : null,
      watch: 'watch' in value && value.watch === true,
    };
  } catch {
    return null;
  }
}
interface Callbacks {
  onMessage: (message: ServerMessage) => void;
  onStatus: (connected: boolean) => void;
  onError: (message: Message) => void;
  onNotice: (message: Message) => void;
}
export class Room {
  seat = -1;
  private closed = false;
  private ready = false;
  private attempt = 0;
  private session: SavedSession | null = null;
  private socket?: WebSocket;
  private heartbeat?: ReturnType<typeof setInterval>;
  private timer?: ReturnType<typeof setTimeout>;
  private handshake?: ReturnType<typeof setTimeout>;
  private lastSeen = 0;
  private resolve?: () => void;
  private reject?: (error: AppError) => void;
  constructor(private readonly callbacks: Callbacks) {}
  private remember() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.session));
    } catch {
      this.callbacks.onNotice(messageEvent('connection.storage'));
    }
  }
  open(name: string): Promise<void> {
    const saved = savedRoom();
    this.session = {
      token:
        saved?.token ??
        Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join(''),
      name,
      roomId: saved?.roomId ?? null,
      watch: saved?.watch ?? false,
    };
    this.remember();
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.connect();
    });
  }
  private fail(message: Message) {
    this.closed = true;
    this.ready = false;
    this.reject?.(new AppError(message.code, message.params));
    this.resolve = undefined;
    this.reject = undefined;
    this.callbacks.onError(message);
  }
  private connect() {
    if (this.closed) return;
    this.ready = false;
    const socket = (this.socket = new WebSocket(
      API.replace(/^http/, 'ws') + '/lounge',
    ));
    let welcomed = false;
    this.handshake = setTimeout(() => socket.close(), 15000);
    socket.onopen = () => {
      if (this.closed || socket !== this.socket) return;
      socket.send(JSON.stringify({ type: 'hello', ...this.session }));
    };
    socket.onmessage = (event) => {
      if (this.closed || socket !== this.socket) return;
      this.lastSeen = Date.now();
      if (event.data === 'pong') return;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'welcome') {
        welcomed = true;
        this.ready = true;
        this.attempt = 0;
        clearTimeout(this.handshake);
        this.callbacks.onStatus(true);
        this.callbacks.onNotice(messageEvent('connection.welcome'));
        this.resolve?.();
        this.resolve = undefined;
        this.reject = undefined;
        clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => {
          if (Date.now() - this.lastSeen > 45000) socket.close();
          else if (socket.readyState === WebSocket.OPEN) socket.send('ping');
        }, 15000);
      } else if (msg.type === 'error' && !welcomed) {
        this.fail(msg);
        socket.close();
      } else {
        if (msg.type === 'state' && this.session) {
          this.seat = msg.value.seat;
          this.session.roomId = msg.value.roomId ?? null;
          this.session.watch = msg.value.spectator === true;
          this.remember();
        }
        if (msg.type === 'hall' && this.session) {
          this.seat = -1;
          this.session.roomId = null;
          this.session.watch = false;
          this.remember();
        }
        this.callbacks.onMessage(msg);
      }
    };
    socket.onclose = (event) => {
      if (socket !== this.socket) return;
      clearTimeout(this.handshake);
      clearInterval(this.heartbeat);
      if (this.closed) return;
      this.ready = false;
      this.callbacks.onStatus(false);
      if ([4001, 4003, 4008].includes(event.code)) {
        this.fail(
          messageEvent(
            event.code === 4001 ? 'error.otherTab' : 'error.disconnected',
          ),
        );
        return;
      }
      if (++this.attempt > 5 && this.reject) {
        this.fail(messageEvent('error.connectFailed'));
        return;
      }
      this.callbacks.onNotice(messageEvent('connection.retry'));
      this.timer = setTimeout(
        () => this.connect(),
        Math.min(1000 * 2 ** Math.min(this.attempt, 4), 15000),
      );
    };
    socket.onerror = () => socket.close();
  }
  request(body: ClientRequest) {
    if (!this.connected() || !this.socket)
      throw new AppError('error.waitConnection');
    this.socket.send(JSON.stringify(body));
    if ('name' in body && this.session) {
      this.session.name = body.name;
      this.remember();
    }
  }
  connected() {
    return this.ready && this.socket?.readyState === WebSocket.OPEN;
  }
  close() {
    this.closed = true;
    this.ready = false;
    clearTimeout(this.timer);
    clearTimeout(this.handshake);
    clearInterval(this.heartbeat);
    this.socket?.close();
    this.reject?.(new AppError('error.cancelled'));
    this.resolve = undefined;
    this.reject = undefined;
  }
}
