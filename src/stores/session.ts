import { syncDeadline, dueAction } from '../game-clock';
import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { act, botAction, newGame, startRound, view, shuffle } from '../game.js';
import { AppError, errorEvent } from '../messages.js';
import { Room, savedRoom } from '../server-room';
import { savePractice, loadPractice, clearPractice } from '../practice-storage';
import type {
  GameAction,
  GameView,
  Message,
  RoomSummary,
  RoundState,
  ServerMessage,
} from '../types';
export const useSessionStore = defineStore('session', () => {
  const mode = ref<'home' | 'hall' | 'room' | 'demo'>('home');
  const savedSession = savedRoom();
  const nickname = ref(savedSession?.name ?? '');
  const restoring = ref(
    !!savedSession &&
      !savedSession.idle &&
      /^[A-Za-z0-9]{1,8}$/.test(savedSession.name),
  );
  const directory = shallowRef<{ rooms: RoomSummary[]; count: number }>({
    rooms: [],
    count: 0,
  });
  const game = shallowRef<GameView | null>(null);
  const online = ref<boolean[]>(Array(6).fill(false));
  const selected = ref<string[]>([]);
  const connected = ref(false),
    busy = ref(false),
    pending = ref(false),
    leaving = ref(false);
  const notice = shallowRef<Message | null>(null),
    connectionError = shallowRef<Message | null>(null);
  const seat = computed(() =>
    mode.value === 'demo' ? 0 : (game.value?.seat ?? -1),
  );
  const round = computed(() =>
    game.value?.phase !== 'lobby' ? game.value : null,
  );
  const forfeiting = computed(
    () =>
      !!game.value &&
      !game.value.spectator &&
      !['lobby', 'matchEnd'].includes(game.value.phase),
  );
  let room: Room | null = null;
  // Keep engine state outside Vue's proxies: act() clones it with structuredClone.
  let practice: RoundState | null = null;
  let botTimer: ReturnType<typeof setTimeout> | undefined;
  let restoreTimer: ReturnType<typeof setTimeout> | undefined;
  function restored() {
    restoring.value = false;
    clearTimeout(restoreTimer);
  }
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  function notify(error: unknown) {
    notice.value =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string'
        ? (error as Message)
        : errorEvent(error);
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice.value = null;
    }, 6000);
  }
  function validName() {
    if (!/^[A-Za-z0-9]{1,8}$/.test(nickname.value))
      throw new AppError('error.invalidNickname');
    return nickname.value;
  }
  function reconcileSelection() {
    selected.value = selected.value.filter((id) =>
      game.value?.hand.some((card) => card.id === id),
    );
  }
  function receive(message: ServerMessage) {
    switch (message.type) {
      case 'directory':
        directory.value = { rooms: message.rooms, count: message.count };
        break;
      case 'hall':
        restored();
        connectionError.value = null;
        mode.value = 'hall';
        game.value = null;
        selected.value = [];
        pending.value = false;
        break;
      case 'state':
        restored();
        mode.value = 'room';
        game.value = message.value;
        online.value = message.online;
        pending.value = false;
        connectionError.value = null;
        reconcileSelection();
        break;
      case 'error':
        pending.value = false;
        notify(message);
        break;
    }
  }
  async function enterHall(manual = true) {
    if (busy.value) return;
    try {
      const name = validName();
      busy.value = true;
      restoring.value = true;
      clearTimeout(restoreTimer);
      connectionError.value = null;
      stopPractice();
      room?.close();
      const active = new Room({
        onMessage: (message) => {
          if (room === active) receive(message);
        },
        onError: (message) => {
          if (room === active) {
            clearTimeout(restoreTimer);
            connectionError.value = message;
            if (message.code === 'error.idleLogout') {
              restored();
              mode.value = 'home';
              game.value = null;
              selected.value = [];
              directory.value = { rooms: [], count: 0 };
              leaving.value = false;
            }
            pending.value = false;
            notify(message);
          }
        },
        onNotice: (message) => {
          if (room === active && message.code === 'connection.storage')
            notify(message);
        },
        onStatus: (status) => {
          if (room !== active) return;
          connected.value = status;
          clearTimeout(restoreTimer);
          if (!status && mode.value === 'room') restoring.value = true;
          if (status && restoring.value) {
            restoreTimer = setTimeout(() => {
              if (room !== active || !restoring.value) return;
              connectionError.value = { code: 'error.connectFailed' };
              connected.value = false;
              active.close();
            }, 15000);
          }
          pending.value = false;
          if (game.value) game.value = { ...game.value, paused: !status };
        },
      });
      room = active;
      connected.value = false;
      try {
        await active.open(name, manual);
      } catch (error) {
        if (room === active) {
          connectionError.value ??= errorEvent(error);
          notify(error);
        }
      } finally {
        if (room === active) busy.value = false;
      }
    } catch (error) {
      notify(error);
      busy.value = false;
    }
  }
  function cancelRestore() {
    const previous = room;
    room = null;
    previous?.close();
    restored();
    connected.value = false;
    busy.value = false;
    pending.value = false;
    mode.value = 'home';
    game.value = null;
    selected.value = [];
    connectionError.value = null;
  }
  function publish() {
    if (!practice) return;
    syncDeadline(practice);
    try {
      savePractice(practice, nickname.value);
    } catch {
      notify({ code: 'practice.saveFailed' });
    }
    game.value = {
      ...view(practice, 0),
      paused: false,
      bots: [false, true, true, true, true, true],
    };
    reconcileSelection();
    scheduleBot();
  }
  function scheduleBot() {
    clearTimeout(botTimer);
    if (mode.value !== 'demo' || !practice) return;
    let next = -1;
    if (practice.phase === 'grand')
      next = practice.ready.findIndex((ready, index) => index > 0 && !ready);
    else if (practice.phase === 'exchange')
      next = practice.exchanges.findIndex(
        (ready, index) => index > 0 && !ready,
      );
    else if (practice.phase === 'play') next = practice.turn ?? -1;

    const timed = practice.deadline;
    const delay = timed == null ? Infinity : Math.max(0, timed - Date.now());
    if (delay <= (next > 0 ? 800 : Infinity) && Number.isFinite(delay)) {
      botTimer = setTimeout(() => {
        if (!practice || mode.value !== 'demo') return;
        const due = dueAction(practice);
        if (due) {
          practice = act(practice, due.seat, due.action);
          publish();
        }
      }, delay);
    } else if (next > 0)
      botTimer = setTimeout(() => {
        if (!practice || mode.value !== 'demo') return;
        try {
          practice = act(practice, next, botAction(practice, next));
          publish();
        } catch (error) {
          notify(error);
        }
      }, 800);
  }
  function stopPractice() {
    clearTimeout(botTimer);
    practice = null;
  }
  function restorePractice() {
    try {
      const saved = loadPractice();
      if (!saved) return false;
      stopPractice();
      nickname.value = saved.nickname;
      practice = saved.state;
      restored();
      mode.value = 'demo';
      selected.value = [];
      online.value = Array(6).fill(true);
      publish();
      return true;
    } catch {
      try {
        clearPractice();
      } catch {
        /* Storage may be unavailable. */
      }
      notify({ code: 'practice.restoreFailed' });
      return false;
    }
  }
  function startPractice() {
    try {
      if (nickname.value) validName();
      room?.close();
      room = null;
      connected.value = false;
      busy.value = false;
      pending.value = false;
      stopPractice();
      selected.value = [];
      restored();
      mode.value = 'demo';
      online.value = Array(6).fill(true);
      practice = startRound(
        newGame([
          nickname.value || 'You',
          ...shuffle(['SkyBot', 'StarBot', 'RiverBot', 'SunBot', 'SeaBot']),
        ]),
      );
      publish();
    } catch (error) {
      notify(error);
    }
  }
  function submit(action: GameAction) {
    try {
      if (mode.value === 'demo' && practice) {
        practice =
          action.type === 'next'
            ? startRound(practice)
            : act(practice, 0, action);
        selected.value = [];
        publish();
        return;
      }
      if (!room || !game.value || !connected.value)
        throw new AppError('error.notConnected');
      if (game.value.spectator) throw new AppError('error.spectator');
      if (pending.value) return;
      room.request({ type: 'action', revision: game.value.revision, action });
      pending.value = true;
    } catch (error) {
      notify(error);
    }
  }
  function createRoom() {
    try {
      if (!room) throw new AppError('error.notConnected');
      room.request({ type: 'create', name: validName() });
    } catch (error) {
      notify(error);
    }
  }
  function joinRoom(roomId: string, watch = false) {
    try {
      if (!room) throw new AppError('error.notConnected');
      room.request({ type: 'join', roomId, watch, name: validName() });
    } catch (error) {
      notify(error);
    }
  }
  function toggleCard(id: string) {
    if (
      game.value?.spectator ||
      !game.value?.hand.some((card) => card.id === id)
    )
      return;
    selected.value = selected.value.includes(id)
      ? selected.value.filter((value) => value !== id)
      : [...selected.value, id];
  }
  function confirmLeave() {
    try {
      if (mode.value === 'room') {
        if (!room || !connected.value)
          throw new AppError('error.waitConnection');
        room.request({ type: forfeiting.value ? 'forfeit' : 'leave' });
      } else {
        // Delete before exiting; a failed deletion must not silently resurrect it.
        if (mode.value === 'demo') {
          try {
            clearPractice();
          } catch {
            notify({ code: 'practice.saveFailed' });
            return;
          }
        }
        room?.close();
        room = null;
        connected.value = false;
        busy.value = false;
        stopPractice();
        restored();
        mode.value = 'home';
        game.value = null;
      }
      leaving.value = false;
      selected.value = [];
      pending.value = false;
    } catch (error) {
      notify(error);
    }
  }
  function dispose() {
    clearTimeout(restoreTimer);
    room?.close();
    room = null;
    stopPractice();
    clearTimeout(noticeTimer);
  }
  onScopeDispose(dispose);
  return {
    mode,
    restoring,
    nickname,
    directory,
    game,
    round,
    online,
    selected,
    connected,
    busy,
    pending,
    leaving,
    forfeiting,
    notice,
    connectionError,
    seat,
    enterHall,
    cancelRestore,
    startPractice,
    restorePractice,
    submit,
    createRoom,
    joinRoom,
    toggleCard,
    confirmLeave,
    notify,
    dispose,
  };
});
