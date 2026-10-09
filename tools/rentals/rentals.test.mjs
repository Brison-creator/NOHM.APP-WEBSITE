// node --test tools/rentals
// /rentals without a browser: the ZIP and filters, the address bar, the
// server paths, the switch, what a listing shows (facts, costs,
// highlights, contact body), and that the cards and pages are built
// with elements and text only (never innerHTML).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validZip, readSearch, searchQueryString, searchPath, rentalsOpen, route, listingHref, activeFilters, PAGE_SIZE,
} from '../../public/rentals/lib/search.js';
import {
  dollars, rentLine, factsLine, streetLine, placeLine, availableLine, highlights, featureGroups, costRows, defaultMessage,
  contactProblems, contactBody, contactOutcome, applicationUrl, safeUrl, mapPoint, APPLY_TEXT_NOTE, CONTACT_FOR_DETAILS,
  contactError, listingHead,
} from '../../public/rentals/lib/listing.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const LISTING = {
  slug: '412-maple-ave-a1b2c3',
  url: 'https://api.nohm.app/l/412-maple-ave-a1b2c3',
  street: '412 Maple Ave',
  unit: null,
  city: 'Fayetteville',
  state: 'AR',
  zipCode: '72701',
  rentCents: 155000,
  depositCents: 155000,
  beds: 4,
  baths: 2,
  sqft: 1720,
  availableOn: '2026-11-01',
  leaseMonths: 12,
  pets: 'DOGS',
  homeType: 'HOUSE',
  photos: ['https://files.nohm.app/listings/L1/1.jpg', 'https://files.nohm.app/listings/L1/2.jpg'],
  latitude: 36.06,
  longitude: -94.16,
  asksApplication: true,
  applicationFeeCents: 5000,
};

test('ZIP: exactly five digits', () => {
  assert.equal(validZip('72701'), '72701');
  assert.equal(validZip(' 72701 '), '72701');
  for (const bad of ['', null, undefined, '7270', '727011', '72701-1234', 'abcde', '7270a', '72 701']) assert.equal(validZip(bad), null, String(bad));
});

test('the address bar: ?zip=72701 fills the search; junk is dropped, never sent', () => {
  assert.deepEqual(readSearch('?zip=72701'), { zip: '72701', minBeds: null, maxRent: null, pets: null, sort: null, page: 1 });
  assert.deepEqual(readSearch('?zip=72701&beds=2&maxRent=1500&pets=dogs&sort=rent&page=3'), { zip: '72701', minBeds: 2, maxRent: 1500, pets: 'dogs', sort: 'rent', page: 3 });
  assert.deepEqual(readSearch('?zip=abc&beds=-1&maxRent=lots&pets=birds&sort=x&page=0'), { zip: null, minBeds: null, maxRent: null, pets: null, sort: null, page: 1 });
  assert.equal(readSearch('?zip=72701&sort=newest').sort, null, 'newest is the default');
  const s = readSearch('?zip=72701&beds=0&maxRent=1500&pets=cats&sort=rent_desc&page=2');
  assert.equal(searchQueryString(s), '?zip=72701&beds=0&maxRent=1500&pets=cats&sort=rent_desc&page=2');
  assert.deepEqual(readSearch(searchQueryString(s)), s, 'a shared link searches the same');
  assert.equal(searchQueryString({ zip: null }), '');
  assert.equal(activeFilters(s), 4);
  assert.equal(activeFilters(readSearch('?zip=72701')), 0);
});

test('the server path: only the filters asked for, 24 a page at most', () => {
  assert.equal(searchPath({ zip: null }), null);
  assert.equal(searchPath({ zip: '7270' }), null);
  assert.equal(searchPath(readSearch('?zip=72701')), `/listings/public?zip=72701&pageSize=${PAGE_SIZE}`);
  assert.equal(PAGE_SIZE, 24);
  assert.equal(
    searchPath(readSearch('?zip=72701&beds=2&maxRent=1500&pets=dogs&sort=rent&page=2')),
    '/listings/public?zip=72701&pageSize=24&minBeds=2&maxRent=1500&pets=dogs&sort=rent&page=2',
  );
});

