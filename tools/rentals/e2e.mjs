// The /rentals headless run, against tools/rentals/stub-server.mjs:
//   SHOTS=<dir> node tools/rentals/e2e.mjs
// Starts the stub twice (search on, and switched off), walks the search
// (ZIP, filters, List / Map, empty, a bad ZIP), a listing's page (tabs,
// costs, Contact, the phone's bottom bar) and "coming soon", and saves
// screenshots to SHOTS when it is set. Map tiles come from
// OpenStreetMap; without internet the map shows its pins on gray.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')));
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ON = 8790;
const OFF = 8791;
const NO_HUMAN = 8792;
const shots = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

function stub(port, env = {}) {
  const p = spawn(process.execPath, [path.join(HERE, 'stub-server.mjs'), String(port)], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((resolve) => p.stdout.once('data', () => resolve(p)));
}
const servers = [await stub(ON), await stub(OFF, { STUB_RENTALS: 'off' }), await stub(NO_HUMAN, { STUB_TURNSTILE: 'off' })];
const page = (port, q) => `http://localhost:${port}/rentals/${q}${q.includes('?') ? '&' : '?'}api=http://localhost:${port}/api/v1`;
const log = () => fetch(`http://localhost:${ON}/__log`).then((r) => r.json());

const launch = { executablePath: process.env.CHROME || undefined };
const browser = await chromium.launch(launch);
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function snap(p, name, full = false) {
  if (!shots) return;
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(shots, `${name}.png`), fullPage: full });
}
async function open(ctxOpts, url) {
  const ctx = await browser.newContext(ctxOpts);
  // Cloudflare's Turnstile script, stood in for: a box that passes at once.
  await ctx.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      // Like the real widget, a reset solves again (tokens work once).
      body: 'window.turnstile={render:function(h,o){h.textContent="I am human (stub)";window.__ts=o;setTimeout(function(){o.callback("stub-token")},0);return 1},reset:function(){setTimeout(function(){window.__ts.callback("stub-token")},0)}};',
    }),
  );
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(url);
  return { p, ctx, errors };
}
async function settle(p) {
  await p.waitForFunction(() => !document.querySelector('.r-loading'));
  await p.waitForLoadState('networkidle').catch(() => {});
}
const cards = (p) => p.locator('.r-grid .r-card');
const noStray = async (p) => {
  const text = await p.textContent('#rentals');
  assert.ok(!/\bnull\b|\bundefined\b|NaN/.test(text), `stray value: ${text.slice(0, 300)}`);
};

