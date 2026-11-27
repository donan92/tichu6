import { Hono } from 'hono';
import { ORIGINS } from './policy.ts';
export { RoomEngine } from './game/room-engine.ts';
export { Lounge } from './lounge.ts';
export { GameRoom } from './legacy-game-room.js';

const app = new Hono<{ Bindings: Env & { TRAINING_EXPORT_TOKEN?: string } }>();
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
// The optional operator secret is never exposed to frontend code or public URLs.
app.get('/training/export', async (c) => {
  const expected = c.env.TRAINING_EXPORT_TOKEN;
  const provided = c.req.header('Authorization') || '';
  if (!expected || expected.length < 32 || provided.length > 512)
    return c.text('Not available', 404);
  const digest = async (value: string) =>
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    );
  const [a, b] = await Promise.all([
    digest(provided),
    digest(`Bearer ${expected}`),
  ]);
  if (a.reduce((difference, byte, i) => difference | (byte ^ b[i]), 0) !== 0)
    return c.text('Forbidden', 403);
  return c.env.LOUNGE.get(c.env.LOUNGE.idFromName('public-v1')).fetch(
    new Request('https://internal/training-export'),
  );
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
