import lobby from '../assets/audio/lobby.mp3?url';
import game from '../assets/audio/game.mp3?url';
import card from '../assets/audio/card.mp3?url';
import bomb from '../assets/audio/bomb.mp3?url';
import small from '../assets/audio/small.mp3?url';
import large from '../assets/audio/large.mp3?url';
import join from '../assets/audio/join.mp3?url';
import time from '../assets/audio/time.mp3?url';
import dragon from '../assets/audio/dragon.mp3?url';
import shuffle from '../assets/audio/shuffle.mp3?url';
import turn from '../assets/audio/turn.mp3?url';
import exchange from '../assets/audio/exchange.mp3?url';
import collect from '../assets/audio/collect.mp3?url';
import finish from '../assets/audio/finish.mp3?url';
import round from '../assets/audio/round.mp3?url';
import win from '../assets/audio/win.mp3?url';
import lose from '../assets/audio/lose.mp3?url';
import pass from '../assets/audio/pass.mp3?url';
import type { Effect } from './events';
export type MusicTrack = 'lobby' | 'game';
const assets: Record<MusicTrack | Effect, string> = {
  lobby,
  game,
  card,
  bomb,
  small,
  large,
  join,
  time,
  dragon,
  shuffle,
  turn,
  exchange,
  collect,
  finish,
  round,
  win,
  lose,
  pass,
};
export async function loadAudioFile(
  context: AudioContext,
  name: MusicTrack | Effect,
): Promise<AudioBuffer> {
  const response = await fetch(assets[name]);
  if (!response.ok) throw new Error('Audio asset unavailable');
  return context.decodeAudioData(await response.arrayBuffer());
}
