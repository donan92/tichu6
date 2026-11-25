import { AppError } from '../../src/messages.js';
import type { GameAction } from '../../src/types';
import type { JsonObject } from '../types.ts';

export function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function parseMessage(raw: string): JsonObject & { type: string } {
  const msg: unknown = JSON.parse(raw);
  if (!object(msg) || typeof msg.type !== 'string')
    throw new AppError('error.invalidRequest');
  return { ...msg, type: msg.type };
}
export function nickname(input: unknown): string {
  if (typeof input !== 'string' || !/^[A-Za-z0-9]{1,8}$/.test(input))
    throw new AppError('error.invalidNickname');
  return input;
}
export function gameAction(input: unknown): GameAction {
  if (
    !object(input) ||
    ![
      'start',
      'next',
      'grand',
      'exchange',
      'tichu',
      'pass',
      'collect',
      'dragonTarget',
      'play',
    ].includes(typeof input.type === 'string' ? input.type : '')
  )
    throw new AppError('error.invalidAction');
  if (input.type === 'grand' && typeof input.call !== 'boolean')
    throw new AppError('error.invalidCall');
  if (input.type === 'play' || input.type === 'exchange') {
    if (
      !Array.isArray(input.ids) ||
      input.ids.length > 18 ||
      input.ids.some((id) => typeof id !== 'string' || id.length > 30)
    )
      throw new AppError('error.invalidCards');
  }
  for (const key of ['target', 'wish', 'phoenixRank']) {
    const value = input[key];
    if (
      value != null &&
      (typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > 14)
    )
      throw new AppError('error.invalidChoice');
  }
  // Return only validated protocol fields; seat/identity never come from input.
  switch (input.type) {
    case 'start':
    case 'next':
    case 'tichu':
    case 'pass':
      return { type: input.type };
    case 'grand':
      return { type: 'grand', call: input.call as boolean };
    case 'exchange':
      return { type: 'exchange', ids: input.ids as string[] };
    case 'dragonTarget':
      if (typeof input.target !== 'number')
        throw new AppError('error.invalidChoice');
      return { type: 'dragonTarget', target: input.target };
    case 'collect':
      return {
        type: 'collect',
        target: input.target as number | null | undefined,
      };
    case 'play':
      return {
        type: 'play',
        ids: input.ids as string[],
        target: input.target as number | null | undefined,
        wish: input.wish as number | null | undefined,
        phoenixRank: input.phoenixRank as number | null | undefined,
      };
    default:
      throw new AppError('error.invalidAction');
  }
}
