import { beats, classify } from '../../src/game.js';

// Research oracle only. It deliberately enumerates every non-empty subset;
// callers must not put this on the live Worker or browser action path.
const MAX_HAND = 18;
const phoenixRanks = Array.from({ length: 13 }, (_, i) => i + 2);

function validCard(card) {
  return (
    card &&
    typeof card.id === 'string' &&
    Number.isSafeInteger(card.rank) &&
    Number.isSafeInteger(card.suit) &&
    (card.special === undefined ||
      ['mahjong', 'dog', 'phoenix', 'dragon'].includes(card.special))
  );
}

function cardKey(card) {
  return card.special || `${card.rank}:${card.suit}`;
}

function playKey(cards, play) {
  return `${cards.map(cardKey).sort().join('|')}|${play.kind}|${play.power}|${play.size}|${play.bomb}|${play.phoenixRank ?? ''}`;
}

function wishAllows(cards, wish) {
  return (
    wish == null || cards.some((card) => !card.special && card.rank === wish)
  );
}

/**
 * Enumerate suit-aware legal card subsets from only one player's information.
 * Exact-copy swaps collapse by rank/suit/special multiplicity, while distinct
 * suits and multiplicities remain distinct (important for flush bombs).
 */
export function enumerateLegalCardSubsets({ hand, top = null, wish = null }) {
  if (
    !Array.isArray(hand) ||
    hand.length > MAX_HAND ||
    !hand.every(validCard) ||
    new Set(hand.map((card) => card.id)).size !== hand.length ||
    (wish != null && (!Number.isSafeInteger(wish) || wish < 2 || wish > 14))
  )
    return [];

  const result = [];
  const seen = new Set();
  const add = (subset, phoenixRank = null) => {
    if (!wishAllows(subset, wish)) return;
    const play = classify(subset, top, phoenixRank);
    if (!play || !beats(play, top)) return;
    const key = playKey(subset, play);
    if (seen.has(key)) return;
    seen.add(key);
    result.push({
      cards: subset.map((card) => ({ ...card })),
      play: { ...play },
    });
  };

  for (let mask = 1; mask < 2 ** hand.length; mask++) {
    const subset = [];
    for (let i = 0; i < hand.length; i++)
      if (mask & (1 << i)) subset.push(hand[i]);
    if (subset.some((card) => card.special === 'phoenix')) {
      for (const rank of phoenixRanks) add(subset, rank);
    } else add(subset);
  }
  return result;
}

export function canonicalActionKey(candidate) {
  return playKey(candidate.cards, candidate.play);
}
