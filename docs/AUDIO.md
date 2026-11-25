# Game audio

The header speaker opens a native modal with independent music/effect switches,
volume sliders and a card-effect preview. Settings persist under
`tichu6-audio-v1`; invalid values fall back or clamp to0–100. Defaults are music25%,
effects45%, both enabled. Storage failures never block the game.

## File playback

All sound comes from18 committed MP3 files under `src/assets/audio`, approximately
2.91MB in total. There are no runtime oscillators, noise generators, synthesis or
OfflineAudioContexts. The assets retain the approved compositions and revised
cues; see the asset README for provenance and encoding. This is a delivery change,
not a claim that the synthesized timbres have become studio recordings.

`src/audio/files.ts` loads content-hashed asset URLs and decodes them at the
playback AudioContext's sample rate. The Pinia store caches decoded files and
controls separate music/effect gain buses. Web Audio is used solely for playback
and volume control, with a playback latency hint and short per-source fades.
This preserves independent volume controls on iOS, where media element volume
has historically been restricted; see Apple's
[Safari media guide](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html).

Music starts following a user gesture. Hidden tabs suspend sound and discard
stale effects; returning resumes music when browser autoplay policy permits.
Pending downloads cannot start after mute, track change, hiding or disposal.
Volume adjustments preserve playback position. Important effects briefly duck
music. Unsupported browsers retain silent gameplay.

The96 BPM lobby track plays on home/lounge/room lobby and match end. The88 BPM
mellow game track covers declarations, exchange, play and round end. It omits high
leads/hi-hats and was mastered with a1.45kHz low-pass. Both are straight-time with
occasional half-beat accents. MP3 loop boundaries may have a brief decoder gap on
some browsers; no seamless-loop claim is made for all devices.

## Event cues

`src/audio/events.ts` selects one cue from public accepted snapshots: card, bomb,
Small/Large Tichu, arrival, deadline warning, dragon, shuffle, own turn, exchange,
trick collection, finish, round/match result and quiet pass. Results and special
plays take priority. Baselines, reconnects, changed rooms/seats and revision gaps
never replay history. A match's seat randomization still allows the deal cue.
Warnings apply only to the active local player's final five seconds, excluding
spectators and reconnect grace. Arrivals are newly occupied human room-lobby
seats, not global lounge pings.

## Verification limits

Tests cover settings, modal dismissal/focus, snapshot priorities, warning gates,
asynchronous mute/track/suspend races and preservation of playback position.
Encoded files are decoded and checked for valid format, finite output and headroom.
Local/production browser checks cannot establish real iPhone speaker behavior.
The user reported iPhone crackling in v0.8.25. Its exact cause remains unconfirmed;
a real-device listening check is required after the file-playback release.
