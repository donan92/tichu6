import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import I18NextVue from 'i18next-vue';
import { nextTick } from 'vue';
import { i18next } from '../../src/localization';
import { useSessionStore } from '../../src/stores/session';
import { newGame, startRound, view } from '../../src/game.js';
import AppHeader from '../../src/components/AppHeader.vue';
import PlayingCard from '../../src/components/PlayingCard.vue';
import GameControls from '../../src/components/GameControls.vue';
import GameView from '../../src/views/GameView.vue';
import HallView from '../../src/views/HallView.vue';
import NicknameInput from '../../src/components/NicknameInput.vue';
import type { RoundView } from '../../src/types';
let pinia: ReturnType<typeof createPinia>;
const wrappers: { unmount: () => void }[] = [];
const plugins = () => [
  pinia,
  [I18NextVue, { i18next }] as [typeof I18NextVue, { i18next: typeof i18next }],
];
beforeEach(async () => {
  localStorage.clear();
  pinia = createPinia();
  setActivePinia(pinia);
  await i18next.changeLanguage('en');
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  disposePinia(pinia);
  vi.useRealTimers();
});
function round(): RoundView {
  return view(startRound(newGame()), 0);
}
describe('Vue interaction regressions', () => {
  it('renders special artwork with localized card labels and ordered selection', async () => {
    const wrapper = mount(PlayingCard, {
      props: {
        card: { id: 'dragon', rank: 16, suit: -1, special: 'dragon' },
        interactive: true,
        pick: 1,
      },
      global: { plugins: plugins() },
    });
    wrappers.push(wrapper);
    expect(wrapper.find('.special-dragon .special-art').exists()).toBe(true);
    expect(wrapper.attributes('aria-label')).toBe(i18next.t('card.dragon'));
    expect(wrapper.attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('.pick').text()).toBe('2');
    await wrapper.trigger('click');
    expect(wrapper.emitted('select')).toEqual([['dragon']]);
    await i18next.changeLanguage('ko');
    await nextTick();
    expect(wrapper.attributes('aria-label')).toBe(i18next.t('card.dragon'));
  });
  it('keeps special names accessible without printing them, and marks mahjong as one', async () => {
    await i18next.changeLanguage('ko');
    for (const special of ['dragon', 'phoenix', 'dog', 'mahjong'] as const) {
      const wrapper = mount(PlayingCard, {
        props: { card: { id: special, rank: 1, suit: -1, special } },
        global: { plugins: plugins() },
      });
      wrappers.push(wrapper);
      expect(wrapper.attributes('aria-label')).toBe(
        i18next.t(`card.${special}`),
      );
      expect(wrapper.text().replace(/\s/g, '')).toBe(
        special === 'mahjong' ? '11' : '',
      );
    }
  });
  it('uses standard suits and distinct illustrated court ranks', () => {
    for (const [suit, name] of [
      'spade',
      'club',
      'diamond',
      'heart',
    ].entries()) {
      const wrapper = mount(PlayingCard, {
        props: { card: { id: `suit-${suit}`, rank: 14, suit } },
        global: { plugins: plugins() },
      });
      wrappers.push(wrapper);
      expect(wrapper.get('.card-corner use').attributes('href')).toContain(
        `#${name}`,
      );
      expect(wrapper.attributes('aria-label')).toContain(
        i18next.t(`card.suit.${suit}`),
      );
    }
    for (const rank of [11, 12, 13]) {
      const wrapper = mount(PlayingCard, {
        props: { card: { id: `court-${rank}`, rank, suit: 0 } },
        global: { plugins: plugins() },
      });
      wrappers.push(wrapper);
      expect(wrapper.find(`.court-art.court-${rank}`).exists()).toBe(true);
    }
  });
  it('renders the exact number of pips for ordinary numeric cards', () => {
    for (let rank = 2; rank <= 10; rank++) {
      const wrapper = mount(PlayingCard, {
        props: { card: { id: `card-${rank}`, rank, suit: 0 } },
        global: { plugins: plugins() },
      });
      wrappers.push(wrapper);
      expect(wrapper.findAll('.card-pips svg')).toHaveLength(rank);
    }
  });
  it('starts five-bot practice from the lounge even while disconnected', async () => {
    vi.useFakeTimers();
    const session = useSessionStore();
    session.mode = 'hall';
    session.nickname = 'BotTest';
    session.connected = false;
    const wrapper = mount(HallView, { global: { plugins: plugins() } });
    wrappers.push(wrapper);
    const button = wrapper.get('.practice-entry button');
    expect(button.attributes('disabled')).toBeUndefined();
    expect(button.text()).toBe(i18next.t('home.practice'));
    await button.trigger('click');
    expect(session.mode).toBe('demo');
    expect(session.round?.names).toEqual([
      'BotTest',
      'SkyBot',
      'StarBot',
      'RiverBot',
      'SunBot',
      'SeaBot',
    ]);
    expect(session.round?.hand).toHaveLength(8);
    session.submit({ type: 'grand', call: false });
    await vi.advanceTimersByTimeAsync(4200);
    expect(session.round?.phase).toBe('exchange');
    expect(session.round?.hand).toHaveLength(18);
    expect(session.notice).toBeNull();
  });
  it('keeps the language select attached and focused through language and connection updates', async () => {
    const wrapper = mount(AppHeader, {
      global: { plugins: plugins() },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    const select = wrapper.get('select'),
      element = select.element as HTMLSelectElement;
    element.focus();
    await select.setValue('ko');
    await flushPromises();
    expect(wrapper.get('select').element).toBe(element);
    expect(document.activeElement).toBe(element);
    expect(element.value).toBe('ko');
    expect(localStorage.getItem('tichu6-language')).toBe('ko');
    const session = useSessionStore();
    session.mode = 'hall';
    session.connected = true;
    await nextTick();
    expect(wrapper.get('select').element).toBe(element);
    expect(document.activeElement).toBe(element);
    await select.setValue('en');
    await flushPromises();
    expect(element.value).toBe('en');
    expect(wrapper.text()).toContain('Language');
  });
  it('preserves nickname typing focus when other state updates', async () => {
    const wrapper = mount(NicknameInput, {
      props: { modelValue: 'Ab12', label: 'home.nickname' },
      global: { plugins: plugins() },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    const input = wrapper.get('input').element as HTMLInputElement;
    input.focus();
    input.setSelectionRange(2, 2);
    await i18next.changeLanguage('ko');
    await nextTick();
    expect(wrapper.get('input').element).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(2);
  });
  it('renders malicious names and translated history as text, never markup', () => {
    const game = round();
    game.names[0] = '<img src=x onerror=alert(1)>';
    game.log = [{ code: 'log.grand', params: { name: game.names[0] } }];
    const wrapper = mount(GameView, {
      props: { game },
      global: { plugins: plugins() },
    });
    wrappers.push(wrapper);
    expect(wrapper.findAll('img')).toHaveLength(0);
    expect(wrapper.text()).toContain(game.names[0]);
  });
  it('shows online room counts without untranslated placeholders', () => {
    const session = useSessionStore();
    session.directory = {
      count: 3,
      rooms: [
        {
          id: 'room',
          title: 'Table',
          phase: 'lobby',
          round: 0,
          scores: [0, 0],
          players: 2,
          online: 1,
          spectators: 1,
          mine: false,
        },
      ],
    };
    const wrapper = mount(HallView, { global: { plugins: plugins() } });
    wrappers.push(wrapper);
    expect(wrapper.text()).toContain('Online 1');
    expect(wrapper.text()).not.toContain('{{');
  });
  it('keeps cards and ordered exchange choices stable during server updates', async () => {
    const session = useSessionStore();
    const game = round();
    game.phase = 'exchange';
    game.exchangeReady = Array(6).fill(false);
    session.game = game;
    session.mode = 'room';
    const wrapper = mount(GameView, {
      props: { game },
      global: { plugins: plugins() },
    });
    wrappers.push(wrapper);
    const cards = wrapper.findAll('.hand button');
    const first = cards[0].element;
    await cards[1].trigger('click');
    await cards[0].trigger('click');
    expect(session.selected).toEqual([game.hand[1].id, game.hand[0].id]);
    await wrapper.setProps({ game: { ...game, revision: game.revision + 1 } });
    expect(wrapper.findAll('.hand button')[0].element).toBe(first);
    expect(wrapper.findAll('.hand button')[0].attributes('aria-pressed')).toBe(
      'true',
    );
  });
  it('sends the first valid dog recipient without requiring a dropdown change', async () => {
    const session = useSessionStore();
    const game = round();
    game.phase = 'play';
    game.turn = 0;
    game.hand = [{ id: 'dog', rank: 0, suit: -1, special: 'dog' }];
    session.game = game;
    session.selected = ['dog'];
    const submit = vi.spyOn(session, 'submit').mockImplementation(() => {});
    const wrapper = mount(GameControls, {
      props: { game },
      global: { plugins: plugins() },
    });
    wrappers.push(wrapper);
    expect((wrapper.get('#target').element as HTMLSelectElement).value).toBe(
      '2',
    );
    await wrapper.get('button.primary').trigger('click');
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'play', target: 2 }),
    );
  });
  it('selects an opponent for dragon collection and updates after seat changes', async () => {
    const session = useSessionStore();
    const game = round();
    game.phase = 'trick';
    game.last = 0;
    game.top = {
      kind: 'single',
      power: 16,
      size: 1,
      bomb: 0,
      cards: [{ id: 'dragon', special: 'dragon', rank: 16, suit: -1 }],
    };
    session.game = game;
    const submit = vi.spyOn(session, 'submit').mockImplementation(() => {});
    const wrapper = mount(GameControls, {
      props: { game },
      global: { plugins: plugins() },
    });
    wrappers.push(wrapper);
    expect(
      wrapper.findAll('option').map((option) => option.attributes('value')),
    ).toEqual(['1', '3', '5']);
    await wrapper.get('button').trigger('click');
    expect(submit).toHaveBeenCalledWith({ type: 'collect', target: 1 });
  });
  it('offers no action buttons or private cards to spectators', () => {
    const game = round();
    game.spectator = true;
    game.seat = -1;
    game.hand = [];
    const wrapper = mount(GameControls, {
      props: { game },
      global: { plugins: plugins() },
    });
    wrappers.push(wrapper);
    expect(wrapper.findAll('button')).toHaveLength(0);
    expect(wrapper.text()).toContain(i18next.t('room.spectating'));
  });
  it('runs practice through declaration and exchange without reactive clone errors', async () => {
    vi.useFakeTimers();
    const session = useSessionStore();
    session.startPractice();
    expect(session.round?.phase).toBe('grand');
    expect(session.round?.hand).toHaveLength(8);
    session.submit({ type: 'grand', call: false });
    await vi.advanceTimersByTimeAsync(4200);
    expect(session.round?.phase).toBe('exchange');
    expect(session.round?.hand).toHaveLength(18);
    session.submit({
      type: 'exchange',
      ids: session.round!.hand.slice(0, 2).map((card) => card.id),
    });
    await vi.advanceTimersByTimeAsync(4200);
    expect(session.round?.phase).toBe('play');
    expect(session.notice).toBeNull();
  });
  it('rejects invalid nicknames before opening a connection', async () => {
    const session = useSessionStore();
    session.nickname = 'bad name';
    await session.enterHall();
    expect(session.notice?.code).toBe('error.invalidNickname');
    expect(session.busy).toBe(false);
    expect(session.mode).toBe('home');
  });
});