try {
  // ── Search, desktop ─────────────────────────────────────────
  {
    const { p, ctx, errors } = await open(DESKTOP, page(ON, '?zip=72701'));
    await settle(p);
    assert.equal(await p.inputValue('#r-zip'), '72701', '?zip= fills the box');
    assert.equal(await cards(p).count(), 4);
    assert.match(await p.textContent('.r-status'), /4 rentals in 72701/);
    const first = cards(p).first();
    assert.equal(await first.locator('.r-rent').textContent(), '$1,550/mo');
    assert.equal(await first.locator('.r-facts').textContent(), '4 Beds · 2 Baths · 1,720 Sqft');
    assert.equal(await first.locator('.r-street').textContent(), '412 Maple Ave');
    assert.equal(await first.locator('.r-place').textContent(), 'Fayetteville, AR 72701');
    assert.deepEqual(await first.locator('.r-card-actions a').allTextContents(), ['Apply', 'Message']);
    assert.equal(await first.locator('.r-card-actions a').first().getAttribute('href'), `http://localhost:${ON}/l/412-maple-ave-a1b2c3`);
    assert.equal(await first.locator('.r-btn:not(.sec)').count(), 1, 'one blue button per card');
    await noStray(p);
    await snap(p, 'rentals-search-desktop');
    if (shots) fs.copyFileSync(path.join(shots, 'rentals-search-desktop.png'), path.join(shots, 'rentals-page.png'));
    // The carousel: Next shows the second photo.
    await first.hover();
    await first.locator('.r-car-next').click();
    await p.waitForFunction(() => document.querySelector('.r-card .r-car-count').textContent.startsWith('2 /'));
    // Filters live in the address bar.
    await p.selectOption('select[name="beds"]', '2');
    await settle(p);
    assert.match(p.url(), /beds=2/);
    assert.equal(await cards(p).count(), 3);
    await p.selectOption('select[name="pets"]', 'cats');
    await settle(p);
    assert.match(p.url(), /pets=cats/);
    assert.equal(await cards(p).count(), 1, 'cats OK with 2+ beds: 7 Ridge Rd');
    await p.click('.r-pill-btn');
    await p.selectOption('select[name="sort"]', 'rent');
    await settle(p);
    assert.match(p.url(), /sort=rent/);
    await p.click('text=Clear filters');
    await settle(p);
    assert.equal(await cards(p).count(), 4);
    // Map: pins at the listings' own points (one has none).
    await p.click('.r-toggle button:has-text("Map")');
    await p.waitForSelector('.leaflet-container');
    await p.waitForTimeout(600);
    assert.equal(await p.locator('path.leaflet-interactive').count(), 3, 'three of four have a point');
    assert.match(await p.textContent('.r-results'), /1 of these has no map location yet/);
    assert.match(p.url(), /view=map/);
    await snap(p, 'rentals-search-map-desktop');
    await p.locator('path.leaflet-interactive').first().click();
    await p.waitForSelector('.leaflet-popup .r-pop');
    await snap(p, 'rentals-search-map-popup-desktop');
    // A bad ZIP, then one with nothing listed.
    await p.fill('#r-zip', '123');
    await p.click('.r-search-btn');
    assert.equal(await p.textContent('#r-zip-err'), 'Enter a 5-digit ZIP code.');
    await p.click('.r-toggle button:has-text("List")');
    await p.fill('#r-zip', '72702');
    await p.click('.r-search-btn');
    await settle(p);
    assert.match(await p.textContent('.r-results'), /No rentals listed in this ZIP yet\./);
    await snap(p, 'rentals-search-empty-desktop');
    const asked = (await log()).filter((r) => r.path.startsWith('/api/v1/listings/public?'));
    assert.ok(asked.every((r) => /zip=\d{5}/.test(r.path) && /pageSize=24/.test(r.path)), 'every search sends a ZIP and 24 a page');
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ── Search, phone ───────────────────────────────────────────
  {
    const { p, ctx, errors } = await open(PHONE, page(ON, '?zip=72701'));
    await settle(p);
    assert.equal(await cards(p).count(), 4);
    const box = await cards(p).first().boundingBox();
    assert.ok(box.width > 340 && box.width <= 390, `full width on a phone (${box.width})`);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(wide <= 390, `no sideways scroll (${wide})`);
    await snap(p, 'rentals-search-phone');
    if (shots) fs.copyFileSync(path.join(shots, 'rentals-search-phone.png'), path.join(shots, 'rentals-page-phone.png'));
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ── A rental's page, desktop ────────────────────────────────
  {
    const { p, ctx, errors } = await open(DESKTOP, page(ON, '?l=412-maple-ave-a1b2c3'));
    await p.waitForSelector('.r-overview');
    assert.equal(await p.textContent('.r-rent-big'), '$1,550/mo');
    assert.deepEqual(await p.locator('.r-tabs a').allTextContents(), ['Overview', 'Highlights', 'Contact', 'About', 'Costs & Fees', 'Amenities', 'Location']);
    assert.deepEqual(await p.locator('#highlights .r-chips li').allTextContents(), ['House', 'Dogs OK', '12-month lease', '1,720 sq ft', 'Available Nov 1']);
    const costs = await p.locator('#costs dt').allTextContents();
    assert.deepEqual(costs, ['Monthly rent', 'Security deposit', 'Application fee', 'Other fees']);
    assert.match(await p.textContent('#costs'), /\$50/);
    assert.match(await p.textContent('#costs'), /Contact for details/);
    assert.equal(await p.inputValue('#c-message'), "Hello, I'd like more information about 412 Maple Ave.");
    assert.match(await p.textContent('#about'), /View more/);
    // Its own address as canonical and share link, indexed while live.
    const head = await p.evaluate(() => ({
      canonical: document.querySelector('link[rel="canonical"]').href,
      og: document.querySelector('meta[property="og:url"]').content,
      ogTitle: document.querySelector('meta[property="og:title"]').content,
      robots: document.querySelector('meta[name="robots"]').content,
    }));
    assert.deepEqual(head, {
      canonical: `http://localhost:${ON}/rentals/?l=412-maple-ave-a1b2c3`,
      og: `http://localhost:${ON}/rentals/?l=412-maple-ave-a1b2c3`,
      ogTitle: '412 Maple Ave · $1,550/mo | NOHM Rentals',
      robots: 'index,follow',
    });
    // The tab for the section in view: aria-current="location", on one only.
    assert.equal(await p.getAttribute('.r-tabs a[aria-current]', 'aria-current'), 'location');
    assert.equal(await p.locator('.r-tabs a[aria-current]').count(), 1);
    assert.ok(!(await p.textContent('body')).match(/School|Walk Score|Places Nearby|Getting Around/i), 'no third-party sections');
    await noStray(p);
    await snap(p, 'rentals-listing-desktop');
    await p.click('.r-tabs a:has-text("Contact")');
    await p.waitForTimeout(500);
    assert.equal(await p.getAttribute('.r-tabs a[aria-current]', 'aria-current'), 'location');
    assert.equal(await p.textContent('.r-tabs a[aria-current]'), 'Contact');
    assert.equal(await p.locator('.r-tabs a[aria-current]').count(), 1);
    await p.waitForSelector('.r-contact .b-human:not([hidden])');
    await snap(p, 'rentals-listing-contact-desktop');
    // Send a message (Not now).
    await p.fill('#c-firstName', 'Ana');
    await p.fill('#c-lastName', 'Ruiz');
    await p.fill('#c-email', 'ana@example.com');
    await p.click('.r-contact button[type="submit"]');
    await p.waitForSelector('.r-done:not([hidden])');
    assert.match(await p.textContent('.r-done'), /Message sent\./);
    const sent = (await log()).filter((r) => r.path.endsWith('/inquire')).pop();
    assert.deepEqual(Object.keys(sent.body).sort(), ['email', 'firstName', 'humanToken', 'lastName', 'message', 'requestApplication'].sort());
    assert.equal(sent.body.humanToken, 'stub-token');
    assert.equal(sent.body.requestApplication, false);
    // The Location map loads when its section is near.
    await p.click('.r-tabs a:has-text("Location")');
    await p.waitForSelector('#location .leaflet-container');
    await p.waitForTimeout(500);
    await snap(p, 'rentals-listing-location-desktop');
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ── A rental's page, phone: the bottom bar and applying ─────
  {
    const { p, ctx, errors } = await open(PHONE, page(ON, '?l=412-maple-ave-a1b2c3'));
    await p.waitForSelector('.r-overview');
    assert.ok(await p.locator('.r-dock').isVisible(), 'the bottom bar on phones');
    assert.deepEqual(await p.locator('.r-dock a').allTextContents(), ['Request to Apply', 'Send Message']);
    assert.equal(await p.locator('.r-dock a').first().getAttribute('href'), `http://localhost:${ON}/l/412-maple-ave-a1b2c3`);
    const wide = await p.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(wide <= 390, `no sideways scroll (${wide})`);
    await snap(p, 'rentals-listing-phone');
    await p.evaluate(() => window.scrollTo(0, document.getElementById('about').offsetTop - 120));
    await p.waitForTimeout(300);
    await snap(p, 'rentals-listing-dock-phone');
    await p.click('.r-dock a:has-text("Send Message")');
    await p.waitForTimeout(500);
    await snap(p, 'rentals-listing-contact-phone');
    // Asking for the application shows the registered texting note, and needs a phone.
    await p.check('input[name="requestApplication"][value="yes"]');
    assert.ok(await p.locator('.r-consent').isVisible());
    assert.equal(await p.textContent('.r-consent'), 'By applying you agree to get texts from NOHM about this application. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.');
    await p.fill('#c-firstName', 'Ann');
    await p.fill('#c-lastName', 'Applies');
    await p.click('.r-contact button[type="submit"]');
    assert.match(await p.textContent('#c-phone-err'), /comes by text/);
    await snap(p, 'rentals-listing-contact-apply-phone');
    // An application that doesn't start is said so, never "sent".
    await p.fill('#c-phone', '(501) 555-0100');
    await p.fill('#c-firstName', 'Fail');
    await p.click('.r-contact button[type="submit"]');
    await p.waitForFunction(() => /didn’t start/.test(document.querySelector('.r-form-err').textContent));
    assert.ok(await p.locator('.r-done').isHidden());
    await snap(p, 'rentals-listing-contact-failed-phone');
    await p.fill('#c-firstName', 'Ann');
    await p.click('.r-contact button[type="submit"]');
    await p.waitForSelector('.r-done:not([hidden])');
    assert.equal(await p.locator('.r-done a').getAttribute('href'), `http://localhost:${ON}/rental-application/stub-application-token`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ── No "I'm human" check on the server: questions only ─────
  {
    const { p, ctx, errors } = await open(PHONE, page(NO_HUMAN, '?l=412-maple-ave-a1b2c3'));
    await p.waitForSelector('.r-overview');
    await p.waitForFunction(() => document.querySelector('.r-choice').hidden);
    assert.ok(await p.locator('text=To apply, tap Request to Apply.').isVisible());
    await p.fill('#c-firstName', 'Ana');
    await p.fill('#c-lastName', 'Ruiz');
    await p.fill('#c-email', 'ana@example.com');
    await p.click('.r-contact button[type="submit"]');
    await p.waitForSelector('.r-done:not([hidden])');
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ── Gone, and switched off ──────────────────────────────────
  {
    const { p, ctx } = await open(PHONE, page(ON, '?l=gone-listing-x1'));
    await p.waitForSelector('.r-gone');
    assert.match(await p.textContent('.r-gone'), /no longer listed/);
    assert.equal(await p.getAttribute('meta[name="robots"]', 'content'), 'noindex,follow', 'a gone listing isn’t indexed');
    await ctx.close();
  }
  // The menu, /renters and /landlords link /rentals only while it's on.
  for (const [port, live] of [[ON, true], [OFF, false]]) {
    const { p, ctx } = await open(DESKTOP, `http://localhost:${port}/renters/?api=http://localhost:${port}/api/v1`);
    await p.waitForFunction(() => document.querySelector('[data-rentals="soon"]').hidden !== document.querySelector('[data-rentals="live"]').hidden);
    await p.waitForTimeout(200);
    assert.equal(await p.locator('main [data-rentals="live"]').isVisible(), live, `renters live line (${live})`);
    assert.equal(await p.locator('main [data-rentals="soon"]').isVisible(), !live, `renters soon line (${live})`);
    await p.click('.menu-btn');
    await p.waitForTimeout(300);
    assert.equal(await p.locator('#site-menu a[href="/rentals"]').isVisible(), live, `menu entry (${live})`);
    if (!live) await snap(p, 'rentals-menu-off-desktop');
    await p.goto(`http://localhost:${port}/landlords/?api=http://localhost:${port}/api/v1`);
    await p.waitForTimeout(400);
    assert.equal(await p.locator('main [data-rentals="live"]').isVisible(), live, `landlords live line (${live})`);
    assert.equal(await p.locator('main [data-rentals="soon"]').isVisible(), !live, `landlords soon line (${live})`);
    await ctx.close();
  }
  {
    const { p, ctx, errors } = await open(PHONE, page(OFF, '?zip=72701'));
    await p.waitForSelector('.r-soon');
    assert.match(await p.textContent('#rentals'), /Rentals are coming soon\./);
    assert.equal(await p.locator('#r-zip').count(), 0, 'no search while off');
    await snap(p, 'rentals-soon-phone');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('rentals e2e: ok');
} finally {
  await browser.close();
  for (const s of servers) s.kill();
}
