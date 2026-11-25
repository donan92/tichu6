import { AppError, event } from './messages.js';
import { chooseStructureOption } from './bot-structure.js';
export const BOT_POLICY_VERSION = 'structure-gentle-v1';
// The rules engine has no DOM or networking dependencies.
export const LABEL = { 1: '1', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const team = (seat) => seat % 2;
export const partners = (seat) => [(seat + 2) % 6, (seat + 4) % 6];
export function deck() {
  const cards = [];
  for (let copy = 0; copy < 2; copy++)
    for (let suit = 0; suit < 4; suit++)
      for (let rank = 2; rank <= 14; rank++)
        cards.push({ id: `${copy}-${suit}-${rank}`, rank, suit });
  for (const [special, rank] of [
    ['mahjong', 1],
    ['dog', 0],
    ['phoenix', 15],
    ['dragon', 16],
  ])
    cards.push({ id: special, special, rank, suit: -1 });
  return cards;
}
export function shuffle(cards) {
  const a = [...cards],
    n = new Uint32Array(1);
  for (let i = a.length - 1; i > 0; i--) {
    const bound = Math.floor(4294967296 / (i + 1)) * (i + 1);
    do {
      globalThis.crypto.getRandomValues(n);
    } while (n[0] >= bound);
    const j = n[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const sortCards = (cards) =>
  [...cards].sort(
    (a, b) => a.rank - b.rank || a.suit - b.suit || a.id.localeCompare(b.id),
  );
export const points = (cards) =>
  cards.reduce(
    (p, c) =>
      p +
      (c.special === 'dragon'
        ? 25
        : c.special === 'phoenix'
          ? -25
          : c.rank === 5
            ? 5
            : c.rank === 10 || c.rank === 13
              ? 10
              : 0),
    0,
  );
const consecutive = (a) => a.every((v, i) => i === 0 || v === a[i - 1] + 1);
function ordinary(cards, ranks, wild) {
  const count = new Map();
  ranks.forEach((r) => count.set(r, (count.get(r) || 0) + 1));
  const keys = [...count.keys()].sort((a, b) => a - b),
    groups = [...count.values()],
    n = ranks.length;
  if (n === 4 && keys.length === 1 && keys[0] >= 2 && !wild)
    return { kind: 'bomb', power: keys[0], size: n, bomb: 1 };
  if (n >= 5 && keys.length === n && consecutive(keys)) {
    const bomb =
      !wild && cards.every((c) => !c.special && c.suit === cards[0].suit);
    return {
      kind: bomb ? 'bomb' : 'straight',
      power: keys.at(-1),
      size: n,
      bomb: bomb ? 2 : 0,
    };
  }
  if (keys[0] < 2) return null;
  if (n === 2 && keys.length === 1)
    return { kind: 'pair', power: keys[0], size: n, bomb: 0 };
  if (n === 3 && keys.length === 1)
    return { kind: 'triple', power: keys[0], size: n, bomb: 0 };
  if (n === 5 && keys.length === 2 && groups.includes(3) && groups.includes(2))
    return {
      kind: 'fullhouse',
      power: keys.find((k) => count.get(k) === 3),
      size: n,
      bomb: 0,
    };
  if (
    n >= 4 &&
    n % 2 === 0 &&
    groups.every((v) => v === 2) &&
    consecutive(keys)
  )
    return { kind: 'pairs', power: keys.at(-1), size: n, bomb: 0 };
  return null;
}
export function beats(play, top) {
  if (!play) return false;
  if (!top) return true;
  if (play.bomb) {
    if (!top.bomb) return true;
    return (
      play.bomb > top.bomb ||
      (play.bomb === top.bomb &&
        (play.size > top.size ||
          (play.size === top.size && play.power > top.power)))
    );
  }
  return (
    !top.bomb &&
    play.kind === top.kind &&
    play.size === top.size &&
    play.power > top.power
  );
}
export function classify(cards, top = null, phoenixRank = null) {
  if (!cards.length || new Set(cards.map((c) => c.id)).size !== cards.length)
    return null;
  if (cards.length === 1) {
    const c = cards[0];
    if (c.special === 'dog')
      return top ? null : { kind: 'dog', power: 0, size: 1, bomb: 0 };
    return {
      kind: 'single',
      power:
        c.special === 'phoenix'
          ? top?.kind === 'single'
            ? Math.min(top.power + 0.5, 15)
            : 1.5
          : c.rank,
      size: 1,
      bomb: 0,
    };
  }
  if (cards.some((c) => c.special === 'dragon' || c.special === 'dog'))
    return null;
  const wild = cards.some((c) => c.special === 'phoenix'),
    ranks = cards.filter((c) => c.special !== 'phoenix').map((c) => c.rank);
  if (!wild) return ordinary(cards, ranks, false);
  const options = (
    phoenixRank ? [phoenixRank] : Array.from({ length: 13 }, (_, i) => i + 2)
  )
    .filter((r) => Number.isInteger(r) && r >= 2 && r <= 14)
    .map((r) => {
      const p = ordinary(cards, [...ranks, r], true);
      return p ? { ...p, phoenixRank: r } : null;
    })
    .filter((p) => p && beats(p, top));
  return options.sort((a, b) => b.power - a.power)[0] || null;
}
// Generate representative legal shapes, not all 2^18 physical subsets.
// A rank with duplicate suits only needs one representative except for flush bombs.
export function legalPlays(hand, top = null, wish = null) {
  const result = [],
    seen = new Set(),
    pools = new Map(),
    phoenix = hand.find((c) => c.special === 'phoenix');
  for (const c of hand.filter((c) => !c.special || c.special === 'mahjong')) {
    if (!pools.has(c.rank)) pools.set(c.rank, []);
    pools.get(c.rank).push(c);
  }
  const add = (cards) => {
    if (wish && !cards.some((c) => !c.special && c.rank === wish)) return;
    const p = classify(cards, top);
    if (!p || !beats(p, top)) return;
    const key = cards
      .map((c) => c.id)
      .sort()
      .join('|');
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ cards, play: p });
    }
  };
  hand.forEach((c) => add([c]));
  const shape = (needs) => {
    let cards = [],
      missing = 0;
    for (const [r, n] of needs) {
      const p = pools.get(r) || [];
      cards.push(...p.slice(0, n));
      missing += Math.max(0, n - p.length);
    }
    if (missing === 0) add(cards);
    else if (missing === 1 && phoenix && !needs.some(([r]) => r === 1))
      add([...cards, phoenix]);
  };
  for (let r = 2; r <= 14; r++) {
    for (const n of [2, 3, 4]) shape([[r, n]]);
    for (let s = 2; s <= 14; s++)
      if (s !== r)
        shape([
          [r, 3],
          [s, 2],
        ]);
  }
  for (let lo = 1; lo <= 14; lo++)
    for (let hi = lo + 4; hi <= 14; hi++) {
      const ranks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      // Mahjong must be real; phoenix can replace another rank in a 1-low straight.
      let cards = [],
        missing = [];
      for (const r of ranks) {
        const c = pools.get(r)?.[0];
        if (c) cards.push(c);
        else missing.push(r);
      }
      if (!missing.length) add(cards);
      else if (missing.length === 1 && missing[0] !== 1 && phoenix)
        add([...cards, phoenix]);
      for (let suit = 0; suit < 4; suit++) {
        const same = ranks.map((r) =>
          hand.find((c) => !c.special && c.rank === r && c.suit === suit),
        );
        if (same.every(Boolean)) add(same);
      }
    }
  for (let lo = 2; lo <= 13; lo++)
    for (let hi = lo + 1; hi <= 14; hi++)
      shape(Array.from({ length: hi - lo + 1 }, (_, i) => [lo + i, 2]));
  return result;
}
export function newGame(
  names = ['Player1', 'Player2', 'Player3', 'Player4', 'Player5', 'Player6'],
) {
  return {
    names: names.map((n) => String(n).slice(0, 20)),
    phase: 'lobby',
    round: 0,
    scores: [0, 0],
    revision: 0,
    log: [],
    hands: Array.from({ length: 6 }, () => []),
  };
}
const fail = (code, params) => {
  throw new AppError(code, params);
};
const log = (s, message) => {
  s.log.push(message);
  s.log = s.log.slice(-1024);
};
const nextActive = (s, seat) => {
  for (let i = 1; i <= 6; i++) {
    const n = (seat + i) % 6;
    if (s.hands[n].length) return n;
  }
  return seat;
};
export function startRound(s, cards = shuffle(deck())) {
  if (!['lobby', 'roundEnd'].includes(s.phase)) fail('error.roundStart');
  s.round++;
  s.log = [];
  s.trickNumber = 1;
  s.trickHistory ||= [];
  s.callResults = [];
  s.dragonTarget = null;
  s.deadline = null;
  s.deadlineKey = null;
  s.phase = 'grand';
  s.hands = Array.from({ length: 6 }, (_, i) =>
    sortCards(cards.slice(i * 18, i * 18 + 18)),
  );
  // Preserve the actual first ten dealt cards separately from sorted hands.
  s.first = Array.from({ length: 6 }, (_, i) =>
    cards.slice(i * 18, i * 18 + 10).map((c) => c.id),
  );
  s.ready = Array(6).fill(false);
  s.calls = Array(6).fill(0);
  s.played = Array(6).fill(false);
  s.exchanges = Array(6).fill(null);
  s.exchangeReviewClosed = false;
  s.captured = Array.from({ length: 6 }, () => []);
  s.finish = [];
  s.top = null;
  s.pile = [];
  s.passed = [];
  s.wish = null;
  s.turn = null;
  s.last = null;
  s.delta = null;
  log(s, event('log.roundStart', { round: s.round }));
  s.revision++;
  return s;
}
function finishRound(s) {
  const delta = [0, 0];
  const triple =
    s.finish.length >= 3 &&
    s.finish.slice(0, 3).every((i) => team(i) === team(s.finish[0]));
  if (triple) delta[team(s.finish[0])] = 300;
  else {
    const loser = s.hands.findIndex((h) => h.length);
    if (loser >= 0) {
      s.captured[s.finish[0]].push(...s.captured[loser]);
      s.captured[loser] = [];
      delta[1 - team(loser)] += points(s.hands[loser]);
    }
    s.captured.forEach((p, i) => (delta[team(i)] += points(p)));
  }
  // Each caller must personally finish first, even on a team triple victory.
  s.callResults = s.calls.flatMap((call, seat) =>
    call
      ? [
          {
            seat,
            call,
            success: seat === s.finish[0],
            delta: seat === s.finish[0] ? call : -call,
          },
        ]
      : [],
  );
  for (const result of s.callResults) {
    delta[team(result.seat)] += result.delta;
    log(
      s,
      event('log.callResult', {
        name: s.names[result.seat],
        call: result.call,
        delta: result.delta,
      }),
    );
  }
  s.delta = delta;
  s.scores = s.scores.map((n, i) => n + delta[i]);
  s.phase =
    Math.max(...s.scores) >= 1000 && s.scores[0] !== s.scores[1]
      ? 'matchEnd'
      : 'roundEnd';
  log(
    s,
    event(triple ? 'log.tripleEnd' : 'log.roundEnd', {
      a: delta[0],
      b: delta[1],
    }),
  );
}
function ending(s) {
  return (
    s.finish.length >= 5 ||
    (s.finish.length >= 3 &&
      s.finish.slice(0, 3).every((i) => team(i) === team(s.finish[0])))
  );
}
function archiveTrick(s) {
  s.trickHistory ||= [];
  s.trickNumber ||= 1;
  if (
    !s.trickHistory.some(
      (t) => t.round === s.round && t.trick === s.trickNumber,
    )
  )
    s.trickHistory.push({
      round: s.round,
      trick: s.trickNumber,
      entries: structuredClone(s.log),
    });
}
function nextTrick(s) {
  archiveTrick(s);
  s.trickNumber = (s.trickNumber || 1) + 1;
  s.log = [];
}
export function visibleLog(s) {
  return s.phase === 'lobby' || s.trickNumber ? s.log : [];
}
export function visibleHistory(s) {
  return s.phase === 'matchEnd' ? s.trickHistory || [] : [];
}
function collect(s, recipient) {
  s.exchangeReviewClosed = true;
  s.captured[recipient].push(...s.pile);
  s.pile = [];
  log(s, event('log.collect', { name: s.names[recipient] }));
  if (ending(s)) {
    finishRound(s);
    return;
  }
  s.turn = s.hands[s.last].length ? s.last : nextActive(s, s.last);
  s.top = null;
  s.passed = [];
  s.phase = 'play';
  nextTrick(s);
}
// All mutations are validated on a clone: invalid actions are atomic.
export function act(state, seat, action) {
  if (
    !Number.isInteger(seat) ||
    seat < 0 ||
    seat > 5 ||
    !action ||
    typeof action.type !== 'string'
  )
    fail('error.invalidRequest');
  const s = structuredClone(state),
    h = s.hands[seat];
  if (!s.trickNumber) {
    s.trickNumber = 1;
    s.log = [];
  }
  if (action.type === 'grand') {
    if (
      s.phase !== 'grand' ||
      s.ready[seat] ||
      typeof action.call !== 'boolean'
    )
      fail('error.grandPhase');
    s.ready[seat] = true;
    s.calls[seat] = action.call ? 200 : 0;
    if (action.call) log(s, event('log.grand', { name: s.names[seat] }));
    if (s.ready.every(Boolean)) {
      s.phase = 'exchange';
      log(s, event('log.exchange'));
    }
  } else if (action.type === 'exchange') {
    if (s.phase !== 'exchange') fail('error.exchangePhase');
    if (
      !Array.isArray(action.ids) ||
      action.ids.length !== 2 ||
      new Set(action.ids).size !== 2 ||
      !action.ids.every((id) => h.some((c) => c.id === id))
    )
      fail('error.twoCards');
    s.exchanges[seat] = action.ids;
    if (s.exchanges.every(Boolean)) {
      const transfers = [];
      s.exchanges.forEach((ids, i) =>
        ids.forEach((id, j) =>
          transfers.push({
            from: i,
            to: partners(i)[j],
            card: s.hands[i].find((c) => c.id === id),
          }),
        ),
      );
      transfers.forEach(
        ({ from, card }) =>
          (s.hands[from] = s.hands[from].filter((c) => c.id !== card.id)),
      );
      transfers.forEach(({ to, card }) => s.hands[to].push(card));
      s.hands = s.hands.map(sortCards);
      s.phase = 'play';
      s.turn = s.hands.findIndex((hand) =>
        hand.some((c) => c.special === 'mahjong'),
      );
      log(s, event('log.lead', { name: s.names[s.turn] }));
    }
  } else if (action.type === 'tichu') {
    if (
      !['exchange', 'play', 'trick'].includes(s.phase) ||
      s.calls[seat] ||
      s.played[seat]
    )
      fail('error.tichuPhase');
    s.calls[seat] = 100;
    log(s, event('log.tichu', { name: s.names[seat] }));
  } else if (action.type === 'play') {
    if (!['play', 'trick'].includes(s.phase) || !h.length)
      fail('error.playPhase');
    if (
      !Array.isArray(action.ids) ||
      !action.ids.length ||
      new Set(action.ids).size !== action.ids.length
    )
      fail('error.selectCards');
    const owned = action.ids.map((id) => h.find((c) => c.id === id));
    if (owned.some((c) => !c)) fail('error.ownership');
    const cards = sortCards(owned);
    const p = classify(cards, s.top, action.phoenixRank || null);
    if (!p || !beats(p, s.top)) fail('error.combination');
    const inTurn = s.phase === 'play' && s.turn === seat;
    if (!inTurn && (!p.bomb || !s.top)) fail('error.outOfTurn');
    if (
      inTurn &&
      s.wish &&
      !cards.some((c) => !c.special && c.rank === s.wish) &&
      legalPlays(h, s.top, s.wish).length
    )
      fail('error.fulfillWish', { rank: LABEL[s.wish] || s.wish });
    if (
      cards.some((c) => c.special === 'mahjong') &&
      action.wish != null &&
      (!Number.isInteger(action.wish) || action.wish < 2 || action.wish > 14)
    )
      fail('error.wishRange');
    if (p.kind === 'dog' && !partners(seat).includes(action.target))
      fail('error.dogTarget');
    s.hands[seat] = h.filter((c) => !action.ids.includes(c.id));
    s.played[seat] = true;
    if (!s.hands[seat].length) {
      s.finish.push(seat);
      log(
        s,
        event('log.finish', { name: s.names[seat], place: s.finish.length }),
      );
    }
    if (cards.some((c) => c.special === 'mahjong'))
      s.wish = action.wish ?? null;
    if (cards.some((c) => !c.special && c.rank === s.wish)) s.wish = null;
    if (p.kind === 'dog') {
      s.captured[seat].push(...cards);
      s.turn = s.hands[action.target].length
        ? action.target
        : nextActive(s, action.target);
      log(
        s,
        event('log.dog', { name: s.names[seat], target: s.names[s.turn] }),
      );
      if (ending(s)) finishRound(s);
      else nextTrick(s);
    } else {
      s.top = { ...p, cards };
      s.pile.push(...cards);
      s.last = seat;
      s.dragonTarget = null;
      s.passed = [];
      s.turn = nextActive(s, seat);
      s.phase = 'play';
      log(
        s,
        event('log.play', {
          name: s.names[seat],
          kind: p.kind,
          power: p.power,
          size: p.size,
          bomb: p.bomb,
          ...(cards.length === 1 && cards[0].special
            ? { special: cards[0].special }
            : {}),
          count: cards.length,
        }),
      );
      if (ending(s)) {
        if (
          s.finish.slice(0, 3).length === 3 &&
          s.finish.slice(0, 3).every((i) => team(i) === team(s.finish[0]))
        )
          finishRound(s);
        else s.phase = 'trick';
      }
    }
  } else if (action.type === 'pass') {
    if (s.phase !== 'play' || s.turn !== seat || !s.top) fail('error.leadPass');
    if (s.wish && legalPlays(h, s.top, s.wish).length) fail('error.wishPass');
    if (!s.passed.includes(seat)) s.passed.push(seat);
    log(s, event('log.pass', { name: s.names[seat] }));
    const other = s.hands
      .map((hand, i) => (hand.length && i !== s.last ? i : -1))
      .filter((i) => i >= 0);
    if (other.every((i) => s.passed.includes(i))) {
      s.phase = 'trick';
      s.turn = s.last;
    } else s.turn = nextActive(s, seat);
  } else if (action.type === 'dragonTarget') {
    if (
      s.phase !== 'trick' ||
      seat !== s.last ||
      s.top?.cards[0]?.special !== 'dragon' ||
      !Number.isInteger(action.target) ||
      action.target < 0 ||
      action.target > 5 ||
      team(action.target) === team(seat)
    )
      fail('error.dragonTarget');
    s.dragonTarget = action.target;
  } else if (action.type === 'collect') {
    if (s.phase !== 'trick' || seat !== s.last) fail('error.collector');
    const dragon =
      s.top.cards.length === 1 && s.top.cards[0].special === 'dragon';
    if (
      dragon &&
      (!Number.isInteger(action.target) ||
        action.target < 0 ||
        action.target > 5 ||
        team(action.target) === team(seat))
    )
      fail('error.dragonTarget');
    collect(s, dragon ? action.target : seat);
  } else fail('error.unknownRequest');
  if (['roundEnd', 'matchEnd'].includes(s.phase)) archiveTrick(s);
  s.revision++;
  return s;
}
export function exchangeReview(s, seat) {
  if (
    seat < 0 ||
    seat > 5 ||
    s.played?.[seat] ||
    s.exchangeReviewClosed ||
    !['exchange', 'play', 'trick'].includes(s.phase) ||
    s.captured?.some((cards) => cards.length)
  )
    return [];
  const cards = deck();
  const complete = s.exchanges?.every(Boolean);
  return partners(seat)
    .map((partner, index) => {
      const sent = cards.find((c) => c.id === s.exchanges?.[seat]?.[index]);
      const received = complete
        ? cards.find(
            (c) =>
              c.id ===
              s.exchanges?.[partner]?.[partners(partner).indexOf(seat)],
          )
        : undefined;
      return {
        partner,
        ...(sent ? { sent } : {}),
        ...(received ? { received } : {}),
      };
    })
    .filter((entry) => entry.sent || entry.received);
}
export function view(s, seat) {
  const {
    hands,
    first,
    exchanges,
    captured,
    exchangeReviewClosed,
    trickHistory,
    deadlineKey,
    ...pub
  } = s;
  void trickHistory;
  void deadlineKey;
  void exchangeReviewClosed;
  const hand =
    s.phase === 'grand'
      ? hands[seat].filter((c) => first[seat].includes(c.id))
      : hands[seat];
  return {
    ...pub,
    trickHistory: visibleHistory(s),
    log: visibleLog(s),
    seat,
    hand,
    counts: hands.map((h) => h.length),
    exchangeReady: (exchanges || []).map(Boolean),
    capturedPoints: (captured || []).map(points),
    exchangeReview: exchangeReview(s, seat),
  };
}
export function kindName(kind) {
  return 'kind.' + kind;
}
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
  const o =
    finishing ||
    chooseStructureOption(hand, shapes, options, {
      hasTop: !!s.top,
      urgent,
      pilePoints: points(s.pile),
    });
  return {
    type: 'play',
    ids: o.cards.map((c) => c.id),
    target:
      partners(seat).find((i) => s.calls[i] && s.hands[i].length) ??
      partners(seat)[0],
    wish: botWish(s, seat),
  };
}
