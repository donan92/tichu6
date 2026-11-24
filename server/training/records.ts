import type { Card, GameAction, RoundState } from '../../src/types.ts';
import { deck, points } from '../../src/game.js';

export const TRAINING_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const TRAINING_MAX_EVENTS_PER_SESSION = 2000;
export const TRAINING_MAX_SESSIONS = 100;
export const TRAINING_MAX_BYTES = 80 * 1024;

export type TrainingSource = 'human' | 'bot';

export interface TrainingCard {
  id: string;
  rank: number;
  suit: number;
  special?: Card['special'];
}

export interface TrainingPublicState {
  phase: RoundState['phase'];
  round: number;
  revision: number;
  scores: number[];
  counts: number[];
  ready: boolean[];
  calls: number[];
  played: boolean[];
  finish: number[];
  top: TrainingTop | null;
  turn: number | null;
  last: number | null;
  passed: number[];
  wish: number | null;
  delta: number[] | null;
  capturedPoints: number[];
}

export interface TrainingTop {
  kind: string;
  power: number;
  size: number;
  bomb: number;
  phoenixRank?: number;
  cards: TrainingCard[];
}

export type TrainingAction =
  | { type: 'grand'; call: boolean }
  | { type: 'exchange'; ids: string[] }
  | { type: 'tichu' | 'pass' }
  | { type: 'collect'; target: number | null }
  | {
      type: 'play';
      ids: string[];
      target: number | null;
      wish: number | null;
      phoenixRank: number | null;
    };

export interface TrainingDecision {
  recordId: string;
  source: TrainingSource;
  policyVersion: string;
  round: number;
  revision: number;
  seat: number;
  ownHand: TrainingCard[];
  publicState: TrainingPublicState;
  action: TrainingAction;
}

export interface TrainingOutcome {
  scores: number[];
  delta: number[] | null;
  finish: number[];
  winner: 0 | 1 | null;
}

export interface TrainingSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  events: TrainingDecision[];
  outcome?: TrainingOutcome;
  truncated?: boolean;
  groupId?: string | null;
}

export interface TrainingArchive {
  sessions: TrainingSession[];
}

export interface TrainingExport {
  schema: 2;
  sessions: Array<{
    id: string;
    groupId: string | null;
    events: TrainingDecision[];
    outcome: TrainingOutcome;
    truncated: boolean;
  }>;
}

const id = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((v) => v.toString(16).padStart(2, '0')).join('');
};

const card = (value: Card): TrainingCard => ({
  id: value.id,
  rank: value.rank,
  suit: value.suit,
  ...(value.special ? { special: value.special } : {}),
});

const cards = (value: Card[] | undefined) => (value || []).map(card);
const knownCards = new Map(deck().map((value) => [value.id, value]));

function top(value: RoundState['top']): TrainingTop | null {
  if (!value) return null;
  return {
    kind: value.kind,
    power: value.power,
    size: value.size,
    bomb: value.bomb,
    ...(value.phoenixRank == null ? {} : { phoenixRank: value.phoenixRank }),
    cards: cards(value.cards),
  };
}

function publicState(s: RoundState): TrainingPublicState {
  return {
    phase: s.phase,
    round: s.round,
    revision: s.revision,
    scores: [...s.scores],
    counts: s.hands.map((h) => h.length),
    ready: [...s.ready],
    calls: [...s.calls],
    played: [...s.played],
    finish: [...s.finish],
    top: top(s.top),
    turn: s.turn,
    last: s.last,
    passed: [...s.passed],
    wish: s.wish,
    delta: s.delta ? [...s.delta] : null,
    capturedPoints: s.captured.map(points),
  };
}

