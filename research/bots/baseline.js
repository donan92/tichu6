// Frozen v0.8.5 strategy for reproducible comparisons.
import { legalPlays, partners, team, points } from '../../src/game.js';

// Strategy uses only our hand, received exchange cards and public table information.
function bombCards(hand, shapes) {
  const protectedIds = new Set();
  for (const { cards, play } of shapes) {
    if (!play.bomb) continue;
    for (const c of hand)
      if (
        cards.some(
          (b) => b.rank === c.rank && (play.bomb === 1 || b.suit === c.suit),
        )
      )
        protectedIds.add(c.id);
  }
  return protectedIds;
}
const supportValue = (c) =>
  c.special === 'phoenix'
    ? 100
    : !c.special && c.rank === 14
      ? 90
      : c.special === 'dragon'
        ? 80
        : c.special
          ? -1
          : c.rank;
function exchangeCards(s, seat, protectedIds) {
  const hand = s.hands[seat],
    counts = new Map();
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) || 0) + 1);
  const chosen = [];
  // Reserve the best card for a caller even when that partner is second in order.
  const recipients = partners(seat).map((to, index) => ({ to, index }));
  recipients.sort(
    (a, b) => Number(Boolean(s.calls[b.to])) - Number(Boolean(s.calls[a.to])),
  );
  for (const { to, index } of recipients) {
    const available = hand.filter((c) => !chosen.includes(c.id));
    available.sort((a, b) => {
      const protection =
        Number(protectedIds.has(a.id)) - Number(protectedIds.has(b.id));
      if (protection) return protection;
      if (s.calls[to]) return supportValue(b) - supportValue(a);
      return (
        Number(counts.get(a.rank) !== 1) - Number(counts.get(b.rank) !== 1) ||
        supportValue(a) - supportValue(b) ||
        a.id.localeCompare(b.id)
      );
    });
    chosen[index] = available[0].id;
  }
  return chosen;
}
function botWish(s, seat) {
  // Exchange IDs already persist privately; do not add private data to public state.
  for (const from of partners(seat)) {
    const id = s.exchanges?.[from]?.[partners(from).indexOf(seat)];
    const received = s.hands[seat].find((c) => c.id === id);
    if (received && !received.special) return received.rank;
  }
  return 14;
}
export function botAction(s, seat) {
  if (s.phase === 'grand') return { type: 'grand', call: false };
  if (s.phase === 'trick') return { type: 'collect', target: (seat + 1) % 6 };
  const hand = s.hands[seat],
    shapes = legalPlays(hand);
  const protectedIds = bombCards(hand, shapes);
  if (s.phase === 'exchange')
    return { type: 'exchange', ids: exchangeCards(s, seat, protectedIds) };
  const desired = s.wish ? legalPlays(hand, s.top, s.wish) : [];
  let options = desired.length
    ? desired
    : s.top
      ? legalPlays(hand, s.top)
      : shapes;
  if (!options.length) return { type: 'pass' };
  const finishing = options.find((o) => o.cards.length === hand.length);
  if (s.top && !desired.length && !finishing && team(s.last) === team(seat))
    return { type: 'pass' };
  const urgent = s.hands.some(
    (h, i) => team(i) !== team(seat) && h.length > 0 && h.length <= 2,
  );
  if (s.top && !desired.length && !finishing) {
    // Spend bombs to take valuable tricks or stop an opponent about to finish.
    options = options.filter(
      (o) => !o.play.bomb || urgent || points(s.pile) >= 10,
    );
    if (!options.length) return { type: 'pass' };
  }
  const made = new Set(
    shapes
      .filter((o) => o.cards.length > 1 && !o.play.bomb)
      .flatMap((o) => o.cards.map((c) => c.id)),
  );
  const score = (o) => {
    const { cards, play } = o;
    if (cards.length === hand.length) return -10000;
    let cost = play.power;
    if (!play.bomb && cards.some((c) => protectedIds.has(c.id))) cost += 2000;
    if (play.bomb) cost += s.top ? 500 : 4000;
    if (cards.length > 1 && cards.some((c) => c.rank === 14 && !c.special))
      cost += 150;
    if (!s.top) {
      if (cards.length > 1) cost += 60 - cards.length;
      else if (made.has(cards[0].id)) cost += 80;
      if (cards[0].special === 'phoenix' || cards[0].special === 'dragon')
        cost += 100;
    }
    // Keep scoring cards until they have a reasonable chance of capturing a trick.
    if (!s.top || play.power < 13) cost += Math.max(0, points(cards)) * 2;
    if (s.top && !play.bomb && points(s.pile) >= 10 && play.power < 13)
      cost += Math.min(40, points(s.pile) * 2);
    // Dragon gives the pile away; prefer an ace/phoenix on a valuable pile.
    if (cards.some((c) => c.special === 'dragon'))
      cost += Math.max(0, points(s.pile));
    return cost;
  };
  options.sort((a, b) => score(a) - score(b));
  const o = finishing || options[0];
  return {
    type: 'play',
    ids: o.cards.map((c) => c.id),
    target:
      partners(seat).find((i) => s.calls[i] && s.hands[i].length) ??
      partners(seat)[0],
    wish: botWish(s, seat),
  };
}
