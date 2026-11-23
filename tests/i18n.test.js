import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createTranslator,
  languages,
  translateEvent,
  translateRoom,
} from '../src/i18n.js';
import { newGame, startRound, act } from '../src/game.js';
import { AppError, errorEvent } from '../src/messages.js';
const placeholders = (s) =>
  [...s.matchAll(/{{\s*([^}]+)\s*}}/g)].map((m) => m[1].trim()).sort();
test('language packs have identical stable keys and interpolation variables', () => {
  const reference = languages.en.translation;
  for (const { translation } of Object.values(languages)) {
    assert.deepEqual(
      Object.keys(translation).sort(),
      Object.keys(reference).sort(),
    );
    for (const [key, value] of Object.entries(translation)) {
      assert.match(key, /^[a-z][A-Za-z0-9._]+$/);
      assert.ok(value.length);
      assert.deepEqual(placeholders(value), placeholders(reference[key]), key);
      assert.doesNotMatch(
        value,
        /<\/?[a-z][^>]*>/i,
        'Language packs contain text, not HTML',
      );
    }
  }
});
test('i18next handles regional locales, English fallback, plurals and switching', async () => {
  const i = createTranslator('ko-KR');
  assert.equal(i.resolvedLanguage, 'ko');
  assert.equal(i.t('lounge.createRoom'), '랜덤 제목으로 방 만들기');
  await i.changeLanguage('en-US');
  assert.equal(i.t('play.cardCount', { count: 1 }), '1 card');
  assert.equal(i.t('play.cardCount', { count: 2 }), '2 cards');
  await i.changeLanguage('fr');
  assert.equal(i.resolvedLanguage, 'en');
  assert.equal(i.t('lounge.createRoom'), 'Create a random-title room');
});
test('the same stored game event and room title render in both languages without changing data', () => {
  let state = startRound(newGame());
  state = act(state, 0, { type: 'grand', call: true });
  const before = structuredClone(state);
  const en = createTranslator('en'),
    ko = createTranslator('ko');
  assert.match(translateEvent(en, state.log[0]), /Round 1/);
  assert.match(translateEvent(ko, state.log[0]), /1라운드/);
  assert.match(translateEvent(en, state.log[1]), /Player1.*Large Tichu/);
  assert.deepEqual(state, before);
  const title = { adjective: 'moon', noun: 'garden', number: '007' };
  assert.equal(translateRoom(en, title), 'Moonlit Garden 007');
  assert.equal(translateRoom(ko, title), '달빛 정원 007');
  assert.equal(
    translateEvent(en, {
      code: 'log.play',
      params: { name: 'Alice', kind: 'pair', count: 2 },
    }),
    'Alice · Pair (2 cards)',
  );
});
test('errors remain language neutral; unknown internal details are not exposed', () => {
  const e = errorEvent(new AppError('error.fulfillWish', { rank: 'A' }));
  assert.match(translateEvent(createTranslator('en'), e), /A wish/);
  assert.match(translateEvent(createTranslator('ko'), e), /A 소원/);
  assert.deepEqual(errorEvent(new Error('private storage details')), {
    code: 'error.internal',
    params: {},
  });
});
test('interpolated user names are preserved as data and UI escapes translated output', async () => {
  const i = createTranslator('en'),
    value = translateEvent(i, {
      code: 'log.grand',
      params: { name: '<img src=x onerror=1>' },
    });
  assert.equal(value, '<img src=x onerror=1> · Large Tichu!');
  // Vue rendering and interpolation safety are exercised in tests/ui/components.test.ts.
});
test('active UI and protocol use codes instead of Korean sentence literals', async () => {
  for (const file of ['main.ts', 'game.js', 'server-room.ts', 'messages.js'])
    assert.doesNotMatch(
      await readFile(new URL('../src/' + file, import.meta.url), 'utf8'),
      /[가-힣]/,
      file,
    );
  assert.doesNotMatch(
    await readFile(new URL('../server/lounge.js', import.meta.url), 'utf8'),
    /[가-힣]/,
  );
});
