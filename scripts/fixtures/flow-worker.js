// Test-only endpoints. Never imported by production wrangler.jsonc.
import worker, { GameRoom, RoomEngine } from '../../server/worker.ts';
import { Lounge } from '../../server/lounge.ts';
import { deck, newGame, startRound } from '../../src/game.js';
import { syncDeadline } from '../../src/game-clock.ts';
export { GameRoom, RoomEngine };
export class TestLounge extends Lounge {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/__flow')) {
      await this.exclusive(async () => {
        const r = Object.values(this.data.rooms)[0];
        if (!r) throw new Error('Create a test room first');
        if (path === '/__flow-age') r.state.deadline = Date.now() + 1500;
        else if (path === '/__flow-preparation') {
          const s = startRound(
            newGame(['Clock', 'Two', 'Three', 'Four', 'Five', 'Six']),
          );
          s.revision = r.state.revision + 1;
          r.state = s;
          for (let i = 1; i < 6; i++)
            r.members[i] = { hash: `fixture-${i}`, offlineSince: Date.now() };
          syncDeadline(s);
        } else {
          const oldRevision = r.state.revision;
          const s = startRound(
            newGame(['Clock', 'Two', 'Three', 'Four', 'Five', 'Six']),
          );
          const cards = deck();
          s.hands = Array.from({ length: 6 }, (_, i) =>
            cards.filter((c) => !c.special && c.rank === i + 3).slice(0, 2),
          );
          const dragon = cards.find((c) => c.special === 'dragon');
          const top =
            path === '/__flow-trick' ? dragon : cards.find((c) => c.rank === 2);
          s.phase = path === '/__flow-trick' ? 'trick' : 'play';
          s.turn = 0;
          s.last = s.phase === 'trick' ? 0 : 5;
          s.top = {
            kind: 'single',
            power: top.rank,
            size: 1,
            bomb: 0,
            cards: [top],
          };
          s.pile = [top];
          s.log = [
            {
              code: 'log.play',
              params: {
                name: 'Clock',
                kind: 'single',
                power: top.rank,
                size: 1,
                bomb: 0,
                count: 1,
              },
            },
          ];
          s.trickHistory = [
            {
              round: 1,
              trick: 0,
              entries: [{ code: 'previous-trick-marker' }],
            },
          ];
          if (path === '/__flow-dog') {
            s.top = null;
            s.pile = [];
            s.last = null;
            s.hands[0] = cards.filter((c) =>
              ['dog', 'mahjong'].includes(c.special),
            );
          }
          s.revision = oldRevision + 1;
          r.state = s;
          for (let i = 1; i < 6; i++)
            r.members[i] = { hash: `fixture-${i}`, offlineSince: Date.now() };
          syncDeadline(s);
        }
        await this.persist();
        this.broadcast();
        await this.schedule();
      });
      return new Response('OK');
    }
    return super.fetch(request);
  }
}
export default {
  fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/__flow'))
      return env.LOUNGE.get(env.LOUNGE.idFromName('public-v1')).fetch(request);
    return worker.fetch(request, env);
  },
};
