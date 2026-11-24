// Resample complete mirrored pairs, never individual moves or the two games
// within a pair. Intervals describe evaluation decks, not training-seed variance.
export function pairedStatistics(pairs, { resamples = 5000, seed = 731 } = {}) {
  if (
    !Array.isArray(pairs) ||
    pairs.length < 2 ||
    pairs.some(
      (pair) =>
        !Array.isArray(pair) ||
        pair.length !== 2 ||
        pair.some((x) => !Number.isFinite(x)),
    ) ||
    !Number.isInteger(resamples) ||
    resamples < 100 ||
    resamples > 100000 ||
    !Number.isSafeInteger(seed)
  )
    throw new TypeError('Expected at least two finite mirrored pairs');
  const mean = (values) =>
    values.reduce((sum, x) => sum + x, 0) / values.length;
  const margins = pairs.map(mean);
  const wins = pairs.map((pair) => mean(pair.map((x) => Number(x > 0))));
  let state = seed >>> 0 || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const sampledMargins = [],
    sampledWins = [];
  for (let i = 0; i < resamples; i++) {
    let margin = 0,
      win = 0;
    for (let j = 0; j < pairs.length; j++) {
      const index = Math.floor(random() * pairs.length);
      margin += margins[index];
      win += wins[index];
    }
    sampledMargins.push(margin / pairs.length);
    sampledWins.push(win / pairs.length);
  }
  const interval = (values) => {
    values.sort((a, b) => a - b);
    return [
      values[Math.floor((values.length - 1) * 0.025)],
      values[Math.ceil((values.length - 1) * 0.975)],
    ];
  };
  return {
    pairs: pairs.length,
    games: pairs.length * 2,
    meanMargin: mean(margins),
    meanMargin95: interval(sampledMargins),
    gameWinRate: mean(wins),
    gameWinRate95: interval(sampledWins),
    gameWins: pairs.flat().filter((x) => x > 0).length,
    gameTies: pairs.flat().filter((x) => x === 0).length,
    gameLosses: pairs.flat().filter((x) => x < 0).length,
    pairWins: margins.filter((x) => x > 0).length,
    pairTies: margins.filter((x) => x === 0).length,
    pairLosses: margins.filter((x) => x < 0).length,
    bootstrap: {
      unit: 'mirrored-deck-pair',
      resamples,
      seed,
      method: 'percentile',
    },
  };
}
