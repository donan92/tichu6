import { defineStore } from 'pinia';
import { onScopeDispose, reactive, ref, watch } from 'vue';
import { loadAudioFile } from '../audio/files';
import type { MusicTrack } from '../audio/files';
import type { Effect } from '../audio/events';

const storageKey = 'tichu6-audio-v1';
export interface AudioSettings {
  music: boolean;
  effects: boolean;
  musicVolume: number;
  effectsVolume: number;
}
export function readAudioSettings(value: string | null): AudioSettings {
  const result: AudioSettings = {
    music: true,
    effects: true,
    musicVolume: 25,
    effectsVolume: 45,
  };
  try {
    const parsed: unknown = JSON.parse(value ?? 'null');
    if (parsed && typeof parsed === 'object') {
      const data = parsed as Record<string, unknown>;
      for (const key of ['music', 'effects'] as const)
        if (key in data && typeof data[key] === 'boolean')
          result[key] = data[key];
      for (const key of ['musicVolume', 'effectsVolume'] as const)
        if (
          key in data &&
          typeof data[key] === 'number' &&
          Number.isFinite(data[key])
        )
          result[key] = Math.max(0, Math.min(100, data[key]));
    }
  } catch {
    /* Corrupt or unavailable storage must not block playing. */
  }
  return result;
}