test('the switch: only an explicit true opens the search', () => {
  assert.equal(rentalsOpen({ publicRentalsSearch: true }), true);
  for (const off of [null, undefined, {}, { publicRentalsSearch: false }, { publicRentalsSearch: 'true' }, 'yes']) assert.equal(rentalsOpen(off), false);
});

test('routes: ?l=<slug> is a listing page; anything odd is the search', () => {
  assert.deepEqual(route('?l=412-maple-ave-a1b2c3'), { view: 'listing', slug: '412-maple-ave-a1b2c3' });
  for (const s of ['', '?zip=72701', '?l=', '?l=../../x', '?l=<script>', '?l=A B']) assert.deepEqual(route(s), { view: 'search' });
  assert.equal(listingHref('412-maple-ave-a1b2c3', '#contact'), '/rentals/?l=412-maple-ave-a1b2c3#contact');
});

test('what a card says: price, facts, address, availability', () => {
  assert.equal(dollars(155000), '$1,550');
  assert.equal(dollars(98550), '$985.50');
  assert.equal(rentLine(LISTING), '$1,550/mo');
  assert.equal(factsLine(LISTING), '4 Beds · 2 Baths · 1,720 Sqft');
  assert.equal(factsLine({ beds: 1, baths: 1.5, sqft: null }), '1 Bed · 1.5 Baths');
  assert.equal(factsLine({ beds: 0, baths: 1 }), 'Studio · 1 Bath');
  assert.equal(streetLine({ street: '88 College Ave', unit: '2B' }), '88 College Ave 2B');
  assert.equal(placeLine(LISTING), 'Fayetteville, AR 72701');
  assert.equal(availableLine(LISTING, new Date('2026-10-09T12:00:00Z')), 'Available Nov 1');
  assert.equal(availableLine(LISTING, new Date('2026-11-02T12:00:00Z')), 'Available now');
});

test('highlights, features and costs come only from the listing; never an estimate', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  assert.deepEqual(highlights(LISTING, now), ['House', 'Dogs OK', '12-month lease', '1,720 sq ft', 'Available Nov 1']);
  assert.deepEqual(highlights({ rentCents: 1 }, now), []);
  assert.deepEqual(featureGroups(LISTING, now).map((g) => g.title), ['The home', 'Lease', 'Pets']);
  assert.deepEqual(featureGroups({}, now), []);
  assert.deepEqual(costRows(LISTING), [
    { label: 'Monthly rent', value: '$1,550' },
    { label: 'Security deposit', value: '$1,550' },
    { label: 'Application fee', value: '$50', note: 'Paid when you apply on NOHM, for the background check.' },
    { label: 'Other fees', value: CONTACT_FOR_DETAILS },
  ]);
  const unknown = costRows({ rentCents: 100000, depositCents: null, applicationFeeCents: null });
  assert.deepEqual(unknown.map((r) => r.value), ['$1,000', CONTACT_FOR_DETAILS, CONTACT_FOR_DETAILS, CONTACT_FOR_DETAILS]);
  assert.equal(costRows({ ...LISTING, applicationFeeCents: 0 })[2].value, 'No fee');
  assert.equal(costRows({ ...LISTING, asksApplication: false, applicationFeeCents: null })[2].value, 'No application');
  for (const r of costRows(LISTING)) assert.doesNotMatch(r.value, /–|-\s*\$|estimate|about|~/i);
});

