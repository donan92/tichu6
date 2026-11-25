import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { composeMusic } from '../../src/audio/music';
import { renderEffect } from '../../src/audio/effects';
import { useAudioStore } from '../../src/stores/audio';

vi.mock('../../src/audio/music', () => ({ composeMusic: vi.fn() }));
vi.mock('../../src/audio/effects', () => ({ renderEffect: vi.fn() }));
const sources: {
  buffer: unknown;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}[] = [];
class Context {
  state = 'running';
  currentTime = 0;
  destination = {};
  createGain() {
    return {
      gain: { setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
      connect: vi.fn(),
    };
  }
  createBufferSource() {
    const source = {
      buffer: undefined as unknown,
      loop: false,
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    sources.push(source);
    return source;
  }
  async resume() {
    this.state = 'running';
  }
  async suspend() {
    this.state = 'suspended';
  }
  async close() {
    this.state = 'closed';
  }
}
let pinia: ReturnType<typeof createPinia>;
beforeEach(() => {
  localStorage.clear();
  sources.length = 0;
  pinia = createPinia();
  setActivePinia(pinia);
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal('OfflineAudioContext', class {});
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.mocked(composeMusic).mockReset();
  vi.mocked(renderEffect).mockReset();
});
afterEach(() => {
  disposePinia(pinia);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function pendingBuffer() {
  let resolve!: (buffer: AudioBuffer) => void;
  const promise = new Promise<AudioBuffer>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

it('never starts music muted while an offline render is pending', async () => {
  const pending = pendingBuffer();
  vi.mocked(composeMusic).mockReturnValue(pending.promise);
  const audio = useAudioStore();
  await audio.unlock();
  audio.settings.music = false;
  await nextTick();
  pending.resolve({} as AudioBuffer);
  await flushPromises();
  expect(sources).toHaveLength(0);
});

it('starts only the latest track after out-of-order renders, without restarting for volume changes', async () => {
  const lobby = pendingBuffer(),
    game = pendingBuffer();
  vi.mocked(composeMusic).mockImplementation((track) =>
    track === 'lobby' ? lobby.promise : game.promise,
  );
  const audio = useAudioStore();
  await audio.unlock();
  audio.track = 'game';
  await nextTick();
  const gameBuffer = {} as AudioBuffer;
  game.resolve(gameBuffer);
  await flushPromises();
  lobby.resolve({} as AudioBuffer);
  await flushPromises();
  expect(sources).toHaveLength(1);
  expect(sources[0].buffer).toBe(gameBuffer);
  audio.settings.musicVolume = 15;
  await nextTick();
  expect(sources).toHaveLength(1);
  expect(sources[0].stop).not.toHaveBeenCalled();
});

it('cancels pending effects when muted or suspended and never queues them before unlock', async () => {
  vi.mocked(composeMusic).mockResolvedValue({} as AudioBuffer);
  const audio = useAudioStore();
  audio.settings.music = false;
  await nextTick();
  await audio.playEffect('bomb');
  expect(renderEffect).not.toHaveBeenCalled();
  await audio.unlock();
  const pending = pendingBuffer();
  vi.mocked(renderEffect).mockReturnValue(pending.promise);
  const playing = audio.playEffect('bomb');
  audio.settings.effects = false;
  await nextTick();
  pending.resolve({} as AudioBuffer);
  await playing;
  expect(sources).toHaveLength(0);
  audio.settings.effects = true;
  await nextTick();
  const second = pendingBuffer();
  vi.mocked(renderEffect).mockReturnValue(second.promise);
  const next = audio.playEffect('dragon');
  audio.suspend();
  second.resolve({} as AudioBuffer);
  await next;
  expect(sources).toHaveLength(0);
});
