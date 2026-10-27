// node --test tools/join
// nohm.app/join/landlord: the landlord's sign-up (Google or a phone, as
// PROPERTY_MANAGER), Google from inside Facebook's browser, and the count.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { landlordSource } from '../../public/join/lib/landlord.js';
import { inAppBrowser, chromeLink } from '../../public/nohm/google.js';

const read = (p) => readFileSync(new URL(`../../public/${p}`, import.meta.url), 'utf8');

test('where a new landlord came from: the ad, Instagram, the handout card, or the site', () => {
  assert.equal(landlordSource('?from=lp-hero', 'utm_source=facebook&utm_campaign=landlords'), 'fb-landlords');
  assert.equal(landlordSource('?fbclid=IwZ1', ''), 'fb-landlords');
  assert.equal(landlordSource('?utm_source=ig', ''), 'ig-landlords');
  assert.equal(landlordSource('?from=card', ''), 'card');
  assert.equal(landlordSource('', ''), 'web');
  assert.equal(landlordSource('?utm_source=instagram', 'utm_source=facebook'), 'ig-landlords', 'the address wins over the tab’s tags');
});

test('Facebook’s and Instagram’s own browsers are told apart from a phone’s browser', () => {
  assert.equal(inAppBrowser('Mozilla/5.0 (Linux; Android 14; SM-S918U) [FB_IAB/FB4A;FBAV/480.0.0.38.109;]'), 'facebook');
  assert.equal(inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) [FBAN/FBIOS;FBAV/480.0]'), 'facebook');
  assert.equal(inAppBrowser('Mozilla/5.0 (iPhone) Instagram 350.0.0'), 'instagram');
  assert.equal(inAppBrowser('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36'), null);
});

test('the Chrome link opens this page in Chrome with the ad’s tags, and falls back to it', () => {
  const link = chromeLink({ host: 'nohm.app', pathname: '/join/landlord/', search: '?from=lp-hero' }, 'utm_source=facebook&utm_campaign=landlords');
  assert.equal(link, 'intent://nohm.app/join/landlord/?from=lp-hero&utm_source=facebook&utm_campaign=landlords#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fnohm.app%2Fjoin%2Flandlord%2F%3Ffrom%3Dlp-hero%26utm_source%3Dfacebook%26utm_campaign%3Dlandlords;end');
});

test('the page runs the join app as a landlord, kept out of search and frames', () => {
  const page = read('join/landlord/index.html');
  assert.match(page, /<body data-join="landlord">/);
  assert.match(page, /<meta name="robots" content="noindex, follow" \/>/);
  assert.doesNotMatch(page, /rel="canonical"/, 'a noindex page has no canonical');
  assert.match(page, /<script src="\/menu\.js" defer><\/script>/);
  assert.doesNotMatch(read('../public/sitemap.xml'), /join\/landlord/);
  assert.match(readFileSync(new URL('../../customHttp.yml', import.meta.url), 'utf8'), /pattern: '\/join\/landlord\/\*'\n    headers:\n      - key: X-Frame-Options\n        value: DENY/);
  const app = read('join/app.js');
  assert.match(app, /landlord: 'PROPERTY_MANAGER'/);
  assert.match(app, /if \(MODE === 'landlord'\) return 'done';/);
  assert.match(app, /if \(MODE === 'landlord' && signedUp\) landlord\.countSignup\(location\.search\);/);
});

test('the done screen sends them to their phone’s store through /get, and counts nothing personal', () => {
  const ui = read('join/ui/landlord-screens.js');
  assert.match(ui, /href: `\/get\/\?to=\$\{store\}&from=\$\{from\}`/);
  assert.match(ui, /fetch\(`\/join\/landlord\/\?signup=done&src=\$\{encodeURIComponent\(landlordSource\(search, tags\)\)\}`, \{ method: 'HEAD'/);
});
