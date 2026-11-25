import type { GameView, RoundView } from '../types';

export type Effect =
  | 'card'
  | 'bomb'
  | 'small'
  | 'large'
  | 'join'
  | 'time'
  | 'dragon'
  | 'shuffle'
  | 'turn'
  | 'exchange'
  | 'collect'
  | 'finish'
  | 'round'
  | 'win'
  | 'lose'
  | 'pass';

// Public, accepted snapshot differences only. Initial/resumed snapshots are baselines.
export function effectForTransition(
  previous: GameView | null,
  next: GameView,
): Effect | null {
  // Starting a match randomizes seats; this accepted transition is still a deal.
  if (
    previous?.phase === 'lobby' &&
    next.phase === 'grand' &&
    previous.roomId === next.roomId &&
    next.round > previous.round &&
    next.revision === previous.revision + 1
  )
    return 'shuffle';
  if (
    !previous ||
    previous.roomId !== next.roomId ||
    previous.seat !== next.seat ||
    previous.spectator !== next.spectator
  )
    return null;
  if (previous.phase === 'lobby' && next.phase === 'lobby') {
    return next.names.some(
      (name, i) => name && name !== previous.names[i] && !next.bots?.[i],
    )
      ? 'join'
      : null;
  }
  if (
    next.revision <= previous.revision ||
    next.revision !== previous.revision + 1
  )
    return null;
  if (
    next.phase === 'grand' &&
    (previous.phase === 'lobby' || next.round !== previous.round)
  )
    return 'shuffle';
  if (previous.phase === 'lobby' || next.phase === 'lobby') return null;
  if (next.phase === 'matchEnd' && previous.phase !== 'matchEnd') {
    if (next.spectator || next.seat < 0 || next.scores[0] === next.scores[1])
      return 'round';
    return next.scores[next.seat % 2] > next.scores[1 - (next.seat % 2)]
      ? 'win'
      : 'lose';
  }
  if (next.phase === 'roundEnd' && previous.phase !== 'roundEnd')
    return 'round';
  if (next.calls.some((call, i) => call === 200 && previous.calls[i] !== call))
    return 'large';
  if (next.calls.some((call, i) => call === 100 && previous.calls[i] !== call))
    return 'small';
  if (previous.phase === 'exchange' && next.phase === 'play') return 'exchange';
  const topChanged =
    next.top &&
    next.top.cards.map((c) => c.id).join('|') !==
      previous.top?.cards.map((c) => c.id).join('|');
  if (topChanged && next.top?.bomb) return 'bomb';
  if (topChanged && next.top?.cards.some((c) => c.special === 'dragon'))
    return 'dragon';
  if (next.finish.length > previous.finish.length) return 'finish';
  if (topChanged) return 'card';
  if (next.counts.some((count, i) => count < previous.counts[i])) return 'card';
  if (previous.phase === 'trick' && next.phase === 'play') return 'collect';
  if (
    previous.phase === 'play' &&
    (next.passed.length > previous.passed.length ||
      (previous.turn !== null &&
        previous.turn !== next.turn &&
        next.passed.includes(previous.turn)))
  )
    return 'pass';
  if (
    !next.spectator &&
    next.turn === next.seat &&
    previous.turn !== next.turn &&
    next.phase === 'play'
  )
    return 'turn';
  return null;
}

export function warningKey(game: GameView | null, now: number): string | null {
  if (
    !game ||
    game.phase !== 'play' ||
    game.spectator ||
    game.seat < 0 ||
    (game as RoundView).turn !== game.seat ||
    game.paused ||
    !game.deadline ||
    (game.reconnectUntil ?? 0) > now
  )
    return null;
  const seconds = Math.ceil((game.deadline - now) / 1000);
  return seconds >= 1 && seconds <= 5
    ? `${game.roomId ?? 'practice'}:${game.round}:${game.deadline}:${seconds}`
    : null;
}
