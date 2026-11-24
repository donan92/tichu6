import test from 'node:test';
import assert from 'node:assert/strict';
import { deck, newGame, points, startRound, legalPlays } from '../src/game.js';
import { candidate } from '../research/bots/candidate.js';
import { chooseStructureOption } from '../src/bot-structure.js';

const cards = deck();
const rank = (value, count = 1) =>
  cards.filter((card) => !card.special && card.rank === value).slice(0, count);
const exact = (rankValue, suit) =>
  cards.find((card) => card.rank === rankValue && card.suit === suit);

function scenario(hand, top = null, last = 1) {
  const state = startRound(newGame(), deck());
  state.phase = 'play';
  state.hands[0] = hand;
  state.turn = 0;
  state.top = top;
  state.last = last;
  state.pile = top?.cards ? [...top.cards] : [];
  return state;
}

function candidateOptions(state) {
  const hand = state.hands[0];
  const shapes = legalPlays(hand);
  const options = state.top ? legalPlays(hand, state.top) : shapes;
  const urgent = state.hands.some(
    (cards, seat) => seat % 2 !== 0 && cards.length > 0 && cards.length <= 2,
  );
  return {
    hand,
    shapes,
    options,
    context: {
      hasTop: !!state.top,
      urgent,
      pilePoints: points(state.pile),
    },
  };
}

test('matches the gentle candidate on deterministic lead and response scenarios', () => {
  const lead = scenario([...rank(2), ...rank(7, 2), ...rank(14)]);
  const leadData = candidateOptions(lead);
  const leadChoice = chooseStructureOption(
    leadData.hand,
    leadData.shapes,
    leadData.options,
    leadData.context,
  );
  assert.deepEqual(
    leadChoice.cards.map((card) => card.id),
    candidate(lead, 0, 'structure', { structureWeight: 15 }).ids,
  );

  const topCard = rank(10)[0];
  const response = scenario([...rank(11), ...rank(14), ...rank(5)], {
    kind: 'single',
    power: 10,
    size: 1,
    bomb: 0,
    cards: [topCard],
  });
  const responseData = candidateOptions(response);
  const responseChoice = chooseStructureOption(
    responseData.hand,
    responseData.shapes,
    responseData.options,
    responseData.context,
  );
  assert.deepEqual(
    responseChoice.cards.map((card) => card.id),
    candidate(response, 0, 'structure', { structureWeight: 15 }).ids,
  );
});

test('keeps stable input order for equal gentle scores', () => {
  const hand = [...rank(2, 2)];
  const shapes = legalPlays(hand);
  const options = shapes.filter((option) => option.cards.length === 1);
  const chosen = chooseStructureOption(
    hand,
    shapes,
    [...options].reverse(),
    {},
  );
  assert.equal(chosen, options[1]);
});

test('protects a bomb when it is the only viable response', () => {
  const hand = [...rank(7, 4), ...rank(3)];
  const shapes = legalPlays(hand);
  const options = legalPlays(hand, {
    kind: 'single',
    power: 14,
    size: 1,
    bomb: 0,
  });
  const chosen = chooseStructureOption(hand, shapes, options, {
    hasTop: true,
    urgent: true,
    pilePoints: 10,
  });
  assert.equal(chosen.play.bomb, 1);
});

test('gentle weight is distinct from the candidate default and remains parity-safe', () => {
  const hand = [
    exact(14, 1),
    exact(12, 2),
    exact(5, 0),
    exact(5, 3),
    exact(6, 1),
    exact(6, 0),
    exact(12, 1),
    exact(7, 1),
    exact(8, 3),
    exact(7, 3),
  ];
  const state = scenario(hand);
  const data = candidateOptions(state);
  const choice = chooseStructureOption(
    data.hand,
    data.shapes,
    data.options,
    data.context,
  );
  const gentle = candidate(state, 0, 'structure', { structureWeight: 15 });
  const baselineWeight = candidate(state, 0, 'structure', {});
  assert.deepEqual(
    choice.cards.map((card) => card.id),
    gentle.ids,
  );
  assert.notDeepEqual(gentle.ids, baselineWeight.ids);
});

test('wish and finish filtering remain caller responsibilities', () => {
  const wishState = scenario([exact(8, 0), exact(12, 0)], {
    kind: 'single',
    power: 2,
    size: 1,
    bomb: 0,
    cards: [exact(2, 0)],
  });
  wishState.wish = 8;
  const hand = wishState.hands[0];
  const shapes = legalPlays(hand);
  const wished = legalPlays(hand, wishState.top, wishState.wish);
  const choice = chooseStructureOption(hand, shapes, wished, {
    hasTop: true,
    urgent: false,
    pilePoints: 0,
  });
  assert.deepEqual(
    choice.cards.map((card) => card.id),
    [exact(8, 0).id],
  );

  const finishHand = [...rank(9, 2)];
  const finishShapes = legalPlays(finishHand);
  const finish = finishShapes.find(
    (option) => option.cards.length === finishHand.length,
  );
  assert.ok(finish);
  const nonFinish = finishShapes.filter((option) => option !== finish);
  assert.equal(
    chooseStructureOption(finishHand, finishShapes, nonFinish, {}) === finish,
    false,
  );
});
