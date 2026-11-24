// Optional rule-policy helper. Callers remain responsible for wishes,
// finish overrides, bomb urgency filtering, and selecting the legal options.
// This is the exact gentle policy scorer used by the bounded research run.
export function chooseStructureOption(
  hand,
  shapes,
  options,
  { hasTop = false, urgent = false, pilePoints = 0 } = {},
) {
  const masks = new Map(hand.map((card, index) => [card.id, 1 << index]));
  const maskOf = (cards) =>
    cards.reduce((mask, card) => mask | (masks.get(card.id) ?? 0), 0);
  const groups = shapes
    .filter((option) => option.cards.length > 1)
    .map((option) => ({
      mask: maskOf(option.cards),
      size: option.cards.length,
      power: option.play.power,
    }))
    .sort((a, b) => b.size - a.size || a.power - b.power);
  const all = (1 << hand.length) - 1;
  const remainder = (used) => {
    let rest = all ^ used;
    let turns = 0;
    for (const group of groups) {
      if ((rest & group.mask) === group.mask) {
        rest ^= group.mask;
        turns += 1 + Math.max(0, 12 - group.power) * 0.025;
      }
    }
    for (let index = 0; index < hand.length; index++) {
      if (rest & (1 << index))
        turns += 1 + Math.max(0, 12 - hand[index].rank) * 0.035;
    }
    return turns;
  };
  const bombMasks = shapes
    .filter((option) => option.play.bomb)
    .map((option) => maskOf(option.cards));
  const scored = options.map((option, index) => {
    const mask = maskOf(option.cards);
    const breaksBomb =
      !option.play.bomb &&
      bombMasks.some((bomb) => bomb & mask && (bomb & mask) !== bomb);
    let value =
      remainder(mask) * 15 + option.play.power * (urgent && hasTop ? -1 : 0.5);
    if (breaksBomb) value += 100;
    if (option.play.bomb) value += hasTop ? 35 : 20;
    if (hasTop && option.cards.some((card) => card.special === 'dragon'))
      value += Math.max(0, pilePoints) * 0.5;
    if (!hasTop && option.cards[0]?.special === 'dog') value -= 20;
    return { option, index, value };
  });
  scored.sort((a, b) => a.value - b.value || a.index - b.index);
  return scored[0]?.option;
}
