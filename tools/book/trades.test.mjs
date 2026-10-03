// node --test tools/book
// Every service nohm.app lists has what /book needs to show it: an icon,
// the /services card's words, and its issues. A tile still appears only
// when the server's GET /trades returns the trade; nothing here adds one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ISSUES, issuesForTrade, ISSUES_FALLBACK } from '../../public/book/lib/issues.js';
import { tradeForSlug, bookableTrades } from '../../public/book/lib/flow.js';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const read = (f) => fs.readFileSync(path.join(PUBLIC, f), 'utf8');

// The /services card label → the server's Trade.name (prisma/trades/catalog.ts
// in the-nohm-application-1.1).
const SERVICES = {
  Plumbing: 'PLUMBING',
  HVAC: 'HVAC',
  Electrical: 'ELECTRICAL',
  Appliance: 'APPLIANCE',
  Locksmith: 'LOCKSMITH',
  'Pressure Washing': 'PRESSURE_WASHING',
  Handyman: 'HANDYMAN',
  'Landscaping &amp; Lawn Care': 'LANDSCAPING',
  'Gutter Service': 'GUTTERS',
  'Garage Door Service': 'GARAGE_DOOR',
  'Pest Control': 'PEST_CONTROL',
  Painting: 'PAINTING',
  Flooring: 'FLOORING',
  'House Cleaning': 'HOUSE_CLEANING',
  'Tree Service': 'TREE_SERVICE',
};

/** `KEY: '…'` entries of a const object in screens.js. */
function objectIn(src, name) {
  const body = src.slice(src.indexOf(`const ${name} = {`), src.indexOf('};', src.indexOf(`const ${name} = {`)));
  return Object.fromEntries([...body.matchAll(/^\s+([A-Z_]+): '([^']*)',$/gm)].map((m) => [m[1], m[2]]));
}

const screens = read('book/ui/screens.js');
const ICON = objectIn(screens, 'TRADE_ICON');
const BLURB = objectIn(screens, 'BLURB');

test('/services lists the 15 services, and each is a trade /book can draw', () => {
  const cards = [...read('services/index.html').matchAll(/<b>([^<]+)<\/b><span>([^<]+)<\/span>/g)];
  assert.deepEqual(cards.map((c) => c[1]), Object.keys(SERVICES));
  for (const [, label, words] of cards) {
    const name = SERVICES[label];
    assert.ok(ICON[name], `${name} has an icon`);
    assert.match(ICON[name], /^M[-0-9.,\sMmLlHhVvCcSsQqTtAaZz]+$/, `${name} icon is one path`);
    assert.equal(BLURB[name], words, `${name} says what its /services card says`);
    assert.notEqual(issuesForTrade(name), ISSUES_FALLBACK, `${name} has its own issues`);
    assert.equal(issuesForTrade(name).length, 5, `${name} has five issues`);
  }
  assert.ok(ICON.ROOFING && BLURB.ROOFING, 'Roofing, booked but not on /services, too');
});

test('every issue list has an icon and a blurb, and every issue is complete', () => {
  for (const [name, issues] of Object.entries(ISSUES)) {
    assert.ok(ICON[name] && BLURB[name], name);
    for (const i of issues) assert.ok(i.emoji && i.title && i.description, `${name}: ${i.title}`);
  }
  assert.equal(issuesForTrade('locksmith')[0].title, 'Locked out');
  assert.equal(issuesForTrade('PEST_CONTROL')[0].title, 'Roaches');
});

test('a service shows only once the server returns it, and its /services slug finds it', () => {
  const today = [{ id: 't-plumb', name: 'PLUMBING', label: 'Plumbing', bookable: true, isActive: true }];
  assert.equal(tradeForSlug('garage-door', today), null, 'not until the server has it');
  assert.deepEqual(bookableTrades(today).map((t) => t.name), ['PLUMBING']);
  const later = [...today, { id: 't-gd', name: 'GARAGE_DOOR', label: 'Garage Door Service', bookable: true, isActive: true }, { id: 't-pc', name: 'PEST_CONTROL', label: 'Pest Control', bookable: true, isActive: true }];
  assert.equal(tradeForSlug('garage-door', later).id, 't-gd');
  assert.equal(tradeForSlug('pest-control', later).id, 't-pc');
  assert.deepEqual(bookableTrades(later).map((t) => t.name), ['PLUMBING', 'GARAGE_DOOR', 'PEST_CONTROL']);
});
