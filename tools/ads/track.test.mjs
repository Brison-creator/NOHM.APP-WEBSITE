// node --test tools/ads
// The landlord ad page (nohm.app/go/landlords): Google sign-up at every
// turn, the phone's own store in the dock, the hero test, and the counts
// track.js sends (tools/ads/report.py reads them) with nothing personal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const page = readFileSync(new URL('../../public/go/landlords/index.html', import.meta.url), 'utf8');
const track = readFileSync(new URL('../../public/go/landlords/track.js', import.meta.url), 'utf8');
const report = readFileSync(new URL('./report.py', import.meta.url), 'utf8');

test('Sign up free with Google: the hero, the email part, the last button and the dock', () => {
  for (const from of ['lp-hero', 'lp-email', 'lp-final', 'lp-dock']) {
    assert.match(page, new RegExp(`href="/join/landlord/\\?from=${from}"`), from);
  }
  assert.match(page, /href="#email"[^>]*>Not ready\? Email me the links</);
});

test('the dock shows this phone’s store only', () => {
  assert.match(page, /html\.android \.dock \.store-badge--app-store, html\.ios \.dock \.store-badge--google-play \{ display: none; \}/);
  assert.match(page, /\/Android\/i\.test\(navigator\.userAgent\) \? ' android' : ' ios'/);
});

test('every part the report names is marked on the page, in the same order', () => {
  const marked = [...page.matchAll(/data-seen="([a-z-]+)"/g)].map((m) => m[1]);
  const named = [...report.matchAll(/\('([a-z-]+)', '[^']+'\)/g)].map((m) => m[1]).filter((k) => marked.includes(k) || ['hero'].includes(k));
  assert.deepEqual(marked, named);
  assert.equal(marked.length, 12);
});

test('the hero test: two headlines, kept per phone, and a winner switch', () => {
  assert.match(page, /var WIN = '';/);
  assert.match(page, /localStorage\.setItem\('nohm:lp-v', v\)/);
  assert.match(page, /Rent in\. Repairs handled\. From your phone\./);
  assert.match(page, /<h1>NOHM is finally in your area\.<\/h1>/);
});

test('the counts are a HEAD to the page with no name, email or id', () => {
  assert.match(track, /fetch\('\/go\/landlords\/\?' \+ k \+ '&v=' \+ v, \{ method: 'HEAD'/);
  for (const bad of ['email', 'name', 'userAgent', 'cookie', 'localStorage']) assert.doesNotMatch(track, new RegExp(`\\b${bad}\\b.*fetch|fetch.*\\b${bad}\\b`), bad);
  assert.match(track, /if \(document\.hidden\) return;/, 'time in a background tab is not counted');
  assert.match(page, /<script src="\/go\/landlords\/track\.js" defer><\/script>/);
});

test('report.py: a visitor’s counts, and the hero test rule', () => {
  const py = `
import importlib.util, collections, datetime as dt
spec = importlib.util.spec_from_file_location('report', 'tools/ads/report.py')
r = importlib.util.module_from_spec(spec); spec.loader.exec_module(r)
def row(stem, q='', m='GET'):
    return {'cs-uri-stem': stem, 'cs-uri-query': q, 'cs-method': m}
seen, faq, stay, v, lead = r.beacons([row('/go/landlords/', 'seen=versus&v=b', 'HEAD'), row('/go/landlords/', 'stay=30&v=b', 'HEAD'),
    row('/go/landlords/', 'faq=card&v=b', 'HEAD'), row('/go/landlords/', 'lead=sent&src=fb-landlords', 'HEAD'), row('/go/landlords/', 'seen=final')], '/go/landlords')
assert seen == {'versus'} and faq == {'card'} and stay == 30 and v == 'b' and lead, (seen, faq, stay, v, lead)
assert not r.is_doc(row('/go/landlords/', 'seen=hero', 'HEAD')) and r.is_doc(row('/go/landlords/'))
# As the access logs write it: each '=' escaped with a backslash.
logged = r.beacons([row('/go/landlords/', 'seen\\\\=price&v\\\\=a', 'HEAD'), row('/go/landlords/', 'lead\\\\=sent&src\\\\=fb-landlords', 'HEAD')], '/go/landlords')
assert logged == ({'price'}, set(), 0, 'a', True), logged
assert r.query(row('/get/', 'to\\\\=android&from\\\\=lp-hero')) == {'to': 'android', 'from': 'lp-hero'}
def visit(v, act):
    return {'robot': False, 'v': v, 'signup_opened': act, 'taps': collections.Counter(), 'lead': False}
few = [visit('a', False)] * 50 + [visit('b', True)] * 50
assert r.hero_test(few)['winner'] is None, 'too few people'
close = [visit('a', True)] * 10 + [visit('a', False)] * 90 + [visit('b', True)] * 12 + [visit('b', False)] * 88
assert r.hero_test(close)['winner'] is None, 'too close'
clear = [visit('a', True)] * 5 + [visit('a', False)] * 95 + [visit('b', True)] * 12 + [visit('b', False)] * 88
t = r.hero_test(clear)
assert t['winner'] == 'b' and t['b'] == {'people': 100, 'acted': 12}, t
print('ok')
`;
  assert.equal(execFileSync('python3', ['-c', py], { encoding: 'utf8' }).trim(), 'ok');
});

test('nohm.app/start, the handout card’s page: four sign-ups, all marked as from the card, kept out of search', () => {
  const start = readFileSync(new URL('../../public/start/index.html', import.meta.url), 'utf8');
  for (const href of ['/join/landlord/?from=card', '/get/?from=card-home', '/pro/?from=card', '/join/renter/?from=card', '/get/?to=ios&amp;from=card', '/get/?to=android&amp;from=card']) {
    assert.ok(start.includes(`href="${href}"`), href);
  }
  assert.match(start, /<meta name="robots" content="noindex, follow" \/>/);
  assert.doesNotMatch(start, /rel="canonical"/);
  assert.match(start, /<script src="\/menu\.js" defer><\/script>/);
  assert.doesNotMatch(readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8'), /\/start\//);
  assert.match(report, /'\/start': 'Handout card page'/);
});
