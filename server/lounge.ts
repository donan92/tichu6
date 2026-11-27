import { GameExecutor } from './game/executor.ts';
import { exportTrainingArchive } from './training/records.ts';
import { AppError, event, errorEvent } from '../src/messages.js';
import { MAX_SOCKETS } from './policy.ts';
import { RoomRepository } from './persistence/room.repository.ts';
import { Connections } from './transport/connections.ts';
import { nickname, parseMessage } from './transport/protocol.ts';
import {
  SessionService,
  authenticateHello,
} from './session/session.service.ts';
import { RoomService } from './room/room.service.ts';
import { Snapshots } from './room/snapshots.ts';
import { GameService } from './game/game.service.ts';
import { LifecycleService } from './lifecycle/lifecycle.service.ts';
import type { JsonObject, Room } from './types.ts';
export { nickname } from './transport/protocol.ts';
export { publicView } from './room/snapshots.ts';

// Durable Object adapter: owns event ordering, persistence and acknowledgements.
// Services never acknowledge a move or open an independent concurrency gate.
export class Lounge {
  readonly ctx: DurableObjectState;
  readonly repository: RoomRepository;
  readonly connections: Connections;
  readonly rooms: RoomService;
  readonly sessions: SessionService;
  readonly snapshots: Snapshots;
  readonly game: GameService;
  readonly lifecycle: LifecycleService;
  constructor(
    ctx: DurableObjectState,
    env?: { ROOM_ENGINES?: DurableObjectNamespace },
  ) {
    this.ctx = ctx;
    this.repository = new RoomRepository(ctx.storage);
    this.connections = new Connections(ctx);
    this.rooms = new RoomService(this.repository, this.connections);
    this.sessions = new SessionService(
      this.repository,
      this.connections,
      this.rooms,
    );
    this.snapshots = new Snapshots(this.repository, this.connections);
    this.game = new GameService(
      this.repository,
      this.connections,
      new GameExecutor(env?.ROOM_ENGINES),
    );
    this.lifecycle = new LifecycleService(
      this.repository,
      this.connections,
      this.rooms,
    );
    ctx.blockConcurrencyWhile(async () => {
      await this.repository.load();
      for (const ws of this.users()) {
        const { hash } = this.connections.authenticated(ws);
        this.data.activity[hash] ??= Date.now();
      }
      this.refreshPresence();
      await this.persist();
      await this.schedule();
    });
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    );
  }
  get data() {
    return this.repository.data;
  }
  users() {
    return this.connections.users();
  }
  attachment(ws: WebSocket) {
    return this.connections.attachment(ws);
  }
  online(room: Room) {
    return this.connections.online(room);
  }
  persist() {
    return this.repository.save();
  }
  broadcast() {
    this.snapshots.broadcast();
  }
  refreshPresence() {
    this.lifecycle.refreshPresence();
  }
  expireStalledRooms(now: number) {
    return this.lifecycle.expireStalledRooms(now);
  }
  schedule() {
    return this.lifecycle.schedule();
  }
  async exclusive(fn: () => Promise<void>) {
    let error: unknown;
    await this.ctx.blockConcurrencyWhile(async () => {
      try {
        await fn();
      } catch (e) {
        error = e;
      }
    });
    if (error) throw error;
  }
  async fetch(request: Request) {
    if (new URL(request.url).pathname === '/training-export') {
      let body = '';
      await this.exclusive(async () => {
        body = JSON.stringify(exportTrainingArchive(this.repository.training));
      });
      return new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket required', { status: 426 });
    if (this.connections.sockets().length >= MAX_SOCKETS)
      return new Response('Too many connections', { status: 429 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({
      created: Date.now(),
      window: Date.now(),
      requests: 0,
    });
    await this.schedule();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  private async dispatch(ws: WebSocket, msg: JsonObject) {
    switch (msg.type) {
      case 'trainingConsent': {
        if (typeof msg.enabled !== 'boolean')
          throw new AppError('error.invalidRequest');
        const attachment = this.connections.authenticated(ws);
        attachment.trainingConsent = msg.enabled;
        ws.serializeAttachment(attachment);
        for (const room of Object.values(this.data.rooms))
          for (const member of room.members)
            if (member?.hash === attachment.hash)
              member.trainingConsent = msg.enabled;
        break;
      }
      case 'create':
        if (msg.privateRoom != null && typeof msg.privateRoom !== 'boolean')
          throw new AppError('error.invalidRequest');
        this.rooms.create(ws, msg.name, msg.privateRoom === true);
        break;
      case 'joinCode': {
        const a = this.connections.authenticated(ws);
        const now = Date.now();
        const attempts = (this.data.inviteAttempts ??= {});
        for (const [hash, attempt] of Object.entries(attempts))
          if (now - attempt.window >= 60000) delete attempts[hash];
        const attempt = (attempts[a.hash] ??= { window: now, count: 0 });
        attempt.count++;
        await this.persist();
        if (attempt.count > 5) throw new AppError('error.inviteRateLimit');
        if (typeof msg.code !== 'string' || !/^[A-Z0-9]{6}$/.test(msg.code))
          throw new AppError('error.invalidInviteCode');
        const room = Object.values(this.data.rooms).find(
          (r) => r.inviteCode === msg.code,
        );
        if (!room) throw new AppError('error.invalidInviteCode');
        this.rooms.enter(ws, room.id, false, nickname(msg.name), msg.code);
        break;
      }
      case 'join':
        if (
          typeof msg.roomId !== 'string' ||
          !/^[a-f0-9-]{36}$/.test(msg.roomId) ||
          typeof msg.watch !== 'boolean'
        )
          throw new AppError('error.invalidRoom');
        this.rooms.enter(ws, msg.roomId, msg.watch, nickname(msg.name));
        break;
      case 'forfeit':
        this.rooms.forfeit(ws);
        break;
      case 'leave':
        this.rooms.leave(ws);
        break;
      case 'action':
        await this.game.apply(ws, msg);
        break;
      default:
        throw new AppError('error.unsupported');
    }
  }
  private async expireBeforeRequest(now: number) {
    if (this.expireStalledRooms(now)) {
      await this.persist();
      this.broadcast();
    }
    this.lifecycle.expireIdle(now);
    if (await this.game.advanceTimed(now)) {
      await this.persist();
      this.broadcast();
    }
  }
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    try {
      if (typeof raw !== 'string' || raw.length > 4096) {
        this.connections.send(ws, { type: 'error', ...event('error.payload') });
        ws.close(1009, 'Payload too large');
        return;
      }
      const a = this.attachment(ws),
        now = Date.now();
      if (now - (a.window || 0) >= 10000) {
        a.window = now;
        a.requests = 0;
      }
      a.requests = (a.requests || 0) + 1;
      ws.serializeAttachment(a);
      if (a.requests > 30) {
        this.connections.send(ws, {
          type: 'error',
          ...event('error.rateLimit'),
        });
        ws.close(4008, 'Rate limited');
        return;
      }
      const msg = parseMessage(raw);
      if (msg.type === 'hello') {
        if (a.hash) throw new AppError('error.alreadyConnected');
        const identity = await authenticateHello(msg);
        await this.exclusive(async () => {
          await this.expireBeforeRequest(now);
          if (!this.sessions.admit(ws, msg, identity, now)) {
            await this.persist();
            this.broadcast();
            await this.schedule();
            return;
          }
          this.refreshPresence();
          this.lifecycle.cleanup();
          await this.persist();
          this.connections.send(ws, { type: 'welcome' });
          this.broadcast();
        });
      } else {
        if (!a.hash) throw new AppError('error.enterFirst');
        await this.exclusive(async () => {
          await this.expireBeforeRequest(now);
          const current = this.attachment(ws);
          if (current.idle) {
            this.refreshPresence();
            this.lifecycle.cleanup();
            await this.persist();
            this.broadcast();
            await this.schedule();
            return;
          }
          if (!current.hash) throw new AppError('error.replaced');
          await this.dispatch(ws, msg);
          this.data.activity[current.hash] = now;
          this.refreshPresence();
          this.lifecycle.cleanup();
          await this.persist();
          this.broadcast();
        });
      }
      await this.schedule();
    } catch (error) {
      this.connections.send(ws, { type: 'error', ...errorEvent(error) });
      if (!this.attachment(ws).hash && !this.attachment(ws).idle)
        ws.close(4003, 'Admission rejected');
    }
  }
  async disconnected(ws: WebSocket) {
    await this.exclusive(async () => {
      ws.serializeAttachment({ created: Date.now() });
      this.refreshPresence();
      this.lifecycle.cleanup();
      await this.persist();
      this.broadcast();
    });
    await this.schedule();
  }
  async webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code === 1000 ? 1000 : 1001);
    } catch {
      /* Already closed. */
    }
    await this.disconnected(ws);
  }
  async webSocketError(ws: WebSocket) {
    try {
      ws.close(1011);
    } catch {
      /* Already closed. */
    }
    await this.disconnected(ws);
  }
  async alarm() {
    await this.exclusive(async () => {
      const now = Date.now();
      for (const ws of this.connections.sockets())
        if (
          !this.attachment(ws).hash &&
          now - (this.attachment(ws).created || 0) >= 10000
        )
          ws.close(4003, 'Handshake timeout');
      this.expireStalledRooms(now);
      this.lifecycle.expireIdle(now);
      this.refreshPresence();
      await this.game.advanceTimed(now);
      await this.game.advanceBots(now);
      this.lifecycle.cleanup();
      await this.persist();
      this.broadcast();
    });
    await this.schedule();
  }
}
