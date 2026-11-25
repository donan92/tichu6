import { defineStore } from 'pinia';
import { onScopeDispose, reactive, ref, watch } from 'vue';
import { composeMusic } from '../audio/music';
import type { MusicTrack } from '../audio/music';
import { renderEffect } from '../audio/effects';
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
  const available = ref(
    typeof AudioContext !== 'undefined' &&
      typeof OfflineAudioContext !== 'undefined',
  );
  const unlocked = ref(false);
  const failed = ref(false);
  const track = ref<MusicTrack>('lobby');
  let ctx: AudioContext | undefined,
    musicGain: GainNode | undefined,
    effectGain: GainNode | undefined;
  let music: AudioBufferSourceNode | undefined,
    effect: AudioBufferSourceNode | undefined;
  let musicEpoch = 0,
    effectEpoch = 0,
    disposed = false;
  const musicCache = new Map<MusicTrack, Promise<AudioBuffer>>();
  const effectCache = new Map<Effect, Promise<AudioBuffer>>();
  const audible = () =>
    !disposed && unlocked.value && !document.hidden && ctx?.state === 'running';
  function stopMusic() {
    musicEpoch++;
    if (music) {
      music.stop();
      music.disconnect();
      music = undefined;
    }
  }
  function stopEffect() {
    effectEpoch++;
    if (effect) {
      effect.stop();
      effect.disconnect();
      effect = undefined;
    }
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
        musicCache.set(selected, composeMusic(selected));
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
      music.connect(musicGain);
      music.start();
      failed.value = false;
    } catch {
      musicCache.delete(selected);
      failed.value = true;
    }
  }
  async function unlock() {
    if (!available.value || disposed || document.hidden) return;
    try {
      if (!ctx) {
        ctx = new AudioContext();
        musicGain = ctx.createGain();
        effectGain = ctx.createGain();
        musicGain.connect(ctx.destination);
        effectGain.connect(ctx.destination);
        gains();
      }
      if (ctx.state !== 'running') await ctx.resume();
      if (disposed) return;
      unlocked.value = ctx.state === 'running';
      if (unlocked.value && !music) void syncMusic();
    } catch {
      failed.value = true;
    }
  }
  async function playEffect(key: Effect) {
    if (!audible() || !settings.effects || settings.effectsVolume === 0) return;
    stopEffect();
    const epoch = effectEpoch;
    try {
      if (!effectCache.has(key)) effectCache.set(key, renderEffect(key));
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
      effect.connect(effectGain);
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
    stopMusic();
    stopEffect();
    if (ctx?.state === 'running') void ctx.suspend().catch(() => {});
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
    track,
    unlock,
    playEffect,
    suspend,
  };
});
