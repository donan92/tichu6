import i18next from 'i18next';
import { languages, fallbackLanguage } from './locales/index.js';
export { languages };
export const resources = Object.fromEntries(
  Object.entries(languages).map(([id, value]) => [
    id,
    { translation: value.translation },
  ]),
);
export function createTranslator(language = fallbackLanguage) {
  const instance = i18next.createInstance();
  instance.init({
    resources,
    lng: language,
    fallbackLng: fallbackLanguage,
    supportedLngs: Object.keys(languages),
    load: 'languageOnly',
    keySeparator: false,
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  return instance;
}
// Callers render these plain-text results with textContent or HTML escaping.
export function translateEvent(instance, event) {
  if (typeof event === 'string') return event; // Stored pre-i18n history remains readable.
  if (!event || typeof event.code !== 'string') return '';
  const params = { ...event.params };
  if (event.code === 'log.play')
    params.kind = instance.t('kind.' + params.kind);
  return instance.t(event.code, params);
}
export function translateRoom(instance, title) {
  if (typeof title === 'string') return title; // Pre-i18n room names are preserved.
  return title
    ? instance.t('room.title', {
        adjective: instance.t('room.adjective.' + title.adjective),
        noun: instance.t('room.noun.' + title.noun),
        number: title.number,
      })
    : '';
}
