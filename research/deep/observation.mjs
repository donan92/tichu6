import { deck, partners } from '../../src/game.js';

const RANKS = 13;
const SPECIALS = ['mahjong', 'dog', 'phoenix', 'dragon'];
const PUBLIC_ACTIONS = new Set(['play', 'pass', 'collect', 'grand', 'tichu']);
const PUBLIC_KINDS = new Set([
  'single',
  'pair',
  'triple',
  'fullhouse',
  'straight',
  'pairs',
  'bomb',
  'dog',
]);
const PUBLIC_HISTORY_KEYS = [
  'type',
  'seat',
  'call',
  'kind',
  'power',
  'size',
  'bomb',
  'count',
  'target',
  'wish',
  'phoenixRank',
];
const cardById = new Map(deck().map((card) => [card.id, card]));

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value))
    return Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function number(value, fallback = null) {
  return Number.isFinite(value) ? value : fallback;
}

function publicCard(card) {
  if (!card || typeof card !== 'object') return null;
  if (!Number.isFinite(card.rank) || !Number.isFinite(card.suit)) return null;
  return {
    rank: number(card.rank, 0),
    suit: number(card.suit, -1),
    ...(SPECIALS.includes(card.special) ? { special: card.special } : {}),
  };
}

function cards(values) {
  return (Array.isArray(values) ? values : []).map(publicCard).filter(Boolean);
}

function cardFromId(id) {
  return publicCard(cardById.get(id));
}

function handFeatures(hand) {
  const rankCounts = Array(RANKS).fill(0);
  const suitRankCounts = Array.from({ length: 4 }, () => Array(RANKS).fill(0));
  const specialCounts = Object.fromEntries(SPECIALS.map((name) => [name, 0]));
  for (const card of hand) {
    if (card?.special && SPECIALS.includes(card.special)) {
      specialCounts[card.special]++;
      continue;
    }
    const rank = card?.rank - 2;
    if (card?.suit >= 0 && card.suit < 4 && rank >= 0 && rank < RANKS) {
      rankCounts[rank]++;
      suitRankCounts[card.suit][rank]++;
    }
  }
  return { rankCounts, suitRankCounts, specialCounts };
}

function ownExchange(state, seat) {
  if (!['exchange', 'play', 'trick'].includes(state.phase))
    return { sent: [], received: [] };
  const sent = (state.exchanges?.[seat] || []).map(cardFromId).filter(Boolean);
  const received = partners(seat)
    .map((from) => {
      const index = partners(from).indexOf(seat);
      const id = state.exchanges?.[from]?.[index];
      return id && state.hands?.[seat]?.find((card) => card.id === id);
    })
    .map(publicCard)
    .filter(Boolean);
  return { sent, received };
}

function publicTop(top) {
  if (!top || typeof top !== 'object') return null;
  return {
    kind: typeof top.kind === 'string' ? top.kind : null,
    power: number(top.power),
    size: number(top.size),
    bomb: number(top.bomb),
    ...(Number.isFinite(top.phoenixRank)
      ? { phoenixRank: top.phoenixRank }
      : {}),
    cards: cards(top.cards),
  };
}

function publicHistory(history) {
  const normalized = (Array.isArray(history) ? history : [])
    .filter(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        typeof entry.type === 'string' &&
        PUBLIC_ACTIONS.has(entry.type),
    )
    .map((entry) => {
      const result = {};
      for (const key of PUBLIC_HISTORY_KEYS) {
        const value = entry[key];
        if (key === 'kind') {
          if (PUBLIC_KINDS.has(value)) result[key] = value;
        } else if (
          typeof value === 'boolean' ||
          Number.isFinite(value) ||
          (key === 'type' && PUBLIC_ACTIONS.has(value))
        )
          result[key] = value;
      }
      if (entry.type === 'play') result.cards = cards(entry.cards);
      return result;
    });
  return {
    moves: normalized.slice(-128),
    movesTruncated: normalized.length > 128,
  };
}

/** Return a deeply immutable, explicit public/private-seat observation. */
export function observe(state, seat, history = []) {
  if (!state || !Number.isInteger(seat) || seat < 0 || seat >= 6)
    throw new TypeError('Invalid observation seat');
  const allHand = Array.isArray(state.hands?.[seat]) ? state.hands[seat] : [];
  const visibleIds =
    state.phase === 'grand'
      ? new Set(Array.isArray(state.first?.[seat]) ? state.first[seat] : [])
      : null;
  const hand = visibleIds
    ? allHand.filter((card) => visibleIds.has(card.id))
    : allHand;
  const observation = {
    phase: typeof state.phase === 'string' ? state.phase : null,
    round: number(state.round, 0),
    revision: number(state.revision, 0),
    seat,
    hand: handFeatures(hand),
    exchange: ownExchange(state, seat),
    public: {
      counts: (Array.isArray(state.hands) ? state.hands : []).map((cards) =>
        Array.isArray(cards) ? cards.length : 0,
      ),
      calls: Array.isArray(state.calls) ? [...state.calls] : [],
      top: publicTop(state.top),
      ...publicHistory(history),
      pile: cards(state.pile),
      finish: Array.isArray(state.finish) ? [...state.finish] : [],
      scores: Array.isArray(state.scores) ? [...state.scores] : [],
      turn: number(state.turn),
      last: number(state.last),
      passed: Array.isArray(state.passed) ? [...state.passed] : [],
      capturedPoints: Array.isArray(state.captured)
        ? state.captured.map((cards) =>
            Array.isArray(cards)
              ? cards.reduce(
                  (total, card) =>
                    total +
                    (card?.special === 'dragon'
                      ? 25
                      : card?.special === 'phoenix'
                        ? -25
                        : card?.rank === 5
                          ? 5
                          : card?.rank === 10 || card?.rank === 13
                            ? 10
                            : 0),
                  0,
                )
              : 0,
          )
        : [],
    },
  };
  return freeze(observation);
}