function action(value: GameAction, ownHand: Card[]): TrainingAction | null {
  const own = new Set(ownHand.map((c) => c.id));
  if (value.type === 'grand') return { type: 'grand', call: value.call };
  if (value.type === 'tichu' || value.type === 'pass')
    return { type: value.type };
  if (value.type === 'exchange') {
    if (
      value.ids.length !== 2 ||
      new Set(value.ids).size !== value.ids.length ||
      value.ids.some((x) => !own.has(x))
    )
      return null;
    return { type: 'exchange', ids: [...value.ids] };
  }
  if (value.type === 'collect')
    return { type: 'collect', target: value.target ?? null };
  if (value.type === 'play') {
    if (
      !value.ids.length ||
      new Set(value.ids).size !== value.ids.length ||
      value.ids.some((x) => !own.has(x))
    )
      return null;
    return {
      type: 'play',
      ids: [...value.ids],
      target: value.target ?? null,
      wish: value.wish ?? null,
      phoenixRank: value.phoenixRank ?? null,
    };
  }
  return null;
}

/** Build an accepted-action example from the pre-action authoritative state. */
export function prepareTrainingDecision(
  state: RoundState,
  seat: number,
  value: GameAction,
  source: TrainingSource,
  policyVersion = source === 'bot' ? 'bot-unknown' : 'human',
): TrainingDecision | null {
  if (
    (source !== 'human' && source !== 'bot') ||
    !Number.isInteger(seat) ||
    seat < 0 ||
    seat >= 6
  )
    return null;
  const safeAction = action(value, state.hands[seat]);
  if (!safeAction) return null;
  if (state.phase === 'grand' && !Array.isArray(state.first?.[seat]))
    return null;
  const ownHand =
    state.phase === 'grand'
      ? state.first[seat]
          .map((cardId) => state.hands[seat].find((c) => c.id === cardId))
          .filter((value): value is Card => !!value)
      : state.hands[seat];
  if (state.phase === 'grand' && ownHand.length !== 10) return null;
  return {
    recordId: id(),
    source,
    policyVersion: String(policyVersion).slice(0, 64),
    round: state.round,
    revision: state.revision,
    seat,
    ownHand: cards(ownHand),
    publicState: publicState(state),
    action: safeAction,
  };
}

export function createTrainingArchive(): TrainingArchive {
  return { sessions: [] };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const finiteInt = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value);
const finiteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value);
const validGroupId = (value: unknown) =>
  typeof value === 'string' && value.length > 0 && value.length <= 128;
const sixNumbers = (value: unknown) =>
  Array.isArray(value) && value.length === 6 && value.every(Number.isFinite);
const twoNumbers = (value: unknown) =>
  Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const sixBooleans = (value: unknown) =>
  Array.isArray(value) &&
  value.length === 6 &&
  value.every((v) => typeof v === 'boolean');
const phases = new Set([
  'grand',
  'exchange',
  'play',
  'trick',
  'roundEnd',
  'matchEnd',
]);
const topKinds = new Set([
  'single',
  'pair',
  'triple',
  'fullhouse',
  'straight',
  'pairs',
  'bomb',
  'dog',
]);
const validSeatList = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (seat) => finiteInt(seat) && (seat as number) >= 0 && (seat as number) < 6,
  ) &&
  new Set(value).size === value.length;

function parseTrainingCard(value: unknown): TrainingCard | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length > 32)
    return null;
  if (!finiteInt(value.rank) || !finiteInt(value.suit)) return null;
  if (
    value.special !== undefined &&
    !['mahjong', 'dog', 'phoenix', 'dragon'].includes(String(value.special))
  )
    return null;
  const known = knownCards.get(value.id);
  if (
    !known ||
    known.rank !== value.rank ||
    known.suit !== value.suit ||
    (known.special || undefined) !== (value.special || undefined)
  )
    return null;
  return {
    id: value.id,
    rank: value.rank as number,
    suit: value.suit as number,
    ...(value.special ? { special: value.special as Card['special'] } : {}),
  };
}

