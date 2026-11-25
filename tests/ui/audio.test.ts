import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import I18NextVue from 'i18next-vue';
import { i18next } from '../../src/localization';
import SoundSettings from '../../src/components/SoundSettings.vue';
import { readAudioSettings, useAudioStore } from '../../src/stores/audio';
import { effectForTransition, warningKey } from '../../src/audio/events';
import { newGame, startRound, view } from '../../src/game.js';
import type { RoundView } from '../../src/types';

let pinia: ReturnType<typeof createPinia>;
let wrapper: ReturnType<typeof mount> | undefined;
beforeEach(async () => {
  localStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
  await i18next.changeLanguage('en');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function () {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function () {
      this.open = false;
    },
  });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  disposePinia(pinia);
  vi.restoreAllMocks();
});
const round = (): RoundView => ({
  ...view(startRound(newGame()), 0),
  phase: 'play',
  revision: 10,
  turn: 0,
  deadline: 10000,
});

it('validates saved settings and bounds malformed volume values', () => {
  expect(readAudioSettings('{')).toEqual(readAudioSettings(null));
  expect(
    readAudioSettings(
      '{"music":false,"effects":"false","musicVolume":-5,"effectsVolume":999}',
    ),
  ).toEqual({
    music: false,
    effects: true,
    musicVolume: 0,
    effectsVolume: 100,
  });
  expect(readAudioSettings('{"musicVolume":1e999}').musicVolume).toBe(25);
});

