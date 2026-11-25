import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia, disposePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import I18NextVue from 'i18next-vue';
import { i18next } from '../../src/localization';
import { newGame, startRound, view, deck } from '../../src/game.js';
import { useSessionStore } from '../../src/stores/session';
import { savePractice } from '../../src/practice-storage';
import GameView from '../../src/views/GameView.vue';
import GameControls from '../../src/components/GameControls.vue';
import TrickHistory from '../../src/components/TrickHistory.vue';
import TurnClock from '../../src/components/TurnClock.vue';
let pinia: ReturnType<typeof createPinia>;
const mounted: { unmount(): void }[] = [];
const global = () => ({
  plugins: [
    pinia,
    [I18NextVue, { i18next }] as [
      typeof I18NextVue,
      { i18next: typeof i18next },
    ],
  ],
});
beforeEach(async () => {
  pinia = createPinia();
  setActivePinia(pinia);
  localStorage.clear();
  await i18next.changeLanguage('en');
});
afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount());
  disposePinia(pinia);
  vi.useRealTimers();
});
it('identifies callers, failed individual calls, and each passed seat on the table', () => {
  const game = view(startRound(newGame()), 0);
  game.calls = [100, 200, 0, 0, 0, 0];
  game.passed = [1, 4];
  game.callResults = [{ seat: 0, call: 100, success: false, delta: -100 }];
  const w = mount(GameView, { props: { game }, global: global() });
  mounted.push(w);
  expect(w.get('.declarations').text()).toContain(game.names[0]);
  expect(w.get('.declarations').text()).toContain(game.names[1]);
  const players = w.findAll('.player');
  expect(players[1]!.find('.pass-badge').exists()).toBe(true);
  expect(players[4]!.find('.pass-badge').exists()).toBe(true);
  expect(players[0]!.find('.pass-badge').exists()).toBe(false);
  expect(w.get('.call-results').text()).toContain('-100');
  expect(w.get('.call-results').text()).toContain('Penalty');
});
it('keeps the exchange draft after someone calls and allows revision after personal confirmation', async () => {
  const game = view(startRound(newGame()), 0);
  game.phase = 'exchange';
  const session = useSessionStore();
  session.game = game;
  session.selected = game.hand.slice(0, 2).map((c) => c.id);
  const w = mount(GameControls, { props: { game }, global: global() });
  mounted.push(w);
  const chosen = [...session.selected];
  const called = { ...game, calls: [0, 0, 100, 0, 0, 0] };
  session.game = called;
  await w.setProps({ game: called });
  expect(session.selected).toEqual(chosen);
  expect(w.get('.exchange-draft').text()).toContain(game.names[2]);
  await w
    .findAll('button')
    .find((b) => b.text() === 'Reselect cards')!
    .trigger('click');
  expect(session.selected).toEqual([]);
  const confirmed = {
    ...called,
    exchangeReady: [true, false, false, false, false, false],
  };
  session.game = confirmed;
  await w.setProps({ game: confirmed });
  session.toggleCard(game.hand[0]!.id);
  session.toggleCard(game.hand[1]!.id);
  expect(session.selected).toHaveLength(2);
  await w.vm.$nextTick();
  expect(w.get('button.primary').attributes('disabled')).toBeUndefined();
});
it('hides even accidentally provided archived tricks until match end, then offers per-trick disclosure', async () => {
  const game = view(startRound(newGame()), 0);
  game.phase = 'play';
  game.log = [{ code: 'log.pass', params: { name: 'Current' } }];
  game.trickHistory = [
    {
      round: 1,
      trick: 1,
      entries: [{ code: 'log.pass', params: { name: 'ArchivedPlayer' } }],
    },
  ];
  const w = mount(TrickHistory, { props: { game }, global: global() });
  mounted.push(w);
  expect(w.text()).toContain('Current');
  expect(w.text()).not.toContain('ArchivedPlayer');
  await w.setProps({ game: { ...game, phase: 'roundEnd' } });
  expect(w.text()).not.toContain('ArchivedPlayer');
  await w.setProps({ game: { ...game, phase: 'matchEnd' } });
  expect(w.get('.match-history details summary').text()).toContain('Trick 1');
  expect(w.text()).toContain('ArchivedPlayer');
});
it('counts down and restores a persisted practice deadline without extending it', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const state = startRound(newGame());
  state.phase = 'play';
  state.turn = 0;
  state.last = 5;
  const top = deck().find((c) => c.rank === 2)!;
  state.top = { kind: 'single', power: 2, bomb: 0, size: 1, cards: [top] };
  state.hands = Array.from({ length: 6 }, (_, i) =>
    deck()
      .filter((c) => !c.special && c.rank === i + 3)
      .slice(0, 2),
  );
  savePractice(state, 'Tester');
  const session = useSessionStore();
  session.restorePractice();
  expect(session.round?.deadline).toBe(31000);
  const w = mount(TurnClock, {
    props: { phase: 'play', deadline: 31000 },
    global: global(),
  });
  mounted.push(w);
  await vi.advanceTimersByTimeAsync(1000);
  expect(w.text()).toContain('29s');
  session.restorePractice();
  expect(session.round?.deadline).toBe(31000);
  await vi.advanceTimersByTimeAsync(29000);
  expect(session.round?.passed).toContain(0);
  expect(session.round?.turn).toBe(1);
});
