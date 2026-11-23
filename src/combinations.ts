import { LABEL } from './game.js';
import type { Card, Combination, Message } from './types';
const rank = (value: number) => LABEL[value] ?? String(value);
export function combinationMessage(
  play: Combination,
  special?: Card['special'],
): Message {
  if (play.size === 1 && special && special !== 'mahjong') {
    return special === 'phoenix'
      ? { code: 'combo.phoenix', params: { rank: rank(play.power) } }
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
