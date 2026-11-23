import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import I18NextVue from 'i18next-vue';
import App from '../../src/App.vue';
import { i18next } from '../../src/localization';
import { useSessionStore } from '../../src/stores/session';
import {
  PRACTICE_KEY,
  savePractice,
  loadPractice,
} from '../../src/practice-storage';
import { act, botAction, newGame, startRound } from '../../src/game.js';
let pinia: ReturnType<typeof createPinia>;
function fresh() {
  if (pinia) disposePinia(pinia);
  pinia = createPinia();
  setActivePinia(pinia);
  return useSessionStore();
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  fresh();
});
afterEach(() => {
  disposePinia(pinia);
  vi.useRealTimers();
});
it('restores the exact ten-card deal, then resumes bot decisions and exchange after reload', () => {
  let session = useSessionStore();
  session.nickname = 'Reload';
  session.startPractice();
  const first = structuredClone(session.game);
  session = fresh();
  expect(session.restorePractice()).toBe(true);
  expect(session.mode).toBe('demo');
  expect(session.nickname).toBe('Reload');
  expect(session.game).toEqual(first);
  session.submit({ type: 'grand', call: false });
  vi.advanceTimersByTime(5000);
  expect(session.game?.phase).toBe('exchange');
  expect(session.game?.hand).toHaveLength(18);
  session.submit({
    type: 'exchange',
    ids: session.game!.hand.slice(0, 2).map((c) => c.id),
  });
  const snapshot = structuredClone(session.game);
  session = fresh();
  expect(session.restorePractice()).toBe(true);
  expect(session.game).toEqual(snapshot);
  vi.advanceTimersByTime(5000);
  expect(['play', 'trick']).toContain(session.game?.phase);
});
it('cancel/dispose preserves progress, but confirmed forfeit removes it', () => {
  let session = useSessionStore();
  session.startPractice();
  session.leaving = true;
  session.leaving = false;
  expect(localStorage.getItem(PRACTICE_KEY)).not.toBeNull();
  session = fresh();
  expect(session.restorePractice()).toBe(true);
  session.confirmLeave();
  expect(session.mode).toBe('home');
  expect(localStorage.getItem(PRACTICE_KEY)).toBeNull();
  session = fresh();
  expect(session.restorePractice()).toBe(false);
});
it('restores practice ahead of an old server session on application mount', () => {
  useSessionStore().startPractice();
  const session = fresh();
  localStorage.setItem(
    'tichu6-session-v4',
    JSON.stringify({ token: 'a'.repeat(64), name: 'Old', roomId: 'old' }),
  );
  const connect = vi.spyOn(session, 'enterHall');
  const wrapper = mount(App, {
    global: { plugins: [pinia, [I18NextVue, { i18next }]] },
  });
  expect(session.mode).toBe('demo');
  expect(connect).not.toHaveBeenCalled();
  wrapper.unmount();
});
it('invalid or incompatible saves do not crash startup or activate bots', () => {
  for (const value of [
    '{',
    JSON.stringify({ version: 9 }),
    JSON.stringify({ version: 1, nickname: 'a', state: { phase: 'play' } }),
  ]) {
    localStorage.setItem(PRACTICE_KEY, value);
    const session = fresh();
    expect(session.restorePractice()).toBe(false);
    expect(session.notice?.code).toBe('practice.restoreFailed');
    expect(session.mode).toBe('home');
    expect(localStorage.getItem(PRACTICE_KEY)).toBeNull();
  }
});
it('storage write failures show a warning without preventing local play', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Quota');
  });
  const session = useSessionStore();
  session.startPractice();
  expect(session.mode).toBe('demo');
  expect(session.game?.hand).toHaveLength(10);
  expect(session.notice?.code).toBe('practice.saveFailed');
});

it('persists play, trick, declarations, scores and round end without changing engine state', () => {
  let state = startRound(newGame());
  state.scores = [120, 80];
  state = act(state, 0, { type: 'grand', call: true });
  const phases = new Set<string>();
  for (let i = 0; i < 1500; i++) {
    savePractice(state, 'Reload');
    expect(loadPractice()?.state).toEqual(state);
    phases.add(state.phase);
    if (state.phase === 'roundEnd' || state.phase === 'matchEnd') break;
    const seat =
      state.phase === 'grand'
        ? state.ready.findIndex((x) => !x)
        : state.phase === 'exchange'
          ? state.exchanges.findIndex((x) => !x)
          : state.phase === 'trick'
            ? state.last!
            : state.turn!;
    state = act(state, seat, botAction(state, seat));
  }
  expect(phases.has('play')).toBe(true);
  expect(phases.has('trick')).toBe(true);
  expect(['roundEnd', 'matchEnd']).toContain(state.phase);
});
it('a failed save deletion leaves the game open instead of pretending it was removed', () => {
  const session = useSessionStore();
  session.startPractice();
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  session.confirmLeave();
  expect(session.mode).toBe('demo');
  expect(session.notice?.code).toBe('practice.saveFailed');
});