export const useAudioStore = defineStore('audio', () => {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(storageKey);
  } catch {
    /* Private browsing. */
  }
  const settings = reactive(readAudioSettings(saved));
  const available = ref(typeof AudioContext !== 'undefined');
  const unlocked = ref(false);
  const failed = ref(false);
  const needsResume = ref(false);
  const track = ref<MusicTrack>('lobby');
  let ctx: AudioContext | undefined,
    musicGain: GainNode | undefined,
    effectGain: GainNode | undefined;
  let music: AudioBufferSourceNode | undefined,
    effect: AudioBufferSourceNode | undefined;
  let musicFade: GainNode | undefined, effectFade: GainNode | undefined;
  let musicEpoch = 0,
    effectEpoch = 0,
    disposed = false;
  let resumeEpoch = 0;
  let suspending: Promise<void> = Promise.resolve();
  let pendingSuspend: AudioContext | undefined;
  const musicCache = new Map<MusicTrack, Promise<AudioBuffer>>();
  const effectCache = new Map<Effect, Promise<AudioBuffer>>();
  const audible = () =>
    !disposed && unlocked.value && !document.hidden && ctx?.state === 'running';
  function stopMusic() {
    musicEpoch++;
    if (music) {
      fadeOut(music, musicFade);
      music = undefined;
    }
  }
  function stopEffect() {
    effectEpoch++;
    if (effect) {
      fadeOut(effect, effectFade);
      effect = undefined;
    }
  }
  function fadeOut(source: AudioBufferSourceNode, fade?: GainNode) {
    if (ctx && fade && ctx.state === 'running') {
      fade.gain.cancelScheduledValues(ctx.currentTime);
      fade.gain.setTargetAtTime(0, ctx.currentTime, 0.006);
      source.stop(ctx.currentTime + 0.03);
    } else source.stop();
    source.onended = () => {
      source.disconnect();
      fade?.disconnect();
    };
  }
  function fadeIn(
    source: AudioBufferSourceNode,
    destination: GainNode,
  ): GainNode {
    const fade = ctx!.createGain();
    fade.gain.setValueAtTime(0, ctx!.currentTime);
    fade.gain.linearRampToValueAtTime(1, ctx!.currentTime + 0.012);
    source.connect(fade);
    fade.connect(destination);
    source.onended = () => {
      source.disconnect();
      fade.disconnect();
    };
    return fade;
  }
  function gains() {
    if (!ctx) return;
    musicGain?.gain.setTargetAtTime(
      settings.music ? settings.musicVolume / 100 : 0,
      ctx.currentTime,
      0.04,
    );
    effectGain?.gain.setTargetAtTime(
      settings.effects ? settings.effectsVolume / 100 : 0,
      ctx.currentTime,
      0.025,
    );
  }
  async function syncMusic() {
    stopMusic();
    if (!audible() || !settings.music || settings.musicVolume === 0) return;
    const epoch = musicEpoch,
      selected = track.value;
    try {
      if (!musicCache.has(selected))
        musicCache.set(selected, loadAudioFile(ctx!, selected));
      const buffer = await musicCache.get(selected)!;
      if (
        epoch !== musicEpoch ||
        !audible() ||
        !settings.music ||
        !ctx ||
        !musicGain
      )
        return;
      music = ctx.createBufferSource();
      music.buffer = buffer;
      music.loop = true;
      musicFade = fadeIn(music, musicGain);
      music.start();
      failed.value = false;
    } catch {
      musicCache.delete(selected);
      failed.value = true;
    }
  }
  async function withResumeTimeout(operation: Promise<void>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Audio resume timed out')),
            1500,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async function unlock(userGesture = true) {
    if (!available.value || disposed || document.hidden) return;
    const attempt = ++resumeEpoch;
    try {
      // A fresh context created by a real tap can recover Safari's stuck
      // interrupted context. Never discard a healthy, already-running context.
      if (
        ctx &&
        userGesture &&
        (pendingSuspend === ctx ||
          (ctx.state !== 'running' && (needsResume.value || failed.value)))
      ) {
        const old = ctx;
        stopMusic();
        stopEffect();
        old.onstatechange = null;
        ctx = undefined;
        void old.close().catch(() => {});
        suspending = Promise.resolve();
        pendingSuspend = undefined;
      }
      if (!ctx) {
        ctx = new AudioContext({ latencyHint: 'playback' });
        musicGain = ctx.createGain();
        effectGain = ctx.createGain();
        musicGain.connect(ctx.destination);
        effectGain.connect(ctx.destination);
        const owned = ctx;
        owned.onstatechange = () => {
          if (disposed || ctx !== owned) return;
          if (owned.state !== 'running') {
            stopMusic();
            stopEffect();
            needsResume.value = unlocked.value;
          } else if (!document.hidden && unlocked.value) {
            needsResume.value = false;
            if (!music) void syncMusic();
          }
        };
        gains();
      }
      const owned = ctx;
      if (!userGesture) await withResumeTimeout(suspending);
      if (attempt !== resumeEpoch || disposed || document.hidden) return;
      if (owned.state !== 'running') await withResumeTimeout(owned.resume());
      if (
        disposed ||
        ctx !== owned ||
        attempt !== resumeEpoch ||
        document.hidden
      )
        return;
      if (owned.state !== 'running')
        throw new Error('Audio remains interrupted');
      unlocked.value = true;
      needsResume.value = false;
      failed.value = false;
      if (!music) void syncMusic();
    } catch {
      if (attempt === resumeEpoch && !disposed) {
        failed.value = true;
        needsResume.value = true;
      }
    }
  }
  async function playEffect(key: Effect) {
    if (!audible() || !settings.effects || settings.effectsVolume === 0) return;
    stopEffect();
    const epoch = effectEpoch;
    try {
      if (!effectCache.has(key)) effectCache.set(key, loadAudioFile(ctx!, key));
      const buffer = await effectCache.get(key)!;
      if (
        epoch !== effectEpoch ||
        !audible() ||
        !settings.effects ||
        !ctx ||
        !effectGain
      )
        return;
      effect = ctx.createBufferSource();
      effect.buffer = buffer;
      effectFade = fadeIn(effect, effectGain);
      effect.start();
      if (
        ['bomb', 'dragon', 'large', 'round', 'win', 'lose'].includes(key) &&
        musicGain
      ) {
        const volume = settings.music ? settings.musicVolume / 100 : 0;
        musicGain.gain.cancelScheduledValues(ctx.currentTime);
        musicGain.gain.setTargetAtTime(volume * 0.45, ctx.currentTime, 0.025);
        musicGain.gain.setTargetAtTime(volume, ctx.currentTime + 1, 0.15);
      }
    } catch {
      effectCache.delete(key);
      failed.value = true;
    }
  }
  function suspend() {
    resumeEpoch++;
    needsResume.value = unlocked.value;
    stopMusic();
    stopEffect();
    if (ctx?.state === 'running' && pendingSuspend !== ctx) {
      const owned = ctx;
      pendingSuspend = owned;
      suspending = owned
        .suspend()
        .catch(() => {})
        .finally(() => {
          if (pendingSuspend === owned) pendingSuspend = undefined;
        });
    }
  }
  function recover() {
    if (!unlocked.value || document.hidden || disposed) return;
    stopMusic();
    stopEffect();
    void unlock(false);
  }
  watch(settings, () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      /* Best effort. */
    }
    if (ctx) {
      musicGain?.gain.cancelScheduledValues(ctx.currentTime);
      effectGain?.gain.cancelScheduledValues(ctx.currentTime);
    }
    gains();
    if (!settings.effects || settings.effectsVolume === 0) stopEffect();
  });
  watch(
    [() => settings.music, () => settings.musicVolume > 0, () => track.value],
    () => {
      void syncMusic();
    },
  );
  onScopeDispose(() => {
    disposed = true;
    stopMusic();
    stopEffect();
    if (ctx) void ctx.close().catch(() => {});
  });
  return {
    settings,
    available,
    unlocked,
    failed,
    needsResume,
    track,
    unlock,
    playEffect,
    suspend,
    recover,
  };
});
