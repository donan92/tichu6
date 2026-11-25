import { onMounted, onUnmounted, watch } from 'vue';
import { useSessionStore } from '../stores/session';
import { useAudioStore } from '../stores/audio';
import { effectForTransition, warningKey } from '../audio/events';
import type { GameView } from '../types';

export function useGameAudio() {
  const session = useSessionStore(),
    audio = useAudioStore();
  let previous: GameView | null = null,
    lastWarning: string | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  const live = () =>
    !document.hidden &&
    !session.restoring &&
    (session.mode === 'demo' || session.connected);
  watch(
    () =>
      [
        session.game,
        session.restoring,
        session.connected,
        session.mode,
      ] as const,
    (_value, oldValue) => {
      const next = session.game;
      audio.track =
        next && !['lobby', 'matchEnd'].includes(next.phase) ? 'game' : 'lobby';
      if (!live()) {
        previous = null;
        lastWarning = null;
        return;
      }
      if (next) {
        const newPractice =
          session.mode === 'demo' &&
          oldValue?.[3] !== 'demo' &&
          next.phase === 'grand' &&
          next.round === 1 &&
          audio.unlocked;
        const cue = newPractice
          ? 'shuffle'
          : effectForTransition(previous, next);
        if (cue) void audio.playEffect(cue);
      }
      previous = next;
    },
    { immediate: true },
  );
  function gesture(event: Event) {
    if (event.isTrusted) void audio.unlock();
  }
  function visibility() {
    previous = null;
    lastWarning = null;
    if (document.hidden) audio.suspend();
    else {
      previous = live() ? session.game : null;
      if (audio.unlocked) void audio.unlock();
    }
  }
  onMounted(() => {
    document.addEventListener('pointerdown', gesture);
    document.addEventListener('keydown', gesture);
    document.addEventListener('visibilitychange', visibility);
    timer = setInterval(() => {
      const key = live() ? warningKey(session.game, Date.now()) : null;
      if (key && key !== lastWarning) void audio.playEffect('time');
      lastWarning = key;
    }, 200);
  });
  onUnmounted(() => {
    clearInterval(timer);
    audio.suspend();
    document.removeEventListener('pointerdown', gesture);
    document.removeEventListener('keydown', gesture);
    document.removeEventListener('visibilitychange', visibility);
  });
}