test('contact: the default message, what is required, and only the fields the server takes', () => {
  assert.equal(defaultMessage(LISTING), "Hello, I'd like more information about 412 Maple Ave.");
  const ok = { firstName: 'Ana', lastName: 'Ruiz', email: 'ana@example.com', phone: '', moveIn: '2026-11-15', message: 'Hi', requestApplication: false };
  assert.deepEqual(contactProblems(ok), {});
  assert.deepEqual(Object.keys(contactProblems({ ...ok, firstName: ' ', lastName: '' })), ['firstName', 'lastName']);
  assert.ok(contactProblems({ ...ok, email: '' }).email, 'an email or a phone');
  assert.ok(contactProblems({ ...ok, email: 'nope' }).email);
  assert.ok(contactProblems({ ...ok, phone: '12' }).phone);
  assert.match(contactProblems({ ...ok, requestApplication: true }).phone, /comes by text/, 'asking for the application needs a phone');
  assert.deepEqual(contactProblems({ ...ok, requestApplication: true, phone: '(501) 555-0100' }), {});
  assert.deepEqual(contactBody({ ...ok, firstName: ' Ana ', landlordId: 'x' }, 'tok'), {
    firstName: 'Ana', lastName: 'Ruiz', email: 'ana@example.com', moveIn: '2026-11-15', message: 'Hi', requestApplication: false, humanToken: 'tok',
  });
  assert.equal('humanToken' in contactBody(ok, ''), false);
});

test('the texting note is the registered Apply note, word for word (as /sms quotes it)', () => {
  const sms = fs.readFileSync(path.join(ROOT, 'public/sms/index.html'), 'utf8');
  assert.ok(sms.includes(APPLY_TEXT_NOTE.replace('&', '&amp;')), 'the same words as nohm.app/sms and the server listing page');
});

test('what the contact answer means, and only safe links', () => {
  assert.deepEqual(contactOutcome({ sent: true }, LISTING.url).kind, 'sent');
  assert.deepEqual(contactOutcome({ applicationTexted: true }, LISTING.url).kind, 'texted');
  const apply = contactOutcome({ token: 'abc_123' }, LISTING.url);
  assert.equal(apply.href, 'https://api.nohm.app/rental-application/abc_123');
  assert.equal(contactOutcome({ token: '"><script>' }, LISTING.url).kind, 'sent');
  assert.equal(applicationUrl('https://api.nohm.app/base/l/x', 't'), 'https://api.nohm.app/base/rental-application/t');
  assert.equal(applicationUrl('javascript:alert(1)', 't'), null);
  assert.equal(safeUrl('https://api.nohm.app/l/x'), 'https://api.nohm.app/l/x');
  assert.equal(safeUrl('http://localhost:8790/l/x'), 'http://localhost:8790/l/x');
  for (const bad of ['javascript:alert(1)', 'http://evil.example/l/x', 'data:text/html,x', '', null]) assert.equal(safeUrl(bad), null);
  assert.deepEqual(mapPoint(LISTING), [36.06, -94.16]);
  for (const p of [{}, { latitude: null, longitude: 1 }, { latitude: 'x', longitude: 1 }, { latitude: 91, longitude: 0 }]) assert.equal(mapPoint(p), null);
});

// ── Rendering with elements only ──────────────────────────────────

/** Just enough DOM for the card: any use of HTML strings throws. */
function fakeDom() {
  class Node {}
  class Text extends Node {
    constructor(t) { super(); this.data = String(t); }
    get textContent() { return this.data; }
  }
  class El extends Node {
    constructor(tag) {
      super();
      this.tagName = tag.toUpperCase();
      this.childNodes = [];
      this.attributes = {};
      this.dataset = {};
      this.listeners = {};
      this.className = '';
      const self = this;
      this.classList = { add: (c) => (self.className += ` ${c}`), toggle: () => {}, remove: () => {} };
    }
    append(...kids) { for (const k of kids) this.childNodes.push(typeof k === 'string' ? new Text(k) : k); }
    appendChild(k) { this.childNodes.push(k); return k; }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] ?? null; }
    addEventListener(t, f) { this.listeners[t] = f; }
    get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
    set textContent(v) { this.childNodes = [new Text(v)]; }
    set innerHTML(_) { throw new Error('innerHTML used'); }
    set outerHTML(_) { throw new Error('outerHTML used'); }
    insertAdjacentHTML() { throw new Error('insertAdjacentHTML used'); }
    all() { return [this, ...this.childNodes.flatMap((c) => (c instanceof El ? c.all() : []))]; }
  }
  return {
    Node,
    El,
    document: {
      createElement: (t) => new El(t),
      createElementNS: (_ns, t) => new El(t),
      createTextNode: (t) => new Text(t),
      getElementById: () => null,
    },
  };
}

