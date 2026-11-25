// Original straight-time jazz-synth arrangements approved in the sound preview.
export type MusicTrack = 'lobby' | 'game';
const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);
export async function composeMusic(which: MusicTrack): Promise<AudioBuffer> {
  const quiet = which === 'game',
    beat = 60 / (quiet ? 88 : 96),
    length = 24 * 4 * beat,
    sr = 32000,
    frames = Math.round(length * sr),
    c = new OfflineAudioContext(2, frames + sr * 2, sr);
  const bus = c.createGain(),
    low = c.createBiquadFilter();
  bus.gain.value = quiet ? 0.82 : 0.78;
  low.type = 'lowpass';
  low.frequency.value = quiet ? 1450 : 3800;
  low.Q.value = 0.55;
  bus.connect(low);
  low.connect(c.destination);
  function note(
    t: number,
    d: number,
    n: number,
    amp: number,
    kind = 'ep',
    pan = 0,
  ) {
    const o = c.createOscillator(),
      g = c.createGain(),
      p = c.createStereoPanner();
    p.pan.value = pan;
    o.frequency.value = hz(n);
    o.type = kind === 'bass' ? 'triangle' : 'sine';
    const attack = kind === 'pad' ? 0.12 : 0.012;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + attack);
    g.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, amp * 0.32),
      t + d * 0.65,
    );
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    if (kind === 'ep') {
      const m = c.createOscillator(),
        mg = c.createGain();
      m.frequency.value = hz(n) * 2;
      mg.gain.setValueAtTime(hz(n) * (quiet ? 0.16 : 0.42), t);
      mg.gain.exponentialRampToValueAtTime(hz(n) * 0.015, t + d * 0.7);
      m.connect(mg);
      mg.connect(o.frequency);
      m.start(t);
      m.stop(t + d + 0.02);
    }
    o.connect(g);
    g.connect(p);
    p.connect(bus);
    o.start(t);
    o.stop(t + d + 0.02);
  }
  let seed = 4619;
  function brush(t: number, amp: number, hat = false) {
    const d = hat ? 0.045 : 0.13,
      b = c.createBuffer(1, Math.ceil(sr * d), sr),
      a = b.getChannelData(0);
    for (let i = 0; i < a.length; i++) {
      seed = (seed * 16807) % 2147483647;
      const x = i / sr;
      a[i] =
        ((seed / 2147483647) * 2 - 1) *
        Math.min(1, x / 0.004) *
        Math.exp(-x / (hat ? 0.009 : 0.026)) *
        amp;
    }
    const s = c.createBufferSource(),
      f = c.createBiquadFilter();
    s.buffer = b;
    f.type = 'bandpass';
    f.frequency.value = quiet ? 850 : hat ? 3600 : 1550;
    f.Q.value = 0.6;
    s.connect(f);
    f.connect(bus);
    s.start(t);
  }
  function kick(t: number) {
    const o = c.createOscillator(),
      g = c.createGain();
    o.frequency.setValueAtTime(100, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(quiet ? 0.12 : 0.18, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.2);
  }
  const harmony = quiet
    ? [
        [45, 55, 60, 64, 71],
        [50, 53, 60, 64, 69],
        [43, 53, 59, 64, 69],
        [48, 55, 59, 62, 64],
        [41, 53, 57, 60, 64],
        [46, 56, 60, 62, 65],
        [40, 50, 56, 59, 62],
        [45, 55, 60, 64, 71],
      ]
    : [
        [48, 52, 59, 62, 67],
        [45, 55, 60, 64, 71],
        [50, 53, 60, 64, 69],
        [43, 53, 59, 64, 69],
        [52, 55, 62, 66, 71],
        [45, 55, 61, 64, 70],
        [50, 53, 60, 64, 69],
        [43, 53, 59, 63, 68],
      ];
  const phrases = [
    [
      [0.5, 76, 0.45],
      [1.17, 79, 0.3],
      [2, 74, 0.6],
      [3.17, 71, 0.45],
    ],
    [
      [0.17, 72, 0.6],
      [1.5, 76, 0.35],
      [2.17, 79, 0.6],
    ],
    [
      [0.5, 77, 0.45],
      [1.17, 76, 0.3],
      [2, 72, 0.6],
      [3.17, 69, 0.45],
    ],
    [
      [0.17, 71, 0.5],
      [1.5, 74, 0.35],
      [2.17, 76, 0.5],
      [3.17, 74, 0.35],
    ],
    [
      [0.5, 78, 0.5],
      [1.17, 79, 0.3],
      [2, 74, 0.7],
    ],
    [
      [0.17, 76, 0.5],
      [1.5, 73, 0.3],
      [2.17, 70, 0.7],
    ],
    [
      [0.5, 69, 0.4],
      [1.17, 72, 0.3],
      [2, 76, 0.5],
      [3.17, 74, 0.4],
    ],
    [
      [0.17, 71, 0.5],
      [1.5, 68, 0.35],
      [2.17, 67, 0.65],
    ],
  ];
  for (let bar = 0; bar < 24; bar++) {
    const t = bar * 4 * beat,
      ch = harmony[bar % 8],
      bridge = bar >= 8 && bar < 16;
    kick(t);
    if (!quiet || bar % 2 === 0) kick(t + 2 * beat);
    [1, 3].forEach((b) => brush(t + b * beat, quiet ? 0.065 : 0.12));
    if (!quiet)
      for (let k = 0; k < 8; k++)
        brush(t + k * 0.5 * beat, k % 2 ? 0.035 : 0.05, true);
    const bass = quiet
      ? [
          [0, ch[0], 1.35],
          [2, ch[0] + 7, 0.9],
        ]
      : [
          [0, ch[0], 0.65],
          [1, ch[0] + 7, 0.3],
          [2, ch[0] + 12, 0.65],
          [bar % 4 === 3 ? 3.5 : 3, harmony[(bar + 1) % 8][0] - 1, 0.3],
        ];
    bass.forEach(([b, n, d]) =>
      note(t + b * beat, d * beat, n, quiet ? 0.16 : 0.19, 'bass'),
    );
    const comp = quiet
      ? [
          [0, 1.7],
          [bar % 4 === 3 ? 2.5 : 2, 1.05],
        ]
      : [[0, 0.72], [2, 0.65], ...(bar % 4 === 3 ? [[3.5, 0.28]] : [])];
    comp.forEach(([b, d]) =>
      ch
        .slice(1)
        .forEach((n, i) =>
          note(
            t + b * beat + i * 0.008,
            d * beat,
            quiet && n > 64 ? n - 12 : n,
            quiet ? 0.038 : 0.047,
            'ep',
            i % 2 ? 0.22 : -0.22,
          ),
        ),
    );
    if (quiet) {
      if (bar % 2 === 0) {
        note(t + beat, 1.2 * beat, ch[3], 0.048, 'pad', -0.12);
        note(t + 3 * beat, 0.85 * beat, ch[2], 0.04, 'ep', 0.12);
      }
    } else {
      phrases[bar % 8]
        .filter((_, i) => !bridge || i % 2 === 0)
        .forEach(([b, n, d]) =>
          note(
            t + (bar % 4 === 3 && b === 2.17 ? 2.5 : Math.round(b)) * beat,
            d * beat,
            bridge ? n - 12 : n,
            bridge ? 0.085 : 0.105,
            'ep',
            -0.08,
          ),
        );
    }
  }
  const raw = await c.startRendering(),
    out = c.createBuffer(2, frames, sr);
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) {
    const a = raw.getChannelData(ch),
      b = out.getChannelData(ch);
    b.set(a.subarray(0, frames));
    for (let i = frames; i < a.length; i++) b[i - frames] += a[i];
    for (const x of b) peak = Math.max(peak, Math.abs(x));
  }
  if (peak > 0.8)
    for (let ch = 0; ch < 2; ch++) {
      const a = out.getChannelData(ch);
      for (let i = 0; i < a.length; i++) a[i] *= 0.8 / peak;
    }
  return out;
}
