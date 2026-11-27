import { act, botAction, startRound } from '../../src/game.js';
import { errorEvent } from '../../src/messages.js';
import type { GameAction, RoundState } from '../../src/types';
import type { GameState } from '../types.ts';

// Internal-only binding: callers are the authenticated lounge coordinator.
// Each room ID selects its own object; no public HTTP route exposes this class.
export class RoomEngine {
  readonly ctx: DurableObjectState;
  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }
  async fetch(request: Request) {
    const raw = await request.text();
    if (raw.length > 4 * 1024 * 1024)
      return new Response('Too large', { status: 413 });
    const key = Array.from(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)),
      ),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('');
    let result: unknown;
    await this.ctx.blockConcurrencyWhile(async () => {
      const cached = await this.ctx.storage.get<{
        key: string;
        value: unknown;
      }>('last');
      if (cached?.key === key) {
        result = cached.value;
        return;
      }
      try {
        const input = JSON.parse(raw) as {
          operation: string;
          state: GameState;
          seat: number;
          action: GameAction;
        };
        if (input.operation === 'start')
          result = { state: startRound(input.state) };
        else if (input.operation === 'bot')
          result = { action: botAction(input.state as RoundState, input.seat) };
        else if (input.operation === 'act')
          result = {
            state: act(input.state as RoundState, input.seat, input.action),
          };
        else {
          result = { error: { code: 'error.invalidRequest' } };
          return;
        }
        await this.ctx.storage.put('last', { key, value: result });
        await this.ctx.storage.setAlarm(Date.now() + 86400000);
      } catch (error) {
        result = { error: errorEvent(error) };
      }
    });
    return Response.json(result);
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
