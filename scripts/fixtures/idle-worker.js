// Local integration fixture only. Production wrangler.jsonc never imports this.
import worker, { GameRoom } from '../../server/worker.js';
import { Lounge } from '../../server/lounge.js';
export { GameRoom };
export class TestLounge extends Lounge {
  async fetch(request) {
    if (new URL(request.url).pathname === '/__age') {
      await this.exclusive(async () => {
        for (const ws of this.users()) {
          const a = this.attachment(ws);
          if (a.name === 'Idle')
            this.data.activity[a.hash] = Date.now() - 30 * 60 * 1000 + 2000;
        }
        await this.persist();
        await this.schedule();
      });
      return new Response('OK');
    }
    return super.fetch(request);
  }
}
export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === '/__age')
      return env.LOUNGE.get(env.LOUNGE.idFromName('public-v1')).fetch(request);
    return worker.fetch(request, env);
  },
};
