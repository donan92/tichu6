import type { Message } from './types';
export class AppError extends Error implements Message {
  constructor(code: string, params?: Record<string, unknown>);
  code: string;
  params: Record<string, unknown>;
}
export function event(code: string, params?: Record<string, unknown>): Message;
export function errorEvent(error: unknown): Message;
