// Retained for existing GameRoom Durable Objects; new traffic uses Lounge.
import { newGame, startRound, act, view, botAction } from '../src/game.js';
const TTL = 86400000,
  GRACE = 45000;
const json = (value, status = 200) => Response.json(value, { status });
export class GameRoom {
  constructor(ctx) {
    this.ctx = ctx;
    this.data = null;
    ctx.blockConcurrencyWhile(async () => {
      this.data = await ctx.storage.get('room');
    });
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    );
  }
  async serial(fn) {
    let error;
    await this.ctx.blockConcurrencyWhile(async () => {
      try {
        await fn();
      } catch (e) {
        error = e;
      }
    });
    if (error) throw error;
  }
  async save() {
    this.data.updated = Date.now();
    await this.ctx.storage.put('room', this.data);
  }
  sockets() {
    return this.ctx.getWebSockets().filter((s) => s.readyState === 1);
  }
  online() {
    return Array.from({ length: 6 }, (_, i) =>
      this.sockets().some((s) => s.deserializeAttachment()?.seat === i),
    );
  }
  async fetch(request) {
    if (new URL(request.url).pathname === '/create') {
      if (this.data)
        return json({ error: '코드 충돌입니다. 다시 시도하세요.' }, 409);
      const { code } = await request.json();
      this.data = {
        code,
        state: newGame(),
        members: Array(6).fill(null),
        updated: Date.now(),
      };
      await this.save();
      await this.ctx.storage.setAlarm(Date.now() + TTL);
      return json({ code });
    }
    if (!this.data) return json({ error: '방이 없거나 만료되었습니다.' }, 404);
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return json({ error: 'WebSocket required' }, 426);
    if (this.sockets().length >= 12)
      return json({ error: '연결이 너무 많습니다.' }, 429);
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ seat: null, created: Date.now() });
    await this.ctx.storage.setAlarm(Date.now() + 15000);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  send(ws, msg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* Socket may already be closed; presence cleanup still runs. */
    }
  }
  broadcast() {
    const online = this.online(),
      leader = online.findIndex(Boolean);
    for (const ws of this.sockets()) {
      const seat = ws.deserializeAttachment()?.seat;
      if (Number.isInteger(seat))
        this.send(ws, {
          type: 'state',
          value: {
            ...view(this.data.state, seat),
            paused: false,
            leader,
            offline: online.map((x) => !x),
          },
          online,
        });
    }
  }
  async webSocketMessage(ws, raw) {
    try {
      if (typeof raw !== 'string' || raw.length > 8192)
        throw new Error('잘못된 요청입니다.');
      const msg = JSON.parse(raw);
      let attachment = ws.deserializeAttachment();
      if (msg.type === 'hello') {
        if (Number.isInteger(attachment.seat)) return;
        if (typeof msg.token !== 'string' || !/^[a-f0-9]{64}$/.test(msg.token))
          throw new Error('참가 키가 올바르지 않습니다.');
        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(msg.token),
        );
        const hash = Array.from(new Uint8Array(digest), (x) =>
          x.toString(16).padStart(2, '0'),
        ).join('');
        // Serialize admission across crypto/storage awaits, including simultaneous joins.
        await this.serial(async () => {
          let seat = this.data.members.findIndex((m) => m?.hash === hash);
          if (seat < 0) {
            if (this.data.state.phase !== 'lobby')
              throw new Error(
                '이미 시작한 방입니다. 기존 참가자는 같은 브라우저로 복귀하세요.',
              );
            seat = this.data.members.indexOf(null);
            if (seat < 0) throw new Error('이미 6명이 입장한 방입니다.');
            this.data.members[seat] = { hash, offlineSince: null };
            this.data.state.names[seat] = String(
              msg.name || `플레이어 ${seat + 1}`,
            ).slice(0, 20);
          }
          for (const old of this.sockets())
            if (old !== ws && old.deserializeAttachment()?.seat === seat) {
              old.serializeAttachment({ seat: null });
              old.close(4001, 'Replaced');
            }
          this.data.members[seat].offlineSince = null;
          ws.serializeAttachment({ seat });
          await this.save();
          this.send(ws, { type: 'welcome', seat, code: this.data.code });
          this.broadcast();
        });
        await this.schedule();
        return;
      }
      const seat = attachment?.seat;
      if (!Number.isInteger(seat)) throw new Error('먼저 입장해 주세요.');
      if (msg.type === 'action') {
        await this.serial(async () => {
          const current = this.data.state;
          if (msg.revision !== current.revision)
            throw new Error('상태가 바뀌었습니다. 다시 선택해 주세요.');
          let next;
          if (msg.action?.type === 'start' || msg.action?.type === 'next') {
            if (seat !== this.online().findIndex(Boolean))
              throw new Error('현재 진행 담당자만 시작할 수 있습니다.');
            if (!this.data.members.every(Boolean))
              throw new Error('6명이 필요합니다.');
            if (current.phase === 'lobby' && !this.online().every(Boolean))
              throw new Error('첫 시작은 모두 연결되어야 합니다.');
            next = startRound(structuredClone(current));
          } else next = act(current, seat, msg.action);
          this.data.state = next;
          await this.save();
          this.broadcast();
        });
      }
      await this.schedule();
    } catch (error) {
      this.send(ws, { type: 'error', message: error.message });
      if (!Number.isInteger(ws.deserializeAttachment()?.seat))
        ws.close(4003, 'Admission rejected');
      else this.broadcast();
    }
  }
  async disconnected(ws) {
    if (!this.data) return;
    const seat = ws.deserializeAttachment()?.seat;
    ws.serializeAttachment({ seat: null });
    if (
      Number.isInteger(seat) &&
      !this.online()[seat] &&
      this.data.members[seat]
    ) {
      this.data.members[seat].offlineSince = Date.now();
      await this.save();
    }
    this.broadcast();
    await this.schedule();
  }
  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1000 ? 1000 : 1001);
    } catch {
      /* Socket may already be closed; presence cleanup still runs. */
    }
    await this.disconnected(ws);
  }
  async webSocketError(ws) {
    try {
      ws.close(1011);
    } catch {
      /* Socket may already be closed; presence cleanup still runs. */
    }
    await this.disconnected(ws);
  }
  async schedule() {
    if (!this.data) return;
    const now = Date.now(),
      online = this.online();
    let at = this.data.updated + TTL;
    for (const ws of this.sockets())
      if (!Number.isInteger(ws.deserializeAttachment()?.seat))
        at = Math.min(at, ws.deserializeAttachment().created + 15000);
    const state = this.data.state;
    let changed = false;
    if (online.some(Boolean))
      for (let i = 0; i < 6; i++)
        if (this.data.members[i] && !online[i]) {
          if (this.data.members[i].offlineSince == null) {
            this.data.members[i].offlineSince = now;
            changed = true;
          }
          const needsAction =
            state.phase === 'lobby' ||
            (state.phase === 'grand' && !state.ready[i]) ||
            (state.phase === 'exchange' && !state.exchanges[i]) ||
            (state.phase === 'play' && state.turn === i) ||
            (state.phase === 'trick' && state.last === i);
          if (needsAction)
            at = Math.min(
              at,
              Math.max(now + 2000, this.data.members[i].offlineSince + GRACE),
            );
        }
    if (changed) await this.ctx.storage.put('room', this.data);
    await this.ctx.storage.setAlarm(Math.max(now + 1000, at));
  }
  async alarm() {
    const now = Date.now();
    for (const ws of this.sockets())
      if (
        !Number.isInteger(ws.deserializeAttachment()?.seat) &&
        now - ws.deserializeAttachment().created >= 15000
      )
        ws.close(4003, 'Timeout');
    const online = this.online();
    if (!online.some(Boolean) && now - this.data.updated >= TTL) {
      await this.ctx.storage.deleteAll();
      this.data = null;
      return;
    }
    if (online.some(Boolean)) {
      const s = this.data.state;
      const eligible = (i) =>
        this.data.members[i] &&
        !online[i] &&
        now - (this.data.members[i].offlineSince ?? now) >= GRACE;
      if (s.phase === 'lobby') {
        for (let i = 0; i < 6; i++)
          if (eligible(i)) {
            this.data.members[i] = null;
            s.names[i] = `플레이어 ${i + 1}`;
          }
      } else {
        let seat =
          s.phase === 'grand'
            ? s.ready.findIndex((x, i) => !x && eligible(i))
            : s.phase === 'exchange'
              ? s.exchanges.findIndex((x, i) => !x && eligible(i))
              : s.phase === 'play'
                ? s.turn
                : s.phase === 'trick'
                  ? s.last
                  : -1;
        if (seat >= 0 && eligible(seat))
          this.data.state = act(s, seat, botAction(s, seat));
      }
      await this.save();
      this.broadcast();
    }
    await this.schedule();
  }
}
