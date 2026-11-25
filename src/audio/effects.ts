import type { Effect } from './events';
export function renderEffect(key: Effect): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, 32000 * 2, 32000);
  const master = ctx.createGain();
  master.gain.value = 0.65;
  master.connect(ctx.destination);
  function tone(
    t: number,
    d: number,
    f: number,
    end = f,
    type: OscillatorType = 'triangle',
    amp = 0.25,
  ) {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + d);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + d + 0.01);
  }
  function noise(t: number, d: number, frequency: number, amp = 0.2) {
    const b = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * d),
        ctx.sampleRate,
      ),
      a = b.getChannelData(0);
    let seed = 1703;
    for (let i = 0; i < a.length; i++) {
      seed = (seed * 16807) % 2147483647;
      a[i] = (seed / 2147483647) * 2 - 1;
    }
    const s = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    s.buffer = b;
    f.type = 'bandpass';
    f.frequency.value = frequency;
    f.Q.value = 0.6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f);
    f.connect(g);
    g.connect(master);
    s.start(t);
    s.stop(t + d);
  }
  function sound(key: Effect) {
    const t = ctx.currentTime + 0.025;
    if (key === 'card') {
      noise(t, 0.11, 2600, 0.32);
      tone(t + 0.035, 0.13, 190, 80, 'triangle', 0.35);
    }
    if (key === 'bomb') {
      tone(t, 0.17, 80, 430, 'sawtooth', 0.13);
      noise(t + 0.15, 0.55, 430, 0.7);
      tone(t + 0.15, 0.7, 155, 34, 'sine', 0.7);
      [900, 650, 420, 260].forEach((f, i) =>
        tone(t + 0.26 + i * 0.09, 0.2, f, f * 0.55, 'square', 0.045),
      );
    }
    if (key === 'small')
      [523.25, 659.25, 783.99].forEach((f, i) =>
        tone(t + i * 0.12, 0.3, f, f, 'triangle', 0.18),
      );
    if (key === 'large') {
      tone(t, 0.38, 130.81, 65.4, 'triangle', 0.5);
      [392, 523.25, 659.25, 783.99].forEach((f, i) =>
        tone(t + 0.07 + i * 0.12, 0.4, f, f, 'triangle', 0.17),
      );
      [523.25, 659.25, 783.99].forEach((f) =>
        tone(t + 0.58, 0.55, f, f, 'triangle', 0.16),
      );
    }
    if (key === 'join')
      [392, 523.25].forEach((f, i) => {
        tone(t + i * 0.15, 0.32, f, f, 'sine', 0.32);
        tone(t + i * 0.15, 0.2, f * 2, f * 2, 'triangle', 0.05);
      });
    if (key === 'time') tone(t, 0.09, 620, 620, 'sine', 0.28);
    if (key === 'dragon') {
      const d = 0.8,
        b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * d), ctx.sampleRate),
        a = b.getChannelData(0);
      let phase = 0,
        seed = 923,
        air = 0;
      for (let i = 0; i < a.length; i++) {
        const x = i / ctx.sampleRate,
          u = x / d;
        seed = (seed * 16807) % 2147483647;
        air = 0.88 * air + 0.12 * ((seed / 2147483647) * 2 - 1);
        const hz = x < 0.2 ? 100 + 270 * x : 154 - 120 * (x - 0.2);
        phase += (2 * Math.PI * hz) / ctx.sampleRate;
        const env = Math.min(1, x / 0.045) * Math.pow(1 - u, 1.6);
        a[i] =
          env *
          (0.32 * Math.sin(phase) +
            0.13 * Math.sin(phase * 2 + 0.8 * Math.sin(2 * Math.PI * 21 * x)) +
            0.07 * Math.sin(phase * 3) +
            air * 0.48) *
          (1 + 0.1 * Math.sin(2 * Math.PI * 29 * x));
      }
      const s = ctx.createBufferSource(),
        f = ctx.createBiquadFilter();
      s.buffer = b;
      f.type = 'lowpass';
      f.frequency.setValueAtTime(650, t);
      f.frequency.linearRampToValueAtTime(1600, t + 0.18);
      f.frequency.exponentialRampToValueAtTime(380, t + d);
      s.connect(f);
      f.connect(master);
      s.start(t);
      s.stop(t + d);
    }
    if (key === 'shuffle') {
      const d = 0.76,
        b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * d), ctx.sampleRate),
        a = b.getChannelData(0);
      let seed = 4351;
      function paper(start: number, duration: number, amp: number) {
        let previous = 0,
          low = 0;
        for (let j = 0; j < duration * ctx.sampleRate; j++) {
          seed = (seed * 16807) % 2147483647;
          const r = (seed / 2147483647) * 2 - 1;
          low = 0.52 * low + 0.48 * r;
          const v = low - previous * 0.65;
          previous = low;
          const x = j / ctx.sampleRate,
            en = Math.min(1, x / 0.0015) * Math.exp(-x / (duration * 0.22)),
            i = Math.floor(start * ctx.sampleRate) + j;
          if (i < a.length) a[i] += v * amp * en;
        }
      }
      paper(0, 0.09, 0.16);
      const hits = [
        0.09, 0.123, 0.153, 0.18, 0.204, 0.227, 0.249, 0.27, 0.29, 0.311, 0.335,
        0.363, 0.396, 0.435,
      ];
      hits.forEach((x, i) =>
        paper(x, 0.025 + (i % 3) * 0.004, 0.3 + (i % 4) * 0.045),
      );
      paper(0.51, 0.1, 0.14);
      paper(0.65, 0.045, 0.65);
      paper(0.662, 0.027, 0.25);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(master);
      s.start(t);
      s.stop(t + d);
    }

    if (key === 'turn')
      [294, 392].forEach((f, i) =>
        tone(t + i * 0.12, 0.25, f, f, 'sine', 0.24),
      );
    if (key === 'exchange') {
      noise(t, 0.13, 1800, 0.22);
      [262, 330, 392].forEach((f) =>
        tone(t + 0.09, 0.3, f, f, 'triangle', 0.13),
      );
    }
    if (key === 'collect') {
      noise(t, 0.22, 1300, 0.2);
      tone(t + 0.07, 0.12, 150, 95, 'triangle', 0.2);
    }
    if (key === 'finish')
      [330, 392, 494].forEach((f, i) =>
        tone(t + i * 0.11, 0.3, f, f, 'triangle', 0.17),
      );
    if (key === 'round')
      [262, 330, 392, 494].forEach((f, i) =>
        tone(t + i * 0.045, 0.55, f, f, 'sine', 0.19),
      );
    if (key === 'win')
      [262, 330, 392, 523].forEach((f, i) =>
        tone(t + i * 0.14, 0.6, f, f, 'triangle', 0.19),
      );
    if (key === 'lose')
      [330, 294, 262].forEach((f, i) =>
        tone(t + i * 0.15, 0.5, f, f, 'sine', 0.17),
      );
    if (key === 'pass') tone(t, 0.075, 135, 110, 'sine', 0.14);
  }
  sound(key);
  return ctx.startRendering();
}
