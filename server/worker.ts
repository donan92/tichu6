import { Hono } from 'hono';
import { ORIGINS } from './policy.ts';
export { Lounge } from './lounge.ts';
export { GameRoom } from './legacy-game-room.js';

const app = new Hono<{ Bindings: Env }>();
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (origin && !ORIGINS.has(origin)) return c.text('Forbidden', 403);
  if (c.req.method === 'OPTIONS')
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': origin || 'https://tichu6.pages.dev',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  await next();
  // Never wrap or modify a WebSocket upgrade response.
  if (c.res.status !== 101) {
    c.header(
      'Access-Control-Allow-Origin',
      origin || 'https://tichu6.pages.dev',
    );
    c.header('Vary', 'Origin');
    c.header('Cache-Control', 'no-store');
  }
});
app.all('/health', (c) => c.json({ ok: true, version: 6 }));
app.all('/lounge', async (c) => {
  const origin = c.req.header('Origin');
  if (!origin || !ORIGINS.has(origin)) return c.text('Forbidden', 403);
  if (c.env.CONNECTION_LIMIT) {
    const { success } = await c.env.CONNECTION_LIMIT.limit({
      key: c.req.header('CF-Connecting-IP') || 'local',
    });
    if (!success)
      return c.text('Too many connection attempts', 429, {
        'Retry-After': '60',
      });
  }
  return c.env.LOUNGE.get(c.env.LOUNGE.idFromName('public-v1')).fetch(
    c.req.raw,
  );
});
app.notFound((c) => c.json({ code: 'error.upgrade' }, 410));
export default app;
