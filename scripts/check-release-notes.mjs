import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { languages } from '../src/locales/index.js';

export function validateReleaseNotes(version, lock, notes, packs) {
  const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  if (!stable.test(version))
    throw new Error('Release version must be stable semver.');
  if (lock.version !== version || lock.packages?.['']?.version !== version)
    throw new Error(
      'Update package.json and package-lock.json versions together.',
    );
  if (
    !Array.isArray(notes) ||
    notes.length < 5 ||
    notes[0]?.version !== version
  )
    throw new Error(
      'Add a release note for the current version, newest first, with at least five entries.',
    );
  const versions = new Set(),
    keys = new Set();
  for (const [index, entry] of notes.entries()) {
    if (!entry || !stable.test(entry.version) || versions.has(entry.version))
      throw new Error('Release versions must be valid and unique.');
    if (index) {
      const prior = notes[index - 1].version.split('.').map(Number);
      const current = entry.version.split('.').map(Number);
      const difference = prior
        .map((n, i) => n - current[i])
        .find((n) => n !== 0);
      if (!(difference > 0))
        throw new Error('Release notes must be newest first.');
    }
    if (
      typeof entry.summary !== 'string' ||
      !/^patches\.[a-zA-Z][a-zA-Z0-9]*$/.test(entry.summary) ||
      keys.has(entry.summary)
    )
      throw new Error('Each release needs its own semantic summary key.');
    for (const [language, { translation }] of Object.entries(packs)) {
      const text = translation[entry.summary];
      if (
        typeof text !== 'string' ||
        !text.trim() ||
        text.length > 160 ||
        /[\r\n<>]|{{/.test(text)
      )
        throw new Error(
          `${entry.version}: add one short plain-text summary in ${language}.`,
        );
    }
    versions.add(entry.version);
    keys.add(entry.summary);
  }
}
export async function checkReleaseNotes() {
  const read = async (path) =>
    JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
  const [pkg, lock, notes] = await Promise.all([
    read('../package.json'),
    read('../package-lock.json'),
    read('../src/release-notes.json'),
  ]);
  validateReleaseNotes(pkg.version, lock, notes, languages);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await checkReleaseNotes();
  console.log(
    'Release notes match the version, lockfile and all registered languages.',
  );
}
