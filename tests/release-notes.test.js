import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkReleaseNotes,
  validateReleaseNotes,
} from '../scripts/check-release-notes.mjs';
const version = '1.2.0';
const lock = { version, packages: { '': { version } } };
const notes = ['1.2.0', '1.1.0', '1.0.2', '1.0.1', '1.0.0'].map(
  (version, index) => ({ version, summary: `patches.item${index}` }),
);
const packs = {
  ko: {
    translation: Object.fromEntries(notes.map((n) => [n.summary, '버그 수정'])),
  },
  en: {
    translation: Object.fromEntries(
      notes.map((n) => [n.summary, 'Bug fixes.']),
    ),
  },
};
test(
  'current release has complete localized notes and matching lockfile versions',
  checkReleaseNotes,
);
test('version bump fails until a current-version summary is added', () => {
  assert.throws(
    () =>
      validateReleaseNotes(
        '1.2.1',
        { version: '1.2.1', packages: { '': { version: '1.2.1' } } },
        notes,
        packs,
      ),
    /current version/,
  );
  assert.throws(
    () =>
      validateReleaseNotes(
        version,
        { ...lock, version: '1.1.0' },
        notes,
        packs,
      ),
    /lock/,
  );
});
test('release guard rejects missing translations, multiple lines and broken chronology', () => {
  const missing = structuredClone(packs);
  delete missing.ko.translation['patches.item0'];
  assert.throws(
    () => validateReleaseNotes(version, lock, notes, missing),
    /ko/,
  );
  const multi = structuredClone(packs);
  multi.en.translation['patches.item0'] = 'First\nSecond';
  assert.throws(
    () => validateReleaseNotes(version, lock, notes, multi),
    /short/,
  );
  assert.throws(
    () =>
      validateReleaseNotes(
        version,
        lock,
        [...notes.slice(0, 2), notes[4], notes[3], notes[2]],
        packs,
      ),
    /newest/,
  );
  assert.throws(
    () => validateReleaseNotes(version, lock, [...notes, notes[0]], packs),
    /unique/,
  );
  assert.doesNotThrow(() => validateReleaseNotes(version, lock, notes, packs));
});
