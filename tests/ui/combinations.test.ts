import { expect, it } from 'vitest';
import { combinationMessage } from '../../src/combinations';
import { i18next } from '../../src/localization';
import type { Combination } from '../../src/types';
it('renders ranked combinations and actual ranges in both languages', async () => {
  const cases: [Combination, string][] = [
    [{ kind: 'single', power: 6, size: 1, bomb: 0 }, '6 싱글'],
    [{ kind: 'pair', power: 10, size: 2, bomb: 0 }, '10 페어'],
    [{ kind: 'fullhouse', power: 10, size: 5, bomb: 0 }, '10 풀하우스'],
    [{ kind: 'bomb', power: 6, size: 4, bomb: 1 }, '6 포카드'],
    [{ kind: 'straight', power: 11, size: 7, bomb: 0 }, '5–J 스트레이트'],
    [{ kind: 'bomb', power: 10, size: 8, bomb: 2 }, '3–10 스트레이트 플러쉬'],
    [{ kind: 'pairs', power: 5, size: 6, bomb: 0 }, '3–5 연속 페어'],
  ];
  await i18next.changeLanguage('ko');
  for (const [play, expected] of cases) {
    const label = combinationMessage(play);
    expect(i18next.t(label.code, label.params ?? {})).toBe(expected);
  }
  await i18next.changeLanguage('en');
  const label = combinationMessage(cases[4][0]);
  expect(i18next.t(label.code, label.params ?? {})).toBe('5–J straight');
  expect(
    combinationMessage(
      { kind: 'single', power: 16, size: 1, bomb: 0 },
      'dragon',
    ).code,
  ).toBe('card.dragon');
});
