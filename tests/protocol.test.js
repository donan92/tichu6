import test from 'node:test';
import assert from 'node:assert/strict';
import { gameAction, parseMessage } from '../server/transport/protocol.ts';

test('untrusted messages and choices are validated before entering game services', () => {
  for (const raw of ['null', '[]', '1', '{"type":1}', '{}'])
    assert.throws(() => parseMessage(raw), { code: 'error.invalidRequest' });
  for (const action of [null, [], { type: 'unknown' }])
    assert.throws(() => gameAction(action), { code: 'error.invalidAction' });
  assert.throws(() => gameAction({ type: 'grand', call: 'true' }), {
    code: 'error.invalidCall',
  });
  for (const ids of [null, [1], ['a'.repeat(31)], Array(19).fill('a')])
    assert.throws(() => gameAction({ type: 'play', ids }), {
      code: 'error.invalidCards',
    });
  for (const value of ['1', -1, 15, 1.5, Infinity])
    for (const key of ['wish', 'target', 'phoenixRank'])
      assert.throws(
        () => gameAction({ type: 'play', ids: ['a'], [key]: value }),
        { code: 'error.invalidChoice' },
      );
});
test('validated commands exclude spoofed identity fields and preserve optional gameplay choices', () => {
  assert.deepEqual(
    gameAction({ type: 'grand', call: false, seat: 0, hash: 'spoof' }),
    { type: 'grand', call: false },
  );
  const play = gameAction({ type: 'play', ids: ['a'] });
  assert.equal(play.target, undefined);
  assert.equal(play.wish, undefined);
  assert.equal(play.phoenixRank, undefined);
  assert.equal(gameAction({ type: 'play', ids: ['a'], wish: null }).wish, null);
});