function parseAction(
  value: unknown,
  ownHand: TrainingCard[],
): TrainingAction | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  const own = new Set(ownHand.map((card) => card.id));
  if (value.type === 'grand' && typeof value.call === 'boolean')
    return { type: 'grand', call: value.call };
  if (value.type === 'pass' || value.type === 'tichu')
    return { type: value.type };
  if (
    value.type === 'exchange' &&
    Array.isArray(value.ids) &&
    value.ids.length === 2 &&
    value.ids.every((v) => typeof v === 'string') &&
    new Set(value.ids).size === value.ids.length &&
    value.ids.every((v) => own.has(v))
  )
    return {
      type: 'exchange',
      ids: [...value.ids] as string[],
    };
  if (
    value.type === 'collect' &&
    (value.target === null ||
      (finiteInt(value.target) &&
        (value.target as number) >= 0 &&
        (value.target as number) < 6))
  )
    return { type: 'collect', target: value.target as number | null };
  if (
    value.type === 'play' &&
    Array.isArray(value.ids) &&
    value.ids.length > 0 &&
    value.ids.length <= 18 &&
    value.ids.every((v) => typeof v === 'string') &&
    new Set(value.ids).size === value.ids.length &&
    value.ids.every((v) => own.has(v)) &&
    (value.target === null ||
      (finiteInt(value.target) &&
        (value.target as number) >= 0 &&
        (value.target as number) < 6)) &&
    (value.wish === null ||
      (finiteInt(value.wish) &&
        (value.wish as number) >= 2 &&
        (value.wish as number) <= 14)) &&
    (value.phoenixRank === null ||
      (finiteInt(value.phoenixRank) &&
        (value.phoenixRank as number) >= 2 &&
        (value.phoenixRank as number) <= 14))
  )
    return {
      type: 'play',
      ids: [...value.ids] as string[],
      target: value.target as number | null,
      wish: value.wish as number | null,
      phoenixRank: value.phoenixRank as number | null,
    };
  return null;
}

function parseTop(value: unknown): TrainingTop | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    typeof value.kind !== 'string' ||
    !topKinds.has(value.kind) ||
    !finiteNumber(value.power) ||
    !finiteInt(value.size) ||
    !finiteInt(value.bomb) ||
    !Array.isArray(value.cards) ||
    value.cards.length === 0 ||
    value.cards.length > 18 ||
    (value.phoenixRank !== undefined &&
      (!finiteInt(value.phoenixRank) ||
        (value.phoenixRank as number) < 2 ||
        (value.phoenixRank as number) > 14))
  )
    return null;
  const cardsValue = value.cards.map(parseTrainingCard);
  if (
    cardsValue.some((v) => !v) ||
    new Set(cardsValue.map((v) => v!.id)).size !== cardsValue.length
  )
    return null;
  return {
    kind: value.kind,
    power: value.power as number,
    size: value.size as number,
    bomb: value.bomb as number,
    ...(value.phoenixRank === undefined
      ? {}
      : { phoenixRank: value.phoenixRank as number }),
    cards: cardsValue as TrainingCard[],
  };
}