test('a card is built from elements and text: a listing’s words can’t become markup', async () => {
  const dom = fakeDom();
  globalThis.Node = dom.Node;
  globalThis.document = dom.document;
  const { rentalCard } = await import('../../public/rentals/ui/card.js');
  const evil = { ...LISTING, street: '<img src=x onerror=alert(1)>', city: '<b>Town</b>', url: 'javascript:alert(1)' };
  const el = rentalCard(evil, { origin: 'https://nohm.app' });
  const text = el.textContent;
  assert.ok(text.includes('$1,550/mo'));
  assert.ok(text.includes('4 Beds · 2 Baths · 1,720 Sqft'));
  assert.ok(text.includes('<img src=x onerror=alert(1)>'), 'shown as text, as typed');
  assert.ok(text.includes('<b>Town</b>, AR 72701'));
  const all = el.all();
  assert.ok(!all.some((n) => n.tagName === 'B' || (n.tagName === 'IMG' && n.src === 'x')), 'no element came from the listing’s words');
  const links = all.filter((n) => n.tagName === 'A');
  const hrefs = links.map((a) => a.href ?? a.attributes.href);
  assert.ok(!hrefs.some((h) => /javascript:/i.test(String(h))), 'an unsafe Apply link is left out');
  assert.ok(hrefs.includes('/rentals/?l=412-maple-ave-a1b2c3#contact'), 'Message goes to the listing’s Contact');
  // The photos are their own element: no button (the carousel's arrows,
  // Share) inside a link, and no link inside a link.
  for (const a of links) {
    const inner = a.all().slice(1);
    assert.ok(!inner.some((n) => n.tagName === 'BUTTON' || n.tagName === 'A'), `nothing interactive inside ${a.attributes.href ?? a.href}`);
  }
  const photos = all.find((n) => /\br-card-photos\b/.test(n.className));
  assert.equal(photos.tagName, 'DIV', 'the photos aren’t a link');
  // The card's own link is its title: the address.
  const title = all.find((n) => n.tagName === 'H2');
  assert.equal(title.childNodes[0].tagName, 'A');
  assert.equal(title.childNodes[0].href ?? title.childNodes[0].attributes.href, '/rentals/?l=412-maple-ave-a1b2c3');
  // A good link gets both buttons: Apply (white) and Message (blue): one blue per card.
  const good = rentalCard(LISTING, { origin: 'https://nohm.app' }).all().filter((n) => n.tagName === 'A' && /\br-btn\b/.test(n.className));
  assert.deepEqual(good.map((a) => [a.textContent, /\bsec\b/.test(a.className)]), [['Apply', true], ['Message', false]]);
});

test('no /rentals file writes HTML strings, and Leaflet only gets elements', () => {
  const dir = path.join(ROOT, 'public/rentals');
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));
  assert.ok(files.length >= 7);
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write/, path.relative(ROOT, f));
  }
  const map = fs.readFileSync(path.join(dir, 'ui/map.js'), 'utf8');
  for (const m of map.matchAll(/bind(Tooltip|Popup)\(([^,]+),/g)) assert.match(m[2], /^(h\(|p\.popup)/, `${m[0]}: an element, not a string`);
  assert.doesNotMatch(map, /attributionControl:\s*true/);
});

