// node --test tools/ads
// The landlord ad page (nohm.app/go/landlords): plain since 2026-11-03,
// sign-up and the stores at the top and the end, and the counts track.js
// sends (tools/ads/report.py reads them) with nothing personal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const page = readFileSync(new URL('../../public/go/landlords/index.html', import.meta.url), 'utf8');
const track = readFileSync(new URL('../../public/go/landlords/track.js', import.meta.url), 'utf8');
const report = readFileSync(new URL('./report.py', import.meta.url), 'utf8');

test('Sign up free and the stores: at the top and at the end, each marked where it was tapped', () => {
  for (const from of ['lp-hero', 'lp-final']) {
    assert.match(page, new RegExp(`href="/join/landlord/\\?from=${from}"`), from);
    assert.ok(page.includes(`href="/get/?to=ios&amp;from=${from}"`), `ios ${from}`);
    assert.ok(page.includes(`href="/get/?to=android&amp;from=${from}"`), `android ${from}`);
  }
});

test('every part the report names is marked on the page, in the same order', () => {
  const marked = [...page.matchAll(/data-seen="([a-z-]+)"/g)].map((m) => m[1]);
  const named = [...report.matchAll(/\('([a-z-]+)', '[^']+'\)/g)].map((m) => m[1]).filter((k) => marked.includes(k) || ['hero'].includes(k));
  assert.deepEqual(marked, named);
  assert.deepEqual(marked, ['hero', 'email', 'facts', 'start']);
});

// Owner, 2026-11-03: "i need this page to be simple not difficult to
// understand loose the marketing vibe. no sales vibe just white page with
// nohm landlord logo and simple facts".
test('a plain page: the NOHM landlord logo, the facts, no photo, no headline test, no sales parts', () => {
  assert.match(page, /<header class="bar"><a href="\/">NOHM<\/a><span class="role">landlord<\/span><\/header>/);
  assert.match(page, /<h2>The facts<\/h2>/);
  assert.match(page, /<html lang="en" data-v="s">/, 'no headline test: the report counts no A or B');
  for (const gone of ['var WIN', '<picture', 'class="dock"', 'NOHMie', 'Cheap software', 'data-vent']) {
    assert.ok(!page.includes(gone), gone);
  }
  // Prices only from the live price list.
  for (const key of ['ACH_RENT_FEE', 'RENTAL_APPLICATION_FEE', 'RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY']) {
    assert.ok(page.includes(`data-price="${key}"`), key);
  }
  assert.match(page, /<script src="\/for\/live\.js" defer><\/script>/);
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