export function parseTrainingDecision(value: unknown): TrainingDecision | null {
  if (
    !isRecord(value) ||
    typeof value.recordId !== 'string' ||
    value.recordId.length > 128 ||
    !['human', 'bot'].includes(String(value.source)) ||
    typeof value.policyVersion !== 'string' ||
    value.policyVersion.length > 64 ||
    !finiteInt(value.round) ||
    !finiteInt(value.revision) ||
    !finiteInt(value.seat) ||
    (value.seat as number) < 0 ||
    (value.seat as number) > 5 ||
    !Array.isArray(value.ownHand) ||
    value.ownHand.length > 18 ||
    !isRecord(value.publicState)
  )
    return null;
  const ownHand = value.ownHand.map(parseTrainingCard);
  if (ownHand.some((v) => !v)) return null;
  if (new Set(ownHand.map((card) => card!.id)).size !== ownHand.length)
    return null;
  const p = value.publicState;
  if (
    typeof p.phase !== 'string' ||
    !phases.has(p.phase) ||
    !finiteInt(p.round) ||
    !finiteInt(p.revision) ||
    !twoNumbers(p.scores) ||
    !sixNumbers(p.counts) ||
    !sixBooleans(p.ready) ||
    !sixNumbers(p.calls) ||
    !sixBooleans(p.played) ||
    !validSeatList(p.finish) ||
    !validSeatList(p.passed) ||
    !sixNumbers(p.capturedPoints) ||
    !(p.top === null || parseTop(p.top)) ||
    !(p.turn === null || finiteInt(p.turn)) ||
    !(p.last === null || finiteInt(p.last)) ||
    !(p.wish === null || finiteInt(p.wish)) ||
    !(p.delta === null || twoNumbers(p.delta)) ||
    p.round !== value.round ||
    p.revision !== value.revision ||
    (p.phase === 'grand' && ownHand.length !== 10)
  )
    return null;
  const act = parseAction(value.action, ownHand as TrainingCard[]);
  if (!act) return null;
  return {
    recordId: value.recordId,
    source: value.source as TrainingSource,
    policyVersion: value.policyVersion,
    round: value.round as number,
    revision: value.revision as number,
    seat: value.seat as number,
    ownHand: ownHand as TrainingCard[],
    publicState: {
      phase: p.phase as TrainingPublicState['phase'],
      round: p.round as number,
      revision: p.revision as number,
      scores: [...(p.scores as number[])],
      counts: [...(p.counts as number[])],
      ready: [...(p.ready as boolean[])],
      calls: [...(p.calls as number[])],
      played: [...(p.played as boolean[])],
      finish: [...(p.finish as number[])],
      top: parseTop(p.top),
      turn: p.turn as number | null,
      last: p.last as number | null,
      passed: [...(p.passed as number[])],
      wish: p.wish as number | null,
      delta: p.delta === null ? null : [...(p.delta as number[])],
      capturedPoints: [...(p.capturedPoints as number[])],
    },
    action: act,
  };
}

export function parseTrainingOutcome(value: unknown): TrainingOutcome | null {
  if (
    !isRecord(value) ||
    !twoNumbers(value.scores) ||
    !(value.delta === null || twoNumbers(value.delta)) ||
    !validSeatList(value.finish) ||
    !(value.winner === null || value.winner === 0 || value.winner === 1)
  )
    return null;
  const scores = value.scores as number[];
  const delta = value.delta === null ? null : (value.delta as number[]);
  const winner = value.winner as 0 | 1 | null;
  if (
    delta &&
    winner !== (delta[0] === delta[1] ? null : delta[0] > delta[1] ? 0 : 1)
  )
    return null;
  return {
    scores: [...scores],
    delta: delta ? [...delta] : null,
    finish: [...(value.finish as number[])],
    winner,
  };
}

/** Fail closed when Durable Object storage contains an old or malformed archive. */
export function loadTrainingArchive(
  value: unknown,
  now = Date.now(),
): TrainingArchive {
  if (!isRecord(value) || !Array.isArray(value.sessions))
    return createTrainingArchive();
  const sessions: TrainingSession[] = [];
  for (const raw of value.sessions.slice(-TRAINING_MAX_SESSIONS)) {
    if (
      !isRecord(raw) ||
      typeof raw.id !== 'string' ||
      raw.id.length > 128 ||
      (raw.groupId !== undefined &&
        raw.groupId !== null &&
        !validGroupId(raw.groupId)) ||
      !finiteInt(raw.createdAt) ||
      !finiteInt(raw.updatedAt) ||
      !Array.isArray(raw.events) ||
      (raw.outcome !== undefined && !parseTrainingOutcome(raw.outcome))
    )
      continue;
    const rawEvents = raw.events;
    const events = rawEvents
      .slice(-TRAINING_MAX_EVENTS_PER_SESSION)
      .map(parseTrainingDecision)
      .filter((v): v is TrainingDecision => !!v);
    if (!events.length) continue;
    const session: TrainingSession = {
      id: raw.id as string,
      createdAt: raw.createdAt as number,
      updatedAt: raw.updatedAt as number,
      events,
    };
    if (raw.groupId !== undefined)
      session.groupId = raw.groupId as string | null;
    if (raw.outcome !== undefined)
      session.outcome = parseTrainingOutcome(raw.outcome) as TrainingOutcome;
    if (
      raw.truncated === true ||
      rawEvents.length > TRAINING_MAX_EVENTS_PER_SESSION ||
      events.length !==
        Math.min(rawEvents.length, TRAINING_MAX_EVENTS_PER_SESSION)
    )
      session.truncated = true;
    sessions.push(session);
  }
  const archive = { sessions };
  pruneTrainingArchive(archive, now);
  enforceByteCap(archive);
  return archive;
}

