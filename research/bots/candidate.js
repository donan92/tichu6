import { legalPlays, partners, points, team } from '../../src/game.js';
import { botAction as baseline } from './baseline.js';

// Experimental policy; no private information beyond the acting hand is read.
export function candidate(s, seat, variant = 'structure', config = {}) {
  if (variant === 'hybrid' && s.top) return baseline(s, seat);
  const hand =
    s.phase === 'grand'
      ? s.hands[seat].filter((c) => s.first[seat].includes(c.id))
      : s.hands[seat];
  const shapes = legalPlays(hand);
  const controls =
    hand.filter((c) => c.rank === 14 || c.special === 'dragon').length +
    Number(hand.some((c) => c.special === 'phoenix')) * 1.5 +
    shapes.filter((o) => o.play.bomb === 1).length * 2;
  if (s.phase === 'grand')
    return {
      type: 'grand',
      call: variant === 'calls' && controls >= (config.grandThreshold ?? 5.5),
    };
  if (s.phase !== 'play') return baseline(s, seat);
  if (
    variant === 'calls' &&
    !s.played[seat] &&
    !s.calls[seat] &&
    !partners(seat).some((i) => s.calls[i]) &&
    controls >= (config.smallThreshold ?? 7)
  )
    return { type: 'tichu' };
  const required = s.wish ? legalPlays(hand, s.top, s.wish) : [];
  let options = required.length
    ? required
    : s.top
      ? legalPlays(hand, s.top)
      : shapes;
  if (!options.length) return { type: 'pass' };
  const finish = options.find((o) => o.cards.length === hand.length);
  if (s.top && !required.length && !finish && team(s.last) === team(seat))
    return { type: 'pass' };
  const urgent = s.hands.some(
    (h, i) => team(i) !== team(seat) && h.length > 0 && h.length <= 2,
  );
  if (s.top && !required.length && !finish) {
    options = options.filter(
      (o) => !o.play.bomb || urgent || points(s.pile) >= 10,
    );
    if (!options.length) return { type: 'pass' };
  }
  const masks = new Map(hand.map((c, i) => [c.id, 1 << i]));
  const maskOf = (cards) => cards.reduce((m, c) => m | masks.get(c.id), 0);
  const groups = shapes
    .filter((o) => o.cards.length > 1)
    .map((o) => ({
      mask: maskOf(o.cards),
      size: o.cards.length,
      power: o.play.power,
    }))
    .sort((a, b) => b.size - a.size || a.power - b.power);
  const all = (1 << hand.length) - 1;
  const remainder = (used) => {
    let rest = all ^ used,
      turns = 0;
    for (const g of groups)
      if ((rest & g.mask) === g.mask) {
        rest ^= g.mask;
        turns += 1 + Math.max(0, 12 - g.power) * 0.025;
      }
    for (let i = 0; i < hand.length; i++)
      if (rest & (1 << i)) turns += 1 + Math.max(0, 12 - hand[i].rank) * 0.035;
    return turns;
  };
  const bombMasks = shapes
    .filter((o) => o.play.bomb)
    .map((o) => maskOf(o.cards));
  const score = (o) => {
    const mask = maskOf(o.cards);
    const breaksBomb =
      !o.play.bomb && bombMasks.some((b) => b & mask && (b & mask) !== b);
    let value =
      remainder(mask) * (config.structureWeight ?? 40) +
      o.play.power *
        (urgent && s.top
          ? (config.urgentPower ?? -1)
          : (config.powerWeight ?? 0.5));
    if (breaksBomb) value += config.breakBomb ?? 100;
    if (o.play.bomb)
      value += s.top ? (config.responseBomb ?? 35) : (config.leadBomb ?? 20);
    if (s.top && o.cards.some((c) => c.special === 'dragon'))
      value += Math.max(0, points(s.pile)) * 0.5;
    if (!s.top && o.cards[0].special === 'dog') value -= 20;
    return value;
  };
  options.sort((a, b) => score(a) - score(b));
  const selected = finish || options[0];
  return {
    type: 'play',
    ids: selected.cards.map((c) => c.id),
    target:
      partners(seat).find((i) => s.calls[i] && s.hands[i].length) ??
      partners(seat)[0],
    wish: baseline(s, seat).wish ?? 14,
  };
}
