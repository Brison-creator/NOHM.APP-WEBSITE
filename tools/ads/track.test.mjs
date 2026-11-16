// node --test tools/ads
// The landlord ad pages (nohm.app/go/landlords, the long page of 2026-11-13,
// and /go/landlords/old, the plain 2026-11-03 page it is tested against):
// the sign-up and the stores at the top and the end, and the counts track.js
// sends (tools/ads/report.py reads them) with nothing personal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const page = readFileSync(new URL('../../public/go/landlords/index.html', import.meta.url), 'utf8');
const old = readFileSync(new URL('../../public/go/landlords/old/index.html', import.meta.url), 'utf8');
const track = readFileSync(new URL('../../public/go/landlords/track.js', import.meta.url), 'utf8');
const report = readFileSync(new URL('./report.py', import.meta.url), 'utf8');

test('Start your free month and the stores: at the top and at the end, each marked where it was tapped', () => {
  for (const [p, froms] of [[page, ['lp-hero', 'lp-final', 'lp-ps']], [old, ['old-hero', 'old-final']]]) {
    for (const from of froms) {
      assert.match(p, new RegExp(`href="/join/landlord/\\?from=${from}">Start your free month<`), from);
    }
  }
  for (const from of ['lp-hero', 'lp-final']) {
    assert.ok(page.includes(`href="/get/?to=ios&amp;from=${from}"`), `ios ${from}`);
    assert.ok(page.includes(`href="/get/?to=android&amp;from=${from}"`), `android ${from}`);
  }
  for (const from of ['old-hero', 'old-final']) {
    assert.ok(old.includes(`href="/get/?to=ios&amp;from=${from}"`), `ios ${from}`);
    assert.ok(old.includes(`href="/get/?to=android&amp;from=${from}"`), `android ${from}`);
  }
});

// The report names each page's parts, top to bottom (PARTS_NEW for the long
// page, PARTS for the old one); each is a data-seen in its HTML.
test('every part the report names is marked on the page, in the same order', () => {
  const partsOf = (name) => [...report.slice(report.indexOf(`${name} = [`), report.indexOf(']', report.indexOf(`${name} = [`))).matchAll(/\('([a-z-]+)', '[^']+'\)/g)].map((m) => m[1]);
  const marked = (html) => [...html.matchAll(/data-seen="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(marked(page), partsOf('PARTS_NEW'));
  assert.deepEqual(marked(page), ['hero', 'problem', 'what', 'proof', 'catch', 'start', 'email', 'faq', 'ps']);
  assert.deepEqual(marked(old), partsOf('PARTS'));
  assert.deepEqual(marked(old), ['hero', 'email', 'facts', 'start']);
});

// Owner, 2026-11-03: "i need this page to be simple not difficult to
// understand loose the marketing vibe. no sales vibe just white page with
// nohm landlord logo and simple facts": that page is kept as /go/landlords/old.
test('the old page stays a plain page: the NOHM landlord logo, the facts, no photo, no headline test, no sales parts', () => {
  assert.match(old, /<header class="bar"><a href="\/">NOHM<\/a><span class="role">landlord<\/span><\/header>/);
  assert.match(old, /<h2>The facts<\/h2>/);
  assert.match(old, /<html lang="en" data-v="s">/, 'no headline test: the report counts no A or B');
  for (const gone of ['var WIN', '<picture', 'class="dock"', 'NOHMie', 'Cheap software', 'data-vent']) {
    assert.ok(!old.includes(gone), gone);
  }
  // The long page has no headline test either, and no Vent to us box.
  assert.match(page, /<html lang="en" data-v="s">/);
  for (const gone of ['var WIN', 'data-vent']) assert.ok(!page.includes(gone), gone);
  // The fees that come from the live price list; the plan from /pricing.js.
  for (const p of [page, old]) {
    for (const key of ['ACH_RENT_FEE', 'RENTAL_APPLICATION_FEE', 'RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY']) {
      assert.ok(p.includes(`data-price="${key}"`), key);
    }
    assert.match(p, /<script src="\/for\/live\.js" defer><\/script>/);
    assert.match(p, /<script src="\/pricing\.js"><\/script>/);
    assert.match(p, /data-rental="plan">\$7\.99</);
  }
});

test('the counts are a HEAD to the page with no name, email or id', () => {
  assert.match(track, /fetch\(location\.pathname \+ '\?' \+ k \+ '&v=' \+ v, \{ method: 'HEAD'/);
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
