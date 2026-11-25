# Game audio

The header speaker opens a native modal with independent music/effect enable
switches and volume sliders, plus a card-effect preview. Values are stored under
`tichu6-audio-v1`; invalid saved values fall back or clamp to 0–100. Storage failure
does not block gameplay. Defaults are music 25%, effects 45%, both enabled.

Audio starts after a pointer or keyboard gesture, subject to browser autoplay
policy. Hidden tabs suspend playback and discard effects; returning resumes the
current music where browser policy permits. Browsers without Web Audio retain
fully functional silent gameplay and show an unavailable message in settings.

## Music and effects

- `src/audio/music.ts`: original approved straight-time jazz-synth arrangements.
  Home/lounge/room lobby and match end use the 96 BPM, 60-second lobby loop.
  Declarations, exchange, play and round end use the 88 BPM, approximately
  65-second game loop, without a high lead or hi-hats and with a 1.45 kHz low-pass.
  Occasional half-beat accents remain; there is no swing. Render tails wrap into
  the beginning of each loop. No external music service, asset download or fee.
- `src/audio/effects.ts`: card, bomb, Small/Large Tichu, arrival, warning, dragon,
  shuffle, own turn, exchange, trick collection, finish, round/match result and
  quiet pass cues. The dragon and shuffle use the revised preview synthesis.
- `src/audio/events.ts`: effects derive only from accepted public snapshots.
  Results/special plays take precedence; only one effect plays at once. Ordinary
  actions may take precedence over the separate own-turn cue. Initial snapshots,
  reconnects, changed rooms/seats and skipped revisions do not replay history.
  Arrival is based on newly occupied human lobby seats, not a global lounge ping.
  Warning ticks occur only for the local active player during the final five
  seconds, never for spectators or the offline reconnect grace countdown.

The Pinia audio store owns a single live AudioContext, independent gain buses,
and lazily cached offline renders (two music loops and bounded effect variants).
Generation counters discard stale renders after mute, track changes, hiding or
disposal. Volume changes preserve playback position. Important effects briefly
reduce music volume. The application composable handles lifecycle and snapshots;
no server/protocol or game-engine changes are required.

## Verification limits

Regression tests cover independent controls, persistence, repeated modal dismissal
and focus restoration, snapshot priorities, warning eligibility and asynchronous
mute/track/suspend races. Local browser checks cover 320/375px layouts, saved
settings after reload, practice-track selection and absence of browser errors.
Desktop viewport checks do not establish physical iPhone Safari audio behavior,
speaker balance or listening quality. Verify those on a device before release.
