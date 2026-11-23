import LanguageDetector from 'i18next-browser-languagedetector';
import { createTranslator, languages } from './i18n.js';
export const i18next = createTranslator();
const detector = new LanguageDetector();
detector.init(i18next.services, {
  order: ['localStorage', 'navigator'],
  lookupLocalStorage: 'tichu6-language',
  caches: ['localStorage'],
});
export async function initializeLanguage() {
  const detected = detector.detect();
  const choices = Array.isArray(detected) ? detected : [detected];
  const language =
    choices
      .find((value) => value && languages[value.split('-')[0]])
      ?.split('-')[0] ?? 'en';
  await i18next.changeLanguage(language);
}
export async function changeLanguage(language: string) {
  if (!languages[language]) return;
  await i18next.changeLanguage(language);
  detector.cacheUserLanguage(language);
}
