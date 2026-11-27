import { act, botAction, startRound } from '../../src/game.js';
import { AppError } from '../../src/messages.js';
import type { GameAction, RoundState } from '../../src/types';
import type { GameState } from '../types.ts';

// The lounge remains the admission/presence/commit coordinator. Room engines
// isolate expensive rules/bot evaluation and persist idempotent transition results.
export class GameExecutor {
  readonly engines?: DurableObjectNamespace;
  constructor(engines?: DurableObjectNamespace) {
    this.engines = engines;
  }
  private async request(id: string, payload: object) {
    const response = await this.engines!.get(
      this.engines!.idFromName(id),
    ).fetch('https://room-engine/transition', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new AppError('error.invalidRequest');
    const result = (await response.json()) as {
      state: RoundState;
      action: GameAction;
      error?: { code: string; params?: Record<string, string | number> };
    };
    if (result.error)
      throw new AppError(result.error.code, result.error.params);
    return result;
  }
  async act(id: string, state: RoundState, seat: number, action: GameAction) {
    return this.engines
      ? (await this.request(id, { operation: 'act', state, seat, action }))
          .state
      : act(state, seat, action);
  }
  async start(id: string, state: GameState) {
    return this.engines
      ? (await this.request(id, { operation: 'start', state })).state
      : startRound(state);
  }
  async bot(id: string, state: RoundState, seat: number) {
    return this.engines
      ? (await this.request(id, { operation: 'bot', state, seat })).action
      : botAction(state, seat);
  }
}