test('Leaflet is vendored whole, with its license', () => {
  const v = path.join(ROOT, 'public/vendor/leaflet-1.9.4');
  for (const f of ['leaflet.js', 'leaflet.css', 'LICENSE']) assert.ok(fs.existsSync(path.join(v, f)), f);
  assert.match(fs.readFileSync(path.join(v, 'LICENSE'), 'utf8'), /BSD 2-Clause/);
  assert.match(fs.readFileSync(path.join(v, 'leaflet.js'), 'utf8'), /version="1\.9\.4"/);
});

test('the page copy names no coverage area or town', () => {
  const copy = ['public/rentals/index.html', 'public/rentals/app.js', 'public/rentals/ui/search-view.js', 'public/rentals/ui/listing-view.js']
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .join('\n');
  assert.doesNotMatch(copy, /Fayetteville|Benton|Rogers|Bentonville|Springdale|Little Rock|Arkansas|serving|we serve|available in/i);
});

test('contact errors say what the server said, and what to do', () => {
  assert.equal(contactError({ status: 429 }), 'Too many messages from here. Try again in an hour.');
  assert.equal(contactError({ status: 404 }), 'This rental is no longer listed.');
  const notStarted = 'The landlord has your message, but your application didn’t start. Tap Request to Apply to try again.';
  assert.equal(contactError({ status: 409, code: 'APPLICATION_NOT_STARTED', message: notStarted }), notStarted, 'never "sent" for an application that didn’t start');
  assert.match(contactError({ status: 403, code: 'APPLY_NEEDS_HUMAN_CHECK', message: 'Tap Request to Apply instead.' }), /Request to Apply/);
  assert.equal(contactError({ status: 0 }), 'Can’t reach NOHM right now. Try again.');
});

test('a rental’s page: its own canonical and share link, indexed only while live', () => {
  assert.deepEqual(listingHead('412-maple-ave-a1b2c3', '412 Maple Ave · $1,550/mo | NOHM Rentals', true), {
    canonical: 'https://nohm.app/rentals/?l=412-maple-ave-a1b2c3',
    ogUrl: 'https://nohm.app/rentals/?l=412-maple-ave-a1b2c3',
    title: '412 Maple Ave · $1,550/mo | NOHM Rentals',
    robots: 'index,follow',
  });
  assert.equal(listingHead('gone-x1', 'Rentals | NOHM', false).robots, 'noindex,follow');
});

test('while the search is off, nothing presents /rentals as live', () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, 'public', f), 'utf8');
  // Lines that link /rentals start hidden and say "live"; the "coming soon" ones show.
  for (const f of ['renters/index.html', 'landlords/index.html']) {
    const s = read(f);
    const live = [...s.matchAll(/<[a-z0-9]+ data-rentals="live"([^>]*)>/g)];
    const soon = [...s.matchAll(/<[a-z0-9]+ data-rentals="soon"([^>]*)>/g)];
    assert.ok(live.length >= 1 && soon.length >= 1, f);
    for (const m of live) assert.match(m[1], /\bhidden\b/, `${f}: a live line starts hidden`);
    for (const m of soon) assert.doesNotMatch(m[1], /\bhidden\b/, `${f}: "coming soon" shows by default`);
    // Every link to /rentals sits inside a live line.
    const outside = s.replace(/<([a-z0-9]+) data-rentals="live"[\s\S]*?<\/\1>/g, '');
    assert.doesNotMatch(outside, /href="\/rentals/, `${f}: no /rentals link outside a live line`);
  }
  assert.match(read('landlords/index.html'), /coming soon/);
  const menu = read('menu.js');
  assert.match(menu, /<li data-rentals="live" hidden><a href="\/rentals">Rentals<\/a><\/li>/);
  assert.match(menu, /publicRentalsSearch === true/, 'only an explicit true shows it');
  assert.match(read('bar.css'), /\[data-rentals\]\[hidden\]/);
});