export function pruneTrainingArchive(
  archive: TrainingArchive,
  now = Date.now(),
) {
  archive.sessions = archive.sessions.filter(
    (session) => now - session.createdAt <= TRAINING_RETENTION_MS,
  );
  return archive;
}

/** Append without ever exceeding the per-round or total-session bounds. */
export function appendTrainingDecision(
  archive: TrainingArchive,
  sessionId: string,
  decision: TrainingDecision,
  now = Date.now(),
  groupId?: string | null,
): boolean {
  if (groupId !== undefined && groupId !== null && !validGroupId(groupId))
    return false;
  pruneTrainingArchive(archive, now);
  const before = structuredClone(archive);
  let session = archive.sessions.find((entry) => entry.id === sessionId);
  if (!session) {
    if (archive.sessions.length >= TRAINING_MAX_SESSIONS) return false;
    session = {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      events: [],
      ...(groupId === undefined ? {} : { groupId }),
    };
    archive.sessions.push(session);
  }
  if (
    groupId !== undefined &&
    session.groupId !== undefined &&
    session.groupId !== groupId
  )
    return false;
  if (groupId !== undefined && session.groupId === undefined)
    session.groupId = groupId;
  if (session.events.length >= TRAINING_MAX_EVENTS_PER_SESSION) return false;
  session.events.push(decision);
  session.updatedAt = now;
  enforceByteCap(archive);
  if (archive.sessions.some((entry) => entry.id === sessionId)) return true;
  archive.sessions = before.sessions;
  return false;
}

function archiveBytes(archive: TrainingArchive) {
  return new TextEncoder().encode(JSON.stringify(archive)).byteLength;
}

function enforceByteCap(archive: TrainingArchive) {
  while (
    archiveBytes(archive) > TRAINING_MAX_BYTES &&
    archive.sessions.length
  ) {
    if (archive.sessions.length > 1) {
      archive.sessions.shift();
      continue;
    }
    const session = archive.sessions[0];
    if (session.events.length) {
      session.events.shift();
      session.truncated = true;
    } else archive.sessions.shift();
  }
}

export function finalizeTrainingSession(
  archive: TrainingArchive,
  sessionId: string,
  outcome: TrainingOutcome,
  now = Date.now(),
): boolean {
  pruneTrainingArchive(archive, now);
  const session = archive.sessions.find((entry) => entry.id === sessionId);
  if (!session) return false;
  session.outcome = {
    scores: [...outcome.scores],
    delta: outcome.delta ? [...outcome.delta] : null,
    finish: [...outcome.finish],
    winner: outcome.winner,
  };
  session.updatedAt = now;
  enforceByteCap(archive);
  return archive.sessions.some((entry) => entry.id === sessionId);
}

/** Return only completed, retention-eligible sessions without storage timestamps. */
export function exportTrainingArchive(
  archive: TrainingArchive,
  now = Date.now(),
): TrainingExport {
  const sessions = archive.sessions
    .filter(
      (session) =>
        session.outcome &&
        session.events.length > 0 &&
        now - session.createdAt <= TRAINING_RETENTION_MS,
    )
    .map((session) => ({
      id: session.id,
      groupId: session.groupId ?? null,
      events: session.events,
      outcome: session.outcome as TrainingOutcome,
      truncated: !!session.truncated,
    }));
  return { schema: 2, sessions };
}
