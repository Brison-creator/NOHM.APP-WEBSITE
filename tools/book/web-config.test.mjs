// node --test tools/book
// The site reads the Stripe key and the Google client from the server
// (GET /config/web) and keeps no copy of its own; when the server can't
// say, both are off (fail closed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeWebConfig, createWebConfig } from '../../public/nohm/web-config.js';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');

test('the site carries no Stripe key or Google client of its own', () => {
  const cfg = fs.readFileSync(path.join(PUBLIC, 'book/config.js'), 'utf8');
  assert.doesNotMatch(cfg, /pk_(live|test)_/, 'no publishable key in config.js');
  assert.doesNotMatch(cfg, /stripePublishableKey\s*:/);
  assert.doesNotMatch(cfg, /googleClientId\s*:/);
  for (const f of ['book/ui/screens.js', 'nohm/account.js', 'book/app.js', 'join/app.js']) {
    const src = fs.readFileSync(path.join(PUBLIC, f), 'utf8');
    assert.doesNotMatch(src, /config\.(stripePublishableKey|googleClientId)/, `${f} reads the keys from the server, not config.js`);
    assert.doesNotMatch(src, /pk_(live|test)_/, `${f} has no key`);
  }
});

test('only well-formed public values are used', () => {
  assert.deepEqual(normalizeWebConfig({ stripePublishableKey: 'pk_live_abc123', googleClientId: '123-x.apps.googleusercontent.com' }), { stripePublishableKey: 'pk_live_abc123', googleClientId: '123-x.apps.googleusercontent.com' });
  assert.deepEqual(normalizeWebConfig({ stripePublishableKey: null, googleClientId: null }), { stripePublishableKey: null, googleClientId: null });
  assert.deepEqual(normalizeWebConfig({ stripePublishableKey: '', googleClientId: '  ' }), { stripePublishableKey: null, googleClientId: null });
  assert.equal(normalizeWebConfig({ stripePublishableKey: 'sk_live_secret' }).stripePublishableKey, null, 'never a secret key');
  assert.equal(normalizeWebConfig({ stripePublishableKey: 'rk_live_x' }).stripePublishableKey, null);
  assert.deepEqual(normalizeWebConfig(null), { stripePublishableKey: null, googleClientId: null });
  assert.deepEqual(normalizeWebConfig('nope'), { stripePublishableKey: null, googleClientId: null });
});

test('asked once and shared; a failed call means both features off, and is asked again later', async () => {
  let calls = 0;
  let fail = true;
  const api = { webConfig: async () => { calls++; if (fail) throw new Error('503'); return { stripePublishableKey: 'pk_test_ok1', googleClientId: 'g1' }; } };
  const webConfig = createWebConfig(api);
  assert.deepEqual(await webConfig(), { stripePublishableKey: null, googleClientId: null });
  fail = false;
  const [a, b] = await Promise.all([webConfig(), webConfig()]);
  assert.deepEqual(a, { stripePublishableKey: 'pk_test_ok1', googleClientId: 'g1' });
  assert.equal(a, b);
  await webConfig();
  assert.equal(calls, 2, 'one failed call, then one shared answer');
});
