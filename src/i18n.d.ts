import type { i18n } from 'i18next';
import type { Message, RoomTitle } from './types';
export { languages } from './locales/index.js';
export function createTranslator(language?: string): i18n;
export function translateEvent(
  instance: i18n,
  event: Message | string | null,
): string;
export function translateRoom(instance: i18n, title?: RoomTitle): string;
