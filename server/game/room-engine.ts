import { Alarm } from '../persistence/alarm.ts';
import {
  act,
  botAction,
  startRound,
  BOT_POLICY_VERSION,
} from '../../src/game.js';
import { errorEvent } from '../../src/messages.js';
import type { GameAction, RoundState } from '../../src/types';
import type { GameState } from '../types.ts';

// Internal-only binding: callers are the authenticated lounge coordinator.
// Each room ID selects its own object; no public HTTP route exposes this class.
export class RoomEngine {
  private readonly expiry: Alarm;
  private last: { key: string; value: unknown; expiresAt?: number } | undefined;
  private loaded = false;
  // Pure policy queries do not commit a game transition. Keep only one disposable
  // result; durable `last` stays available for randomized deal/action retries.
  private decision: { key: string; value: { action: GameAction } } | undefined;
  readonly ctx: DurableObjectState;
  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
    this.expiry = new Alarm(ctx.storage);
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
      let input: {
        operation: string;
        state: GameState;
        seat: number;
        action: GameAction;
      };
      try {
        input = JSON.parse(raw);
        if (input.operation === 'bot') {
          const decisionKey = `${BOT_POLICY_VERSION}:${key}`;
          if (this.decision?.key !== decisionKey) {
            this.decision = {
              key: decisionKey,
              value: {
                action: botAction(input.state as RoundState, input.seat),
              },
            };
          }
          result = this.decision.value;
          return;
        }
      } catch (error) {
        result = { error: errorEvent(error) };
        return;
      }
      if (!this.loaded) {
        this.last = await this.ctx.storage.get('last');
        this.loaded = true;
      }
      const cached = this.last;
      if (cached?.key === key) {
        // Repair an alarm write that failed after the idempotent result committed.
        await this.expiry.update(
          cached.expiresAt ?? Date.now() + 86400000,
          true,
        );
        result = cached.value;
        return;
      }
      try {
        if (input.operation === 'start')
          result = { state: startRound(input.state) };
        else if (input.operation === 'act')
          result = {
            state: act(input.state as RoundState, input.seat, input.action),
          };
        else {
          result = { error: { code: 'error.invalidRequest' } };
          return;
        }
        const entry = { key, value: result, expiresAt: Date.now() + 86400000 };
        await this.ctx.storage.put('last', entry);
        this.last = entry;
        await this.expiry.update(entry.expiresAt, true);
      } catch (error) {
        // A storage failure may have an uncertain commit outcome. Reload before
        // retrying a randomized deal rather than trusting the warm cache.
        this.loaded = false;
        this.last = undefined;
        result = { error: errorEvent(error) };
      }
    });
    return Response.json(result);
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      this.expiry.fired();
      const cached = await this.ctx.storage.get<{ expiresAt?: number }>('last');
      if (cached?.expiresAt && cached.expiresAt > Date.now()) {
        await this.expiry.update(cached.expiresAt);
        return;
      }
      await this.ctx.storage.deleteAll();
      this.last = undefined;
      this.decision = undefined;
      this.loaded = false;
    });
  }
}