it('opens repeatedly, preserves input nodes and focus, persists independent controls, and dismisses', async () => {
  const audio = useAudioStore();
  audio.available = true;
  vi.spyOn(audio, 'unlock').mockResolvedValue();
  wrapper = mount(SoundSettings, {
    attachTo: document.body,
    global: { plugins: [pinia, [I18NextVue, { i18next }]] },
  });
  const trigger = wrapper.get('.sound-trigger');
  for (const dismissal of ['button', 'cancel', 'backdrop']) {
    await trigger.trigger('click');
    const dialog = document.querySelector<HTMLDialogElement>('.sound-dialog')!;
    expect(dialog.open).toBe(true);
    const ranges =
      dialog.querySelectorAll<HTMLInputElement>('input[type=range]');
    ranges[0].focus();
    ranges[0].value = '12';
    ranges[0].dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    expect(audio.settings.musicVolume).toBe(12);
    expect(audio.settings.effectsVolume).toBe(45);
    expect(document.activeElement).toBe(ranges[0]);
    expect(dialog.querySelector('input[type=range]')).toBe(ranges[0]);
    const saved = JSON.parse(localStorage.getItem('tichu6-audio-v1')!);
    expect(saved.musicVolume).toBe(12);
    if (dismissal === 'button')
      dialog.querySelector<HTMLButtonElement>('.sound-close')!.click();
    else
      dialog.dispatchEvent(
        new Event(dismissal === 'cancel' ? 'cancel' : 'click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    await nextTick();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger.element);
  }
  await trigger.trigger('click');
  const checks = document.querySelectorAll<HTMLInputElement>(
    '.sound-dialog input[type=checkbox]',
  );
  checks[0].click();
  await nextTick();
  expect(audio.settings.music).toBe(false);
  expect(audio.settings.effects).toBe(true);
  expect(
    document.querySelector<HTMLInputElement>('.sound-dialog input[type=range]')!
      .disabled,
  ).toBe(true);
});

it('does not replay initial, duplicate, skipped, cross-room, or cross-seat snapshots', () => {
  const before = round(),
    after = { ...before, revision: 11, calls: [200, 0, 0, 0, 0, 0] };
  expect(effectForTransition(null, after)).toBeNull();
  expect(effectForTransition(before, after)).toBe('large');
  expect(effectForTransition(after, after)).toBeNull();
  expect(effectForTransition(before, { ...after, revision: 12 })).toBeNull();
  expect(effectForTransition(before, { ...after, roomId: 'other' })).toBeNull();
  expect(effectForTransition(before, { ...after, seat: 1 })).toBeNull();
});

it('prioritizes results and special plays over ordinary card sounds', () => {
  const before = round();
  const after: RoundView = {
    ...before,
    revision: 11,
    top: {
      kind: 'single',
      power: 25,
      size: 1,
      bomb: 0,
      cards: [{ id: 'dragon', rank: 25, suit: -1, special: 'dragon' }],
    },
  };
  expect(effectForTransition(before, after)).toBe('dragon');
  expect(
    effectForTransition(before, { ...after, top: { ...after.top!, bomb: 1 } }),
  ).toBe('bomb');
  expect(effectForTransition(before, { ...after, phase: 'roundEnd' })).toBe(
    'round',
  );
  expect(
    effectForTransition(before, {
      ...after,
      phase: 'matchEnd',
      scores: [1000, 500],
    }),
  ).toBe('win');
  expect(
    effectForTransition(
      { ...before, spectator: true },
      { ...after, spectator: true, phase: 'matchEnd' },
    ),
  ).toBe('round');
});

it('plays the deal cue when starting a match randomizes the local seat', () => {
  const before = { ...round(), phase: 'lobby' as const, round: 0, seat: 0 };
  const after = {
    ...round(),
    phase: 'grand' as const,
    revision: 11,
    round: 1,
    seat: 3,
  };
  expect(effectForTransition(before, after)).toBe('shuffle');
  expect(effectForTransition(null, after)).toBeNull();
});

it('warns only the active player in the last five seconds, excluding grace and spectators', () => {
  const game = round();
  expect(warningKey(game, 4000)).toBeNull();
  expect(warningKey(game, 5000)).toBeTruthy();
  expect(warningKey(game, 10000)).toBeNull();
  expect(warningKey({ ...game, spectator: true }, 5000)).toBeNull();
  expect(warningKey({ ...game, turn: 1 }, 5000)).toBeNull();
  expect(warningKey({ ...game, reconnectUntil: 9000 }, 5000)).toBeNull();
});

it('prioritizes our turn after a pass, retaining the swoosh for other players and trick closure', () => {
  const before = { ...round(), turn: 1, passed: [] };
  const after = { ...before, revision: 11, turn: 0, passed: [1] };
  expect(effectForTransition(before, after)).toBe('turn');
  expect(effectForTransition(before, { ...after, turn: 2 })).toBe('pass');
  expect(effectForTransition(before, { ...after, phase: 'trick' })).toBe(
    'pass',
  );
  expect(effectForTransition(after, after)).toBeNull();
  expect(effectForTransition(null, after)).toBeNull();
});

it('offers an explicit retry after Safari interrupts playback', async () => {
  const audio = useAudioStore();
  audio.available = true;
  audio.needsResume = true;
  const unlock = vi.spyOn(audio, 'unlock').mockResolvedValue();
  wrapper = mount(SoundSettings, {
    attachTo: document.body,
    global: { plugins: [pinia, [I18NextVue, { i18next }]] },
  });
  await wrapper.get('.sound-trigger').trigger('click');
  const retry = [
    ...document.querySelectorAll<HTMLButtonElement>('.sound-dialog button'),
  ].find((b) => b.textContent === 'Resume sound')!;
  expect(retry).toBeTruthy();
  retry.click();
  expect(unlock).toHaveBeenCalledTimes(2);
  audio.needsResume = false;
  await nextTick();
  expect(document.querySelector('.sound-dialog')?.textContent).not.toContain(
    'Resume sound',
  );
});

it('announces turn after a play, exchange or collection but never repeats or alerts spectators', () => {
  const before = { ...round(), turn: 1 };
  const after = {
    ...before,
    revision: 11,
    turn: 0,
    counts: [18, 17, 18, 18, 18, 18],
  };
  expect(effectForTransition(before, after)).toBe('turn');
  for (const phase of ['exchange', 'trick'] as const) {
    expect(effectForTransition({ ...before, phase, turn: 0 }, after)).toBe(
      'turn',
    );
  }
  expect(effectForTransition(after, { ...after, revision: 12 })).toBeNull();
  expect(effectForTransition(null, after)).toBeNull();
  expect(effectForTransition(before, { ...after, revision: 12 })).toBeNull();
  expect(
    effectForTransition(
      { ...before, spectator: true },
      { ...after, spectator: true },
    ),
  ).toBe('card');
});
