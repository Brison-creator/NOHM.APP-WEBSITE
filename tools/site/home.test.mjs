// The home page is the landlord page, built by tools/site/home.mjs. This
// fails when someone changed /landlords (or the SEO builder rewrote its
// link grid) and did not rebuild the home page, or edited it by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, SOURCE, TARGET } from './home.mjs';

const landlords = fs.readFileSync(SOURCE, 'utf8');
const home = fs.readFileSync(TARGET, 'utf8');

test('the home page is up to date with /landlords (run node tools/site/home.mjs)', () => {
  assert.equal(home, build(landlords));
});

test('the home page says what the landlord page says, at its own address', () => {
  const h1 = (s) => (s.match(/<h1[^>]*>(.*?)<\/h1>/) || [])[1];
  assert.equal(h1(home), h1(landlords));
  assert.ok(home.includes('<link rel="canonical" href="https://nohm.app/" />'));
  assert.ok(!home.includes('https://nohm.app/landlords/"'), 'no tag still points at /landlords');
  // What the front door alone carries.
  assert.ok(home.includes('/img/og-invite.png'), "the invite text's share picture");
  assert.ok(home.includes('<meta name="apple-itunes-app" content="app-id=6761128513" />'));
  assert.ok(home.includes('"@id":"https://nohm.app/#org"'), "the site's Organization data");
  for (const href of ['/renters/', '/homeowners/', '/pros/']) {
    assert.ok(new RegExp(`<nav class="others"[^]*?href="${href}"`).test(home), `the row for people who are not landlords links ${href}`);
  }
});
