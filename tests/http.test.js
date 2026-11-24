import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../server/worker.ts';

const origin = 'https://tichu6.pages.dev';
test('Hono keeps health, preflight, origin rejection and retired routes compatible', async () => {
  const env = {
    get LOUNGE() {
      throw new Error('must not touch storage');
    },
  };
  const health = await app.fetch(
    new Request('https://worker/health', { headers: { origin } }),
    env,
  );
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, version: 6 });
  assert.equal(health.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(health.headers.get('Cache-Control'), 'no-store');
  assert.equal(health.headers.get('Vary'), 'Origin');
  const preflight = await app.fetch(
    new Request('https://worker/lounge', {
      method: 'OPTIONS',
      headers: { origin },
    }),
    env,
  );
  assert.equal(
    preflight.headers.get('Access-Control-Allow-Methods'),
    'POST, GET, OPTIONS',
  );
  for (const headers of [{}, { origin: 'https://evil.example' }]) {
    const response = await app.fetch(
      new Request('https://worker/lounge', { headers }),
      env,
    );
    assert.equal(response.status, 403);
  }
  const retired = await app.fetch(
    new Request('https://worker/rooms', {
      method: 'POST',
      headers: { origin },
    }),
    env,
  );
  assert.equal(retired.status, 410);
  assert.deepEqual(await retired.json(), { code: 'error.upgrade' });
});
test('connection rate limits run before Hono forwards the untouched request to the public Durable Object', async () => {
  let allowed = false,
    forwards = 0;
  const request = new Request('https://worker/lounge', {
    headers: { origin, Upgrade: 'websocket', 'CF-Connecting-IP': '192.0.2.1' },
  });
  const env = {
    CONNECTION_LIMIT: {
      async limit({ key }) {
        assert.equal(key, '192.0.2.1');
        return { success: allowed };
      },
    },
    LOUNGE: {
      idFromName(name) {
        assert.equal(name, 'public-v1');
        return 'id';
      },
      get(id) {
        assert.equal(id, 'id');
        return {
          async fetch(req) {
            forwards++;
            assert.equal(req, request);
            return new Response('forwarded', { status: 426 });
          },
        };
      },
    },
  };
  const denied = await app.fetch(request, env);
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get('Retry-After'), '60');
  assert.equal(forwards, 0);
  allowed = true;
  const accepted = await app.fetch(request, env);
  assert.equal(accepted.status, 426);
  assert.equal(await accepted.text(), 'forwarded');
  assert.equal(forwards, 1);
});

test('training export is disabled without a secret and rejects incorrect credentials', async () => {
  for (const [env, authorization, expected] of [
    [{}, '', 404],
    [{ TRAINING_EXPORT_TOKEN: 'x'.repeat(32) }, 'Bearer wrong', 403],
  ]) {
    const result = await app.fetch(
      new Request('https://example.com/training/export', {
        headers: { Authorization: authorization },
      }),
      env,
    );
    assert.equal(result.status, expected);
  }
});
