import { expect, it } from 'vitest';
import {
  combinationMessage,
  sortCombinationCards,
} from '../../src/combinations';
import { i18next } from '../../src/localization';
import { classify } from '../../src/game.js';
import type { Card, Combination } from '../../src/types';
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

it('describes phoenix singles using the underlying rank instead of fractional power', async () => {
  await i18next.changeLanguage('ko');
  for (const [power, expected] of [
    [14.5, 'A 위 봉황'],
    [13.5, 'K 위 봉황'],
    [6.5, '6 위 봉황'],
    [1.5, '봉황 싱글'],
  ] as const) {
    const label = combinationMessage(
      { kind: 'single', power, size: 1, bomb: 0 },
      'phoenix',
    );
    expect(i18next.t(label.code, label.params ?? {})).toBe(expected);
  }
  await i18next.changeLanguage('en');
  const label = combinationMessage(
    { kind: 'single', power: 14.5, size: 1, bomb: 0 },
    'phoenix',
  );
  expect(i18next.t(label.code, label.params ?? {})).toBe('Phoenix over A');
});

it.each([
  [[4, 5, 7, 8], 6, [4, 5, 'phoenix', 7, 8]],
  [[3, 3, 10, 10], 3, [3, 3, 'phoenix', 10, 10]],
  [[4, 4, 5, 6, 6], 5, [4, 4, 5, 'phoenix', 6, 6]],
  [[9], 9, [9, 'phoenix']],
])('places Phoenix at its accepted role in %j', (ranks, role, expected) => {
  const cards: Card[] = (ranks as number[]).map((rank, i) => ({
    id: String(i),
    rank,
    suit: i % 4,
  }));
  cards.push({ id: 'phoenix', rank: 15, suit: -1, special: 'phoenix' });
  const before = structuredClone(cards);
  const play = classify(cards, null, role as number)!;
  expect(play).not.toBeNull();
  const sorted = sortCombinationCards({ ...play, cards });
  expect(sorted.map((card) => card.special || card.rank)).toEqual(expected);
  expect(cards).toEqual(before);
  expect(sorted.find((card) => card.special === 'phoenix')?.rank).toBe(15);
});
