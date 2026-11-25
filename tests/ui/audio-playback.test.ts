import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { loadAudioFile } from '../../src/audio/files';
import { useAudioStore } from '../../src/stores/audio';

vi.mock('../../src/audio/files', () => ({ loadAudioFile: vi.fn() }));
const sources: {
  buffer: unknown;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}[] = [];
class Context {
  static instances: Context[] = [];
  onstatechange: (() => void) | null = null;
  constructor() {
    Context.instances.push(this);
  }
  state = 'running';
  currentTime = 0;
  destination = {};
  createGain() {
    return {
      gain: {
        setTargetAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
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
  Context.instances = [];
  localStorage.clear();
  sources.length = 0;
  pinia = createPinia();
  setActivePinia(pinia);
  vi.stubGlobal('AudioContext', Context);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.mocked(loadAudioFile).mockReset();
});
afterEach(() => {
  disposePinia(pinia);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('restarts the current file after an interrupted audio session without a visibility event', async () => {
  vi.mocked(loadAudioFile).mockResolvedValue({} as AudioBuffer);
  const audio = useAudioStore();
  await audio.unlock();
  await flushPromises();
  const context = Context.instances[0];
  context.state = 'interrupted';
  context.onstatechange?.();
  expect(audio.needsResume).toBe(true);
  expect(sources[0].stop).toHaveBeenCalled();
  audio.recover();
  await flushPromises();
  expect(audio.needsResume).toBe(false);
  expect(sources).toHaveLength(2);
});

it('waits for a pending background suspend before foreground resume', async () => {
  vi.mocked(loadAudioFile).mockResolvedValue({} as AudioBuffer);
  const audio = useAudioStore();
  await audio.unlock();
  await flushPromises();
  const context = Context.instances[0];
  let finish!: () => void;
  vi.spyOn(context, 'suspend').mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = () => {
          context.state = 'suspended';
          resolve();
        };
      }),
  );
  const resume = vi.spyOn(context, 'resume');
  audio.suspend();
  audio.recover();
  await flushPromises();
  expect(resume).not.toHaveBeenCalled();
  finish();
  await flushPromises();
  expect(context.state).toBe('running');
  expect(sources).toHaveLength(2);
});

it('times out a stuck Safari resume and recreates the context on the next user tap', async () => {
  vi.mocked(loadAudioFile).mockResolvedValue({} as AudioBuffer);
  const audio = useAudioStore();
  await audio.unlock();
  await flushPromises();
  const context = Context.instances[0];
  context.state = 'interrupted';
  context.onstatechange?.();
  vi.spyOn(context, 'resume').mockImplementation(
    () => new Promise<void>(() => {}),
  );
  vi.useFakeTimers();
  audio.recover();
  await vi.advanceTimersByTimeAsync(1600);
  expect(audio.needsResume).toBe(true);
  expect(audio.failed).toBe(true);
  await audio.unlock();
  await vi.advanceTimersByTimeAsync(0);
  expect(Context.instances).toHaveLength(2);
  expect(audio.needsResume).toBe(false);
  expect(audio.failed).toBe(false);
  expect(context.state).toBe('closed');
});
function pendingBuffer() {
  let resolve!: (buffer: AudioBuffer) => void;
  const promise = new Promise<AudioBuffer>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

it('never starts music muted while an file decode is pending', async () => {
  const pending = pendingBuffer();
  vi.mocked(loadAudioFile).mockReturnValue(pending.promise);
  const audio = useAudioStore();
  await audio.unlock();
  audio.settings.music = false;
  await nextTick();
  pending.resolve({} as AudioBuffer);
  await flushPromises();
  expect(sources).toHaveLength(0);
});

it('starts only the latest track after out-of-order downloads, without restarting for volume changes', async () => {
  const lobby = pendingBuffer(),
    game = pendingBuffer();
  vi.mocked(loadAudioFile).mockImplementation((_context, track) =>
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
  vi.mocked(loadAudioFile).mockResolvedValue({} as AudioBuffer);
  const audio = useAudioStore();
  audio.settings.music = false;
  await nextTick();
  await audio.playEffect('bomb');
  expect(loadAudioFile).not.toHaveBeenCalled();
  await audio.unlock();
  const pending = pendingBuffer();
  vi.mocked(loadAudioFile).mockReturnValue(pending.promise);
  const playing = audio.playEffect('bomb');
  audio.settings.effects = false;
  await nextTick();
  pending.resolve({} as AudioBuffer);
  await playing;
  expect(sources).toHaveLength(0);
  audio.settings.effects = true;
  await nextTick();
  const second = pendingBuffer();
  vi.mocked(loadAudioFile).mockReturnValue(second.promise);
  const next = audio.playEffect('dragon');
  audio.suspend();
  second.resolve({} as AudioBuffer);
  await next;
  expect(sources).toHaveLength(0);
});
