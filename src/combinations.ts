import { LABEL, sortCards } from './game.js';
import type { Card, Combination, Message } from './types';
const rank = (value: number) => LABEL[value] ?? String(value);
export function combinationMessage(
  play: Combination,
  special?: Card['special'],
): Message {
  if (play.size === 1 && special && special !== 'mahjong') {
    return special === 'phoenix'
      ? play.power <= 1.5
        ? { code: 'combo.phoenixLead' }
        : {
            code: 'combo.phoenix',
            params: { rank: rank(Math.floor(play.power - 0.5)) },
          }
      : { code: `card.${special}` };
  }
  const kind =
    play.bomb === 1 ? 'four' : play.bomb === 2 ? 'straightFlush' : play.kind;
  if (['straight', 'straightFlush', 'pairs'].includes(kind))
    return {
      code: `combo.${kind}`,
      params: {
        low: rank(play.power - play.size / (kind === 'pairs' ? 2 : 1) + 1),
        high: rank(play.power),
      },
    };
  return { code: `combo.${kind}`, params: { rank: rank(play.power) } };
}

// Use the rank accepted by the engine, not a new interpretation of the cards.
export function sortCombinationCards(
  play: Combination & { cards: Card[] },
): Card[] {
  const cards = sortCards(play.cards);
  if (play.size <= 1 || play.phoenixRank == null) return cards;
  const rank = (card: Card) =>
    card.special === 'phoenix' ? play.phoenixRank! : card.rank;
  return cards.sort((a, b) => rank(a) - rank(b));
}
