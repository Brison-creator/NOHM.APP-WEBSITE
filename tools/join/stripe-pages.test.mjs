// node --test tools/join
// Stripe Connect sends pros (payouts) and landlords (rent) back to
// nohm.app/stripe/return and /stripe/refresh. The pages can't know
// whether Stripe is complete or whether anyone is approved, and the app
// has no link they can open (no nohm:// on Android, no universal link),
// so they say only what's true for everyone: open the app to see where
// you are.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const read = (p) => fs.readFileSync(path.join(PUBLIC, p), 'utf8');
const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&rsquo;/g, '’').replace(/\s+/g, ' ');

for (const page of ['stripe/return/index.html', 'stripe/refresh/index.html']) {
  test(`${page}: neutral for pros and landlords, no app link that can't open`, () => {
    const html = read(page);
    const words = text(html);
    assert.doesNotMatch(html, /nohm:\/\//, 'no custom-scheme link (Android has none)');
    assert.doesNotMatch(html, /\/contractor\/home|href="\/home"/, 'no route the app doesn’t have');
    assert.doesNotMatch(words, /ready to get paid|On Shift|receiving jobs|Bank Connected|payout account is set up/i, 'no claim that Stripe is done or that the pro can work');
    assert.doesNotMatch(words, /\bjobs?\b/i, 'landlords land here too');
    assert.match(words, /Open the NOHM app/);
    assert.match(html, /apps\.apple\.com/);
    assert.match(html, /play\.google\.com/);
  });
}
