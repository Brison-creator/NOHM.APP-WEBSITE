// node --test tools/book
// The site reads the Stripe key and the Google client from the server
// (GET /config/web) and keeps no copy of its own; when the server can't
// say, both are off (fail closed).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeWebConfig, createWebConfig, LEGACY_WEB_CONFIG } from '../../public/nohm/web-config.js';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');

test('the only built-in key is LEGACY_WEB_CONFIG, for a server without /config/web', () => {
  const cfg = fs.readFileSync(path.join(PUBLIC, 'book/config.js'), 'utf8');
  assert.doesNotMatch(cfg, /pk_(live|test)_/, 'no publishable key in config.js');
  assert.doesNotMatch(cfg, /stripePublishableKey\s*:/);
  assert.doesNotMatch(cfg, /googleClientId\s*:/);
  for (const f of ['book/ui/screens.js', 'nohm/account.js', 'book/app.js', 'join/app.js']) {
    const src = fs.readFileSync(path.join(PUBLIC, f), 'utf8');
    assert.doesNotMatch(src, /config\.(stripePublishableKey|googleClientId)/, `${f} reads the keys from the server, not config.js`);
    assert.doesNotMatch(src, /pk_(live|test)_/, `${f} has no key`);
  }
  const wc = fs.readFileSync(path.join(PUBLIC, 'nohm/web-config.js'), 'utf8');
  assert.equal((wc.match(/pk_live_/g) || []).length, 1, 'one key, in LEGACY_WEB_CONFIG');
  assert.match(wc, /DELETE THIS once api\.nohm\.app serves GET \/config\/web/);
  assert.match(LEGACY_WEB_CONFIG.stripePublishableKey, /^pk_live_51Ssr6TGRifyQNvis/, 'the key 9819e15 shipped');
  assert.equal(LEGACY_WEB_CONFIG.googleClientId, '', 'no Google client was set then');
});

test('only well-formed public values are used', () => {
  assert.deepEqual(normalizeWebConfig({ stripePublishableKey: 'pk_live_abc123', googleClientId: '123-x.apps.googleusercontent.com' }), { stripePublishableKey: 'pk_live_abc123', googleClientId: '123-x.apps.googleusercontent.com' });
  assert.deepEqual(normalizeWebConfig({ stripePublishableKey: null, googleClientId: null }), { stripePublishableKey: null, googleClientId: null });
  assert.deepEqual(normalizeWebConfig({ stripePublishableKey: '', googleClientId: '  ' }), { stripePublishableKey: null, googleClientId: null });
  assert.equal(normalizeWebConfig({ stripePublishableKey: 'sk_live_secret' }).stripePublishableKey, null, 'never a secret key');
  assert.equal(normalizeWebConfig({ stripePublishableKey: 'rk_live_x' }).stripePublishableKey, null);
  assert.equal(normalizeWebConfig({ googleClientId: 'g1' }).googleClientId, null, 'not a Google client id');
  assert.equal(normalizeWebConfig({ googleClientId: 'x.apps.googleusercontent.com.evil.example' }).googleClientId, null);
  assert.equal(normalizeWebConfig({ googleClientId: ' 832397285346-abc.apps.googleusercontent.com ' }).googleClientId, '832397285346-abc.apps.googleusercontent.com');
  assert.deepEqual(normalizeWebConfig(null), { stripePublishableKey: null, googleClientId: null });
  assert.deepEqual(normalizeWebConfig('nope'), { stripePublishableKey: null, googleClientId: null });
});

test('asked once and shared; a failed call means both features off, and is asked again later', async () => {
  let calls = 0;
  let fail = true;
  const api = { webConfig: async () => { calls++; if (fail) throw Object.assign(new Error('503'), { status: 503 }); return { stripePublishableKey: 'pk_test_ok1', googleClientId: 'g1.apps.googleusercontent.com' }; } };
  const webConfig = createWebConfig(api);
  assert.deepEqual(await webConfig(), { stripePublishableKey: null, googleClientId: null, legacy: false, phoneSignup: true });
  fail = false;
  const [a, b] = await Promise.all([webConfig(), webConfig()]);
  assert.deepEqual(a, { stripePublishableKey: 'pk_test_ok1', googleClientId: 'g1.apps.googleusercontent.com', legacy: false, phoneSignup: true });
  assert.equal(a, b);
  await webConfig();
  assert.equal(calls, 2, 'one failed call, then one shared answer');
});

const failWith = (status) => ({ webConfig: async () => { throw Object.assign(new Error(`HTTP ${status}`), { status }); } });

test('a 404 (a server from before /config/web) uses LEGACY_WEB_CONFIG, still checked, and no phone sign-up', async () => {
  const cfg = await createWebConfig(failWith(404))();
  assert.deepEqual(cfg, { ...normalizeWebConfig(LEGACY_WEB_CONFIG), legacy: true, phoneSignup: false });
  assert.equal(cfg.stripePublishableKey, LEGACY_WEB_CONFIG.stripePublishableKey, 'the legacy key passes the pk_ check');
  assert.equal(cfg.googleClientId, null, 'an empty legacy client id means no Google, as before');
});

test('only a 404 falls back: a network error, a 5xx, or a 200 with empty values stay fail closed', async () => {
  for (const status of [0, 500, 502, 503, 401, 403]) {
    const cfg = await createWebConfig(failWith(status))();
    assert.equal(cfg.stripePublishableKey, null, `status ${status}: no key`);
    assert.equal(cfg.legacy, false);
  }
  const empty = await createWebConfig({ webConfig: async () => ({ stripePublishableKey: null, googleClientId: null }) })();
  assert.deepEqual(empty, { stripePublishableKey: null, googleClientId: null, legacy: false, phoneSignup: true });
  const thrown = await createWebConfig({ webConfig: async () => { throw new TypeError('Failed to fetch'); } })();
  assert.equal(thrown.stripePublishableKey, null);
});

test('the phone sign-up button waits for the server’s answer and a send-otp 404 says so plainly', () => {
  const src = fs.readFileSync(path.join(PUBLIC, 'nohm/account.js'), 'utf8');
  assert.match(src, /cfg\.phoneSignup/);
  assert.match(src, /Phone sign-up isn’t available yet\. Use email\./);
});
