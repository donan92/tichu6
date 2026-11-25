import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import I18NextVue from 'i18next-vue';
import { nextTick } from 'vue';
import { i18next } from '../../src/localization';
import { useSessionStore } from '../../src/stores/session';
import { act, newGame, startRound, view } from '../../src/game.js';
import LeaveDialog from '../../src/components/LeaveDialog.vue';
import AppHeader from '../../src/components/AppHeader.vue';
import PlayingCard from '../../src/components/PlayingCard.vue';
import TurnClock from '../../src/components/TurnClock.vue';
import DeclarationNotice from '../../src/components/DeclarationNotice.vue';
import PassAction from '../../src/components/PassAction.vue';
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
  it('shows extension at ten seconds and red progress warning at five', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const wrapper = mount(TurnClock, {
      props: {
        deadline: 31000,
        duration: 30000,
        phase: 'play',
        canExtend: true,
      },
      global: { plugins: plugins() },
    });
    wrappers.push(wrapper);
    expect(wrapper.find('button').exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(20000);
    expect(wrapper.find('button').exists()).toBe(true);
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('extend')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(wrapper.classes()).toContain('urgent');
    expect(wrapper.get('progress').attributes('value')).toBe('5000');
  });
  it('announces new declarations and closes each notice after five seconds', async () => {
    vi.useFakeTimers();
    const game = round();
    const wrapper = mount(DeclarationNotice, {
      props: { game },
      global: { plugins: plugins() },
    });
    wrappers.push(wrapper);
    expect(document.querySelector('.declaration-overlay')).toBeNull();
    await wrapper.setProps({ game: { ...game, calls: [100, 0, 0, 0, 0, 0] } });
    expect(
      document.querySelector('.declaration-overlay')?.textContent,
    ).toContain(game.names[0]);
    await vi.advanceTimersByTimeAsync(4999);
    expect(document.querySelector('.declaration-overlay')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(document.querySelector('.declaration-overlay')).toBeNull();
  });
  it('requires confirmation before passing with a legal combination', async () => {
    const session = useSessionStore();
    const game = round();
    game.phase = 'play';
    game.turn = 0;
    game.hand = [{ id: '0-0-8', rank: 8, suit: 0 }];
    game.top = { kind: 'single', power: 3, bomb: 0, size: 1, cards: [] };
    session.game = game;
    const submit = vi.spyOn(session, 'submit').mockImplementation(() => {});
    const wrapper = mount(PassAction, {
      props: { game },
      global: { plugins: plugins() },
    });
    wrappers.push(wrapper);
    await wrapper.get('button').trigger('click');
    expect(submit).not.toHaveBeenCalled();
    (
      document.querySelector(
        '.action-confirm button.primary',
      ) as HTMLButtonElement
    ).click();
    await nextTick();
    expect(submit).toHaveBeenCalledWith({ type: 'pass' });
  });

  it('shows private exchange partners and team-colored ranked plays, then removes the receipt', async () => {
    const session = useSessionStore();
    const game = round();
    game.phase = 'play';
    game.last = 3;
    game.top = {
      kind: 'pair',
      power: 10,
      size: 2,
      bomb: 0,
      cards: [
        { id: 'x', rank: 10, suit: 0 },
        { id: 'y', rank: 10, suit: 1 },
      ],
    };
    game.exchangeReview = [
      {
        partner: 2,
        sent: { id: 'a', rank: 4, suit: 0 },
        received: { id: 'b', rank: 14, suit: 3 },
      },
    ];
    session.game = game;
    const wrapper = mount(GameView, {
      props: { game },
      global: { plugins: plugins() },
    });
    wrappers.push(wrapper);
    expect(wrapper.get('.played-by').classes()).toContain('played-team-b');
    expect(wrapper.get('.played-by').text()).toContain('Team B');
    expect(wrapper.get('.played-by').text()).toContain('10 pair');
    expect(wrapper.get('.exchange-review').text()).toContain(game.names[2]);
    expect(wrapper.get('.exchange-review').text()).toContain('Sent');
    expect(wrapper.get('.exchange-review').text()).toContain('Received');
    await wrapper.setProps({ game: { ...game, exchangeReview: [] } });
    expect(wrapper.find('.exchange-review').exists()).toBe(false);
    await wrapper.setProps({ game: { ...game, spectator: true } });
    expect(wrapper.find('.exchange-review').exists()).toBe(false);
  });
  it('warns before forfeiting and supports cancel, Escape, repeated opening and focus return', async () => {
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
    const session = useSessionStore();
    session.startPractice();
    const header = mount(AppHeader, {
      attachTo: document.body,
      global: { plugins: plugins() },
    });
    wrappers.push(header);
    const button = header.get('button.quiet');
    (button.element as HTMLButtonElement).focus();
    await button.trigger('click');
    expect(session.leaving).toBe(true);
    const open = () =>
      mount(LeaveDialog, {
        attachTo: document.body,
        global: { plugins: plugins() },
      });
    let dialog = open();
    expect(dialog.text()).toContain('Give up this game?');
    await dialog.get('button').trigger('click');
    expect(session.leaving).toBe(false);
    dialog.unmount();
    expect(document.activeElement).toBe(button.element);
    await button.trigger('click');
    dialog = open();
    await dialog.get('dialog').trigger('cancel');
    expect(session.leaving).toBe(false);
    dialog.unmount();
    await button.trigger('click');
    dialog = open();
    await dialog.findAll('button')[1].trigger('click');
    expect(session.mode).toBe('home');
    expect(session.game).toBeNull();
    dialog.unmount();
  });

  it('advances counterclockwise for every player viewpoint and spectators', async () => {
    const session = useSessionStore();
    let state = startRound(newGame());
    state.phase = 'play';
    state.turn = 0;
    state.hands = state.hands.map((_, index) => [
      { id: `low-${index}`, rank: 2 + index, suit: 0 },
      { id: `high-${index}`, rank: 10, suit: 1 },
    ]);
    const wrapper = mount(GameView, {
      props: { game: view(state, 0) },
      global: { plugins: plugins() },
    });
    wrappers.push(wrapper);
    // CSS positions run clockwise: bottom, lower left, upper left, top,
    // upper right, lower right. Increasing engine seats must run opposite.
    for (const viewpoint of [0, 1, 2, 3, 4, 5, -1]) {
      session.game = {
        ...view(state, Math.max(0, viewpoint)),
        seat: viewpoint,
      };
      const base = Math.max(0, viewpoint);
      for (let turn = 0; turn < 6; turn++) {
        await wrapper.setProps({
          game: { ...view(state, base), turn, spectator: viewpoint < 0 },
        });
        const expectedPosition = (base - turn + 6) % 6;
        expect(wrapper.get('.player.active').classes()).toContain(
          `pos-${expectedPosition}`,
        );
        expect(wrapper.get('.pos-0 b').text()).toContain(state.names[base]);
      }
    }
    session.game = view(state, 0);
    state = act(state, 0, {
      type: 'play',
      ids: ['low-0'],
      wish: null,
      target: 2,
      phoenixRank: null,
    });
    await wrapper.setProps({ game: view(state, 0) });
    expect(wrapper.get('.player.active').classes()).toContain('pos-5');
    state = act(state, 1, { type: 'pass' });
    await wrapper.setProps({ game: view(state, 0) });
    expect(wrapper.get('.player.active').classes()).toContain('pos-4');
  });

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
        special === 'mahjong' ? '1' : '',
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
      expect(wrapper.get('.card-emblem use').attributes('href')).toContain(
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
  it('maps all twelve courts to unique artwork without changing suit identity', () => {
    const positions = new Set<string>();
    for (let suit = 0; suit < 4; suit++) {
      for (const rank of [11, 12, 13]) {
        const wrapper = mount(PlayingCard, {
          props: { card: { id: `${suit}-${rank}`, rank, suit } },
          global: { plugins: plugins() },
        });
        wrappers.push(wrapper);
        const style = wrapper.get('.court-art').attributes('style') ?? '';
        positions.add(style);
        expect(wrapper.classes()).toContain(`suit-${suit}`);
        expect(wrapper.find('.card-bottom').exists()).toBe(false);
        const rows = [0, 1, 3, 2];
        const artwork = wrapper.get('.court-art').element as HTMLElement;
        const [sx, sy] = artwork.style.backgroundSize
          .split(' ')
          .map(parseFloat);
        const [px, py] = artwork.style.backgroundPosition
          .split(' ')
          .map(parseFloat);
        const width = 108600 / sx,
          height = 144800 / sy;
        const x = (px / 100) * (1086 - width),
          y = (py / 100) * (1448 - height);
        // Each trimmed portrait must stay inside its own atlas cell.
        expect(x).toBeGreaterThanOrEqual((rank - 11) * 362);
        expect(x + width).toBeLessThanOrEqual((rank - 10) * 362);
        expect(y).toBeGreaterThanOrEqual(rows[suit] * 350);
        expect(y + height).toBeLessThanOrEqual((rows[suit] + 1) * 350);
      }
    }
    expect(positions.size).toBe(12);
  });
  it('renders the rank-matched pip count with mirrored columns and readable indices', () => {
    for (let rank = 2; rank <= 14; rank++) {
      if (rank >= 11 && rank <= 13) continue;
      const wrapper = mount(PlayingCard, {
        props: { card: { id: `card-${rank}`, rank, suit: 0 } },
        global: { plugins: plugins() },
      });
      wrappers.push(wrapper);
      expect(wrapper.findAll('svg')).toHaveLength(1);
      expect(wrapper.get('.card-corner').text()).toBe(
        rank === 14 ? 'A' : String(rank),
      );
      expect(wrapper.findAll('svg use')).toHaveLength(rank === 14 ? 1 : rank);
      if (rank !== 14) {
        const pips = wrapper.findAll('.card-pips use');
        const points = pips.map((pip) => [
          Number(pip.attributes('x')) + 11,
          Number(pip.attributes('y')) + 11,
        ]);
        expect(new Set(points.map(String)).size).toBe(rank);
        for (const [x, y] of points) {
          expect(points).toContainEqual([100 - x, y]);
          expect(x - 11).toBeGreaterThan(0);
          expect(x + 11).toBeLessThan(100);
          expect(y - 11).toBeGreaterThan(30);
          expect(y + 11).toBeLessThan(140);
        }
      }
      expect(wrapper.find('.card-bottom').exists()).toBe(false);
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
    expect(session.round?.names).toEqual(
      expect.arrayContaining([
        'BotTest',
        'SkyBot',
        'StarBot',
        'RiverBot',
        'SunBot',
        'SeaBot',
      ]),
    );
    expect(session.round?.hand).toHaveLength(10);
    session.submit({ type: 'grand', call: false });
    await vi.advanceTimersByTimeAsync(4200);
    expect(session.round?.phase).toBe('exchange');
    expect(session.round?.hand).toHaveLength(18);
    expect(session.notice).toBeNull();
  });
  it('changes language through a modal, dismisses it and restores trigger focus repeatedly', async () => {
    const wrapper = mount(AppHeader, {
      global: { plugins: plugins() },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    const trigger = wrapper.get('.choice-trigger');
    const element = trigger.element as HTMLButtonElement;
    element.focus();
    await trigger.trigger('click');
    const dialog = document.querySelector(
      'dialog.choice-dialog',
    ) as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('.choice-cancel')?.textContent).toBe('Cancel');
    const choices = dialog.querySelectorAll<HTMLButtonElement>(
      '.choice-options button',
    );
    const korean = [...choices].find((button) =>
      button.textContent?.includes('한국어'),
    )!;
    korean.click();
    await flushPromises();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(element);
    expect(localStorage.getItem('tichu6-language')).toBe('ko');
    const session = useSessionStore();
    session.mode = 'hall';
    session.connected = true;
    await nextTick();
    expect(wrapper.get('.choice-trigger').element).toBe(element);
    await trigger.trigger('click');
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await nextTick();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(element);
    await trigger.trigger('click');
    dialog.querySelector<HTMLButtonElement>('.choice-cancel')!.click();
    await nextTick();
    expect(dialog.open).toBe(false);
    expect(localStorage.getItem('tichu6-language')).toBe('ko');
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
  it.each(['dog', 'mahjong', 'dragon'] as const)(
    'opens %s choices only after the action button and submits only after confirmation',
    async (special) => {
      const session = useSessionStore();
      const game = round();
      game.phase = special === 'dragon' ? 'trick' : 'play';
      game.turn = 0;
      game.last = 0;
      game.hand = [
        {
          id: special,
          rank: special === 'dog' ? 0 : special === 'mahjong' ? 1 : 16,
          suit: -1,
          special,
        },
      ];
      if (special === 'dragon')
        game.top = {
          kind: 'single',
          power: 16,
          size: 1,
          bomb: 0,
          cards: game.hand,
        };
      session.game = game;
      session.selected = [special];
      const submit = vi.spyOn(session, 'submit').mockImplementation(() => {});
      const wrapper = mount(GameControls, {
        props: { game },
        attachTo: document.body,
        global: { plugins: plugins() },
      });
      wrappers.push(wrapper);
      expect(wrapper.find('.choice-trigger').exists()).toBe(false);
      expect(document.querySelector('.action-confirm')).toBeNull();
      await wrapper.get('button.primary').trigger('click');
      if (special === 'dog') {
        expect(submit).toHaveBeenCalledWith({ type: 'prepareDog' });
        await wrapper.setProps({
          game: {
            ...game,
            dogPending: 0,
            deadline: Date.now() + 30000,
            deadlineDuration: 30000,
          },
        });
        submit.mockClear();
      }
      const confirm = () =>
        document.querySelector<HTMLButtonElement>(
          '.action-confirm button.primary',
        )!;
      expect(confirm().disabled).toBe(true);
      const choices = document.querySelectorAll<HTMLButtonElement>(
        '.special-choices button',
      );
      expect(choices.length).toBe(
        special === 'dog' ? 2 : special === 'mahjong' ? 14 : 3,
      );
      choices[1]!.click();
      await nextTick();
      expect(submit).not.toHaveBeenCalled();
      expect(confirm().disabled).toBe(false);
      document
        .querySelector('.action-confirm')!
        .dispatchEvent(new Event('cancel'));
      await nextTick();
      expect(submit).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(
        wrapper.get('button.primary').element,
      );
      await wrapper.get('button.primary').trigger('click');
      expect(confirm().disabled).toBe(true);
      document
        .querySelectorAll<HTMLButtonElement>('.special-choices button')[1]!
        .click();
      await nextTick();
      confirm().click();
      await nextTick();
      expect(submit).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining(
          special === 'dragon'
            ? { type: 'collect', target: 3 }
            : special === 'dog'
              ? { type: 'play', target: 4 }
              : { type: 'play', wish: 2 },
        ),
      );
      await wrapper.get('button.primary').trigger('click');
      await wrapper.setProps({
        game: { ...game, turn: 1, revision: game.revision + 1 },
      });
      expect(document.querySelector('.action-confirm')).toBeNull();
    },
  );
  it('announces a required wished bomb only on the player turn and never submits it automatically', async () => {
    const session = useSessionStore();
    const game = round();
    game.phase = 'play';
    game.turn = 0;
    game.wish = 8;
    session.game = game;
    game.hand = Array.from({ length: 4 }, (_, suit) => ({
      id: `0-${suit}-8`,
      suit,
      rank: 8,
    }));
    game.top = { kind: 'bomb', bomb: 1, power: 3, size: 4, cards: [] };
    const submit = vi.spyOn(session, 'submit').mockImplementation(() => {});
    const wrapper = mount(GameControls, {
      props: { game },
      global: { plugins: plugins() },
    });
    wrappers.push(wrapper);
    expect(wrapper.get('[role="status"]').text()).toContain('8');
    expect(submit).not.toHaveBeenCalled();
    await wrapper.setProps({ game: { ...game, turn: 1 } });
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    await wrapper.setProps({
      game: { ...game, top: { ...game.top!, power: 9 } },
    });
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
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
    expect(session.round?.hand).toHaveLength(10);
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
