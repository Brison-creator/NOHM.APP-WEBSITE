// End to end in a headless browser against the stub server:
//   node tools/book/stub-server.mjs 8787 &  node tools/book/e2e.mjs
// Walks the real page through every step the way a person would,
// then checks what the page sent the server: Standard (sign-up, add a
// home, pick a pro), Express with a card missing (the card step appears
// and the job carries the shown fee), NOW, the error paths, photos
// (shrunk, one per request), and the server's web settings missing.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

// Playwright from this repo if installed, else the global one.
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')));
}

const PORT = Number(process.env.PORT || 8787);
const BASE = `http://localhost:${PORT}`;
const PAGE = `${BASE}/book/?api=${BASE}/api/v1`;

const reset = (q = '') => fetch(`${BASE}/__reset${q}`).then((r) => r.json());
const log = () => fetch(`${BASE}/__log`).then((r) => r.json());
const shots = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
let n = 0;
async function snap(page, name) {
  const text = await page.textContent('#book');
  assert.ok(!/\bnull\b|\bundefined\b/.test(text), `stray null/undefined on ${name}: ${text.slice(0, 200)}`);
  if (shots) await page.waitForTimeout(350); // let the screen's fade-in finish
  if (shots) await page.screenshot({ path: path.join(shots, `${String(++n).padStart(2, '0')}-${name}.png`), fullPage: true });
}

const FAKE_STRIPE = `window.Stripe = function (key) {
  window.__stripeKey = key;
  return { elements: function () { return { create: function () { return { mount: function (el) { el.dataset.stripeMounted = '1'; }, on: function () {}, destroy: function () {} }; } }; } };
};`;

/** A PNG of random pixels (it doesn't compress, so it's as big as it looks). */
function noisePng(w, h) {
  const row = w * 3 + 1;
  const raw = crypto.randomBytes(row * h);
  for (let y = 0; y < h; y++) raw[y * row] = 0; // filter: none
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 0 })), chunk('IEND', Buffer.alloc(0))]);
}

/** The JPEG with an EXIF block whose Orientation tag is `o` (6 = rotate 90° clockwise to view). */
function withExifOrientation(jpeg, o) {
  const tiff = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0]);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const len = Buffer.alloc(2); len.writeUInt16BE(payload.length + 2);
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1]), len, payload, jpeg.subarray(2)]);
}

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // A stand-in Stripe.js that records the key the page hands it, so the
  // run never loads the real one and can check where the key came from.
  await ctx.route('https://js.stripe.com/v3/', (route) => route.fulfill({ contentType: 'text/javascript', body: FAKE_STRIPE }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw new Error(`page error: ${e.message}`); });
  // A browser-side error fails the run; the browser's own log line for an expected 4xx response does not.
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) throw new Error(`console.error: ${m.text()}`); });
  return { ctx, page };
}

async function describeAndSpeed(page, tier, text) {
  await page.fill('#f-description', text);
  const tmp = path.join(os.tmpdir(), 'nohm-e2e.png');
  fs.writeFileSync(tmp, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
  await page.setInputFiles('#f-photos', tmp);
  await page.waitForSelector('.b-thumb');
  await snap(page, 'details');
  await page.click('[data-key=next]');
  await page.waitForSelector('[data-tier]');
  await snap(page, 'speed');
  assert.equal(await page.textContent('[data-tier=STANDARD] .b-price'), 'No NOHM fee');
  assert.match(await page.textContent('[data-tier=EXPRESS] .b-price'), /\$40\s*\$20/);
  await page.click(`[data-tier=${tier}]`);
}

async function signUp(page) {
  await page.waitForSelector('[data-key=signup]');
  await snap(page, 'account');
  await page.fill('#f-firstName', 'Ava');
  await page.fill('#f-lastName', 'Ng');
  await page.fill('#f-email', 'ava@example.com');
  await page.fill('#f-phone', '(512) 555-0123');
  await page.fill('#f-password', 'longenough1');
  await page.click('[data-key=signup]');
  await page.waitForSelector('#f-code');
  await page.fill('#f-code', '000000');
  await page.click('[data-key=verify]');
  await page.waitForSelector('#e-code:not(:empty)');
  await page.fill('#f-code', '123456');
  await page.click('[data-key=verify]');
}

async function addHome(page) {
  await page.waitForSelector('#f-address');
  await page.fill('#f-address', '11008 Chambers');
  await page.waitForSelector('.b-match');
  await page.click('.b-match');
  // The person says what kind of home it is; the site doesn't assume.
  await page.waitForSelector('[data-structure=SINGLE]');
  await snap(page, 'home-type');
  await page.click('[data-structure=SINGLE]');
  await page.waitForSelector('text=Your home is on NOHM.');
  await snap(page, 'home-added');
  assert.ok(await page.textContent('.b-sub').then((t) => t.includes('4K7-M2Q-9XC')));
  await page.click('[data-key=next]');
}

// ── Run 1: Standard, brand new person ─────────────────────────────
{
  await reset();
  const { ctx, page } = await fresh();
  await page.goto(PAGE);
  await page.waitForSelector('[data-trade=PLUMBING]');
  await snap(page, 'service');
  assert.equal(await page.$('[data-trade=MAKE_READY]'), null, 'non-bookable trades are hidden');

  // The search pill finds an issue and jumps straight to details.
  await page.fill('.b-search', 'hot water');
  await page.waitForSelector('.b-match');
  assert.match(await page.textContent('.b-match b'), /No hot water/);
  await page.click('[data-trade=PLUMBING]');
  await page.waitForSelector('.b-choice');
  await snap(page, 'issue');
  await page.click('.b-choice:nth-child(2)'); // Clogged drain

  await describeAndSpeed(page, 'STANDARD', 'Kitchen sink drains slowly and gurgles.');
  await page.waitForSelector('[data-window]');
  await snap(page, 'schedule');
  await page.click('[data-day]:nth-child(2)'); // tomorrow: every window open
  await page.click('[data-window=MIDDAY]');
  await page.click('[data-key=next]');

  await signUp(page);
  await addHome(page);

  await page.waitForSelector('[data-key=confirm]');
  await snap(page, 'review');
  const review = await page.textContent('.b-card');
  assert.match(review, /Plumbing · Clogged drain/);
  assert.match(review, /Tomorrow, midday 11 AM–2 PM/);
  assert.match(review, /visa •••• 4242/);
  assert.match(review, /NOHM fee\s*None/);
  // The terms shown are the server's, asked for the same date the booking sends.
  await page.waitForFunction(() => document.body.textContent.includes('Free to cancel up to 24 hours'));
  assert.ok(!(await page.textContent('body')).includes('We text'), 'no texting promises the server doesn\u2019t keep');
  await page.click('[data-key=confirm]');
  await page.waitForSelector('[data-contractor=c-1]');
  await snap(page, 'done-pick');
  await page.click('[data-contractor=c-1]');
  await page.waitForFunction(() => document.body.textContent.includes('Diaz Plumbing has your request'));
  await snap(page, 'done-picked');

  const calls = await log();
  const paths = calls.map((c) => `${c.method} ${c.path.split('?')[0]}`);
  assert.deepEqual(paths.slice(0, 2).sort(), ['GET /config/pricing', 'GET /trades'], 'only public calls before sign-in');
  assert.ok(!calls.slice(0, 2).some((c) => c.auth), 'no token on public calls');
  const seq = paths.filter((p) => !p.startsWith('GET /trades') && !p.startsWith('GET /config'));
  assert.deepEqual(seq, [
    'POST /auth/check-exists', 'POST /auth/email-signup/send-otp', 'POST /auth/email-signup/verify-otp', 'POST /auth/email-signup/verify-otp',
    'GET /auth/me', 'GET /properties', 'GET /stripe/customer/payment-method',
    'GET /places/autocomplete', 'GET /places/details', 'POST /properties/check-type', 'POST /properties/shell', 'POST /properties/p-1/confirm',
    'GET /jobs/cancellation-terms', 'POST /jobs', 'POST /jobs/j-1042/photos', 'GET /jobs/j-1042', 'GET /jobs/j-1042/matched-contractors', 'POST /jobs/j-1042/select-contractor',
  ]);
  const verify = calls.find((c) => c.path === '/auth/email-signup/verify-otp').body;
  assert.deepEqual(Object.keys(verify).sort(), ['appVersion', 'code', 'deviceId', 'deviceName', 'deviceType', 'email', 'firstName', 'lastName', 'password', 'phone', 'role']);
  assert.equal(verify.phone, '+15125550123');
  assert.equal(verify.role, 'HOMEOWNER');
  assert.equal(verify.deviceType, 'web');
  const job = calls.find((c) => c.path === '/jobs').body;
  assert.deepEqual(Object.keys(job).sort(), ['description', 'idempotencyKey', 'propertyId', 'scheduledDate', 'scheduledTimeWindow', 'title', 'tradeId']);
  assert.equal(job.title, 'Plumbing · Clogged drain');
  assert.equal(job.propertyId, 'p-1');
  assert.equal(job.tradeId, 't-plumb');
  assert.equal(job.scheduledTimeWindow, 'MIDDAY');
  assert.match(job.scheduledDate, /T00:00:00[+-]\d\d:\d\d$/, "local midnight; the server adds the window");
  const photos = calls.find((c) => c.path.endsWith('/photos'));
  assert.match(photos.body._contentType, /^multipart\/form-data/);
  assert.ok(calls.filter((c) => c.path.startsWith('/jobs')).every((c) => c.auth === 'Bearer acc-1'));
  console.log('✓ Standard: sign-up → home → review → pick a pro');
  await ctx.close();
}

// ── Run 2: Express, signed in, no card yet, draft survives a reload ──
{
  await reset('?card=false');
  const { ctx, page } = await fresh();
  await page.goto(`${PAGE}&trade=hvac`);
  await page.waitForSelector('.b-choice');
  assert.match(await page.textContent('.b-h1'), /HVAC/);
  await page.click('.b-choice'); // No cool air
  await describeAndSpeed(page, 'EXPRESS', 'Upstairs unit runs but blows warm air.');
  await signUp(page);
  await addHome(page);
  await page.waitForSelector('.b-cardhost');
  await snap(page, 'card');
  assert.match(await page.textContent('.b-sub'), /\$20 fee is held/);
  // The card form gets the key the server published (GET /config/web), not one kept in the site.
  await page.waitForSelector('.b-cardhost[data-stripe-mounted]');
  assert.equal(await page.evaluate(() => window.__stripeKey), 'pk_test_stubFromServer123');
  // No Stripe here (offline); the server says a card exists after a reload, the way it would after confirm-card.
  await fetch(`${BASE}/__reset?card=true`); // keeps the session; resets the world (home is re-added below)
  await fetch(`${BASE}/__credits?n=15`);
  await page.reload();
  // The photo file can't survive a reload: the page says so and asks for it on the details step, then resumes.
  await page.waitForSelector('#f-description');
  await page.waitForFunction(() => /didn’t survive the reload/.test(document.getElementById('book-toast').textContent));
  assert.equal(await page.inputValue('#f-description'), 'Upstairs unit runs but blows warm air.');
  await page.click('[data-key=next]');
  // The home is gone too (the stub was reset): the page asks for it again.
  await addHome(page);
  await page.waitForSelector('[data-key=confirm]');
  assert.match(await page.textContent('[data-key=confirm]'), /closest pro/);
  assert.match(await page.textContent('.b-card'), /\$40\s*\$20/);
  // The server says there are 15 spendable credits: the opt-in shows, off; ticking it sends only the opt-in.
  await page.waitForSelector('#f-credits');
  assert.equal(await page.isChecked('#f-credits'), false);
  assert.match(await page.textContent('.b-check'), /You have 15/);
  await page.check('#f-credits');
  assert.match(await page.textContent('.b-card'), /\$40\s*\$20/, 'the fee shown is still the server’s');
  await page.click('[data-key=confirm]');
  await page.waitForFunction(() => document.body.textContent.includes('The closest pro gets it first'));
  await snap(page, 'done-express');
  const calls = await log();
  const job = calls.find((c) => c.path === '/jobs').body;
  assert.equal(job.isExpress, true);
  assert.equal(job.shownFeeCents, 2000);
  assert.equal(job.useCreditsForExpressFee, true);
  assert.ok(calls.some((c) => c.method === 'GET' && c.path === '/nohmcredit/balance'));
  assert.equal(job.scheduledDate, undefined);
  assert.equal(job.title, 'HVAC · No cool air');
  console.log('✓ Express: ?trade= deep link, card step shown when missing, draft survives reload, shown fee sent, NOHM Credits opt-in sent only when ticked');
  await ctx.close();
}

// ── Run 3: NOW, already signed in with a home ─────────────────────
{
  await reset();
  const { ctx, page } = await fresh();
  await page.goto(PAGE);
  await page.waitForSelector('[data-trade=PLUMBING]');
  await page.click('[data-trade=PLUMBING]');
  await page.waitForSelector('.b-choice');
  await page.click('.b-choice:nth-child(5)'); // Sewer backup
  await describeAndSpeed(page, 'NOW', 'Sewage coming up in the downstairs shower.');
  await page.waitForSelector('[data-key=signin], [data-key=signup]');
  await page.click('.b-tab:nth-child(2)');
  await page.fill('#f-email', 'ava@example.com');
  await page.fill('#f-password', 'password1');
  await page.click('[data-key=signin]');
  await addHome(page);
  await page.waitForSelector('[data-key=confirm]');
  assert.match(await page.textContent('[data-key=confirm]'), /ready now/);
  await page.click('[data-key=confirm]');
  await page.waitForSelector('[data-avail=av-1]');
  await snap(page, 'now-live');
  assert.match(await page.textContent('[data-avail=av-1]'), /Express Plumbing/);
  await page.click('[data-avail=av-1]');
  await page.waitForFunction(() => document.body.textContent.includes('A pro is on the way.'));
  await snap(page, 'done-now');
  const calls = await log();
  const d = calls.find((c) => c.path === '/now/dispatch').body;
  assert.deepEqual(d, { availabilityId: 'av-1', propertyId: 'p-1', tradeId: 't-plumb', issueSummary: 'Sewage coming up in the downstairs shower.', shownFeeCents: 3000 });
  assert.ok(!calls.some((c) => c.path === '/jobs' && c.method === 'POST'), 'NOW never goes through POST /jobs');
  console.log('✓ NOW: sign-in with password, live list, dispatch body');
  await ctx.close();
}

// ── Run 4: the error paths on send: price change, 409s, browser Back ─
{
  await reset();
  const { ctx, page } = await fresh();
  await page.goto(`${PAGE}&trade=electrical`);
  await page.waitForSelector('.b-choice');
  await page.click('.b-choice');
  await describeAndSpeed(page, 'EXPRESS', 'Breaker for the kitchen trips every hour.');
  await signUp(page);
  await addHome(page);
  await page.waitForSelector('[data-key=confirm]');
  // No spendable credits on the server: no offer.
  for (let i = 0; i < 50 && !(await log()).some((c) => c.path === '/nohmcredit/balance'); i++) await page.waitForTimeout(100);
  await page.waitForTimeout(200);
  assert.equal(await page.$('#f-credits'), null, 'no credits, no offer');

  // The fee changes under the person: the server refuses, the page reloads the price and says so.
  await fetch(`${BASE}/__express-price?cents=4000`);
  await page.click('[data-key=confirm]');
  await page.waitForFunction(() => document.querySelector('#book-toast') && !document.querySelector('#book-toast').hidden && /fee just changed/.test(document.querySelector('#book-toast').textContent));
  await page.waitForFunction(() => /\$40/.test(document.querySelector('.b-total').textContent) && !/\$20/.test(document.querySelector('.b-total').textContent));
  let calls = await log();
  const firstKey = calls.filter((c) => c.path === '/jobs' && c.method === 'POST').pop().body.idempotencyKey;

  // Two 409s in a row: one retry, then the key is retired and the person is told.
  await fetch(`${BASE}/__conflicts?n=2`);
  await page.click('[data-key=confirm]');
  await page.waitForSelector('.b-err:not(:empty)');
  assert.match(await page.textContent('.b-err'), /fresh request/);
  calls = await log();
  const posts = calls.filter((c) => c.path === '/jobs' && c.method === 'POST');
  assert.equal(posts.length, 3, 'one price-changed attempt, then exactly two tries on the conflict');
  assert.notEqual(posts[1].body.idempotencyKey, firstKey, 'a price change retires the key');
  assert.equal(posts[1].body.idempotencyKey, posts[2].body.idempotencyKey, 'the one retry reuses the key');
  assert.equal(posts[2].body.shownFeeCents, 4000);

  // Browser Back goes to the previous step; Forward returns.
  await page.goBack();
  await page.waitForFunction(() => document.getElementById('book').dataset.step !== 'review');
  assert.equal(await page.evaluate(() => document.getElementById('book').dataset.step), 'home');
  await page.goForward();
  await page.waitForSelector('[data-key=confirm]');

  // Editing the note after a failed send retires the key, so the next send is a new request.
  await page.click('.b-row .b-edit'); // Service → service step
  await page.waitForSelector('[data-trade=ELECTRICAL]');
  await page.click('[data-trade=ELECTRICAL]');
  await page.click('.b-choice');
  await page.fill('#f-description', 'Breaker for the kitchen trips every hour, and the outlet is warm.');
  await page.click('[data-key=next]');
  await page.click('[data-tier=EXPRESS]');
  await page.waitForSelector('[data-key=confirm]');
  await page.click('[data-key=confirm]');
  await page.waitForFunction(() => document.body.textContent.includes('The closest pro gets it first'));
  calls = await log();
  const last = calls.filter((c) => c.path === '/jobs' && c.method === 'POST').pop().body;
  assert.notEqual(last.idempotencyKey, posts[2].body.idempotencyKey, 'an edit means a new key');
  assert.ok(calls.filter((c) => c.path === '/jobs' && c.method === 'POST').every((c) => !('useCreditsForExpressFee' in c.body)), 'no opt-in unless ticked');
  assert.match(last.description, /outlet is warm/);
  console.log('✓ Errors: PRICE_CHANGED reloads and retires the key, 409 retries once then stops, Back/Forward, edits get a new key');
  await ctx.close();
}

// ── Run 5: NOW with a pro that gets taken; Back from the live list ──
{
  await reset();
  const { ctx, page } = await fresh();
  await page.goto(PAGE);
  await page.waitForSelector('[data-trade=PLUMBING]');
  await page.click('[data-trade=PLUMBING]');
  await page.click('.b-choice');
  await page.fill('#f-description', 'leak');
  await page.click('[data-key=next]');
  await page.click('[data-tier=NOW]');
  // NOW needs a fuller note: back to details with the reason, not a dead end at the end.
  await page.waitForSelector('#f-description');
  await page.fill('#f-description', 'Water pouring from under the kitchen sink.');
  await page.click('[data-key=next]');
  await page.click('[data-tier=NOW]');
  await signUp(page);
  await addHome(page);
  await page.waitForSelector('[data-key=confirm]');
  await page.click('[data-key=confirm]');
  await page.waitForSelector('[data-avail=av-1]');
  assert.ok(await page.$('.b-foot .b-btn.sec'), 'the live list has a Back button');
  await page.click('.b-foot .b-btn.sec');
  await page.waitForSelector('[data-key=confirm]');
  console.log('✓ NOW: a short note is sent back to details with the reason; the live list has a way back');
  await ctx.close();
}

// ── Run 6: photos: big ones shrunk in the browser, EXIF turned upright, one per request, a failure named ──
{
  await reset();
  // A 4000×3000 photo of noise: about 36 MB as PNG, well over the server's 10 MB per photo.
  const big = path.join(os.tmpdir(), 'nohm-big.png');
  fs.writeFileSync(big, noisePng(4000, 3000));
  assert.ok(fs.statSync(big).size > 30 * 1024 * 1024);
  const { ctx, page } = await fresh();
  await page.goto(`${PAGE}&trade=plumbing`);
  await page.waitForSelector('.b-choice');
  // A 3000×1000 JPEG whose EXIF says "rotate 90°": the phone held upright. Upright it is 1000×3000.
  const wide = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 3000; c.height = 1000;
    const g = c.getContext('2d');
    g.fillStyle = '#356CA3'; g.fillRect(0, 0, 3000, 1000);
    g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 1000);
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return Array.from(new Uint8Array(await b.arrayBuffer()));
  });
  const rotated = path.join(os.tmpdir(), 'nohm-rotated.jpg');
  fs.writeFileSync(rotated, withExifOrientation(Buffer.from(wide), 6));
  const tiny = path.join(os.tmpdir(), 'nohm-tiny.png');
  fs.writeFileSync(tiny, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));

  await page.click('.b-choice');
  await page.fill('#f-description', 'Water under the sink, cabinet floor is soft.');
  await page.setInputFiles('#f-photos', [big, rotated, tiny]);
  await page.waitForFunction(() => document.querySelectorAll('.b-thumb').length === 3, null, { timeout: 30000 });
  await page.click('[data-key=next]');
  await page.click('[data-tier=EXPRESS]');
  await page.waitForSelector('[data-key=signin], [data-key=signup]');
  await page.click('.b-tab:nth-child(2)');
  await page.fill('#f-email', 'ava@example.com');
  await page.fill('#f-password', 'password1');
  await page.click('[data-key=signin]');
  await addHome(page);
  await page.waitForSelector('[data-key=confirm]');
  assert.match(await page.textContent('.b-card'), /Photos\s*3/);
  await fetch(`${BASE}/__photo-fail?nth=2`); // the server refuses the second photo
  await page.click('[data-key=confirm]');
  await page.waitForSelector('.b-photofail');
  await snap(page, 'done-photo-failed');
  assert.match(await page.textContent('.b-photofail'), /the photo nohm-rotated\.jpg didn’t upload \(That upload is too large\)/);
  assert.match(await page.textContent('.b-h1'), /Request sent/);

  const calls = await log();
  const posts = calls.filter((c) => /^\/jobs\/[^/]+\/photos$/.test(c.path));
  assert.equal(posts.length, 3, 'one request per photo');
  for (const p of posts) {
    assert.equal(p.body._files.length, 1, 'exactly one photo in each request');
    assert.equal(p.body._files[0].field, 'files');
    assert.ok(p.body._bytes < 25 * 1024 * 1024, 'each request is under the server cap');
    assert.ok(p.body._files[0].size <= 10 * 1024 * 1024, 'each photo is within the server’s 10 MB');
  }
  const [b, r, t] = posts.map((p) => p.body._files[0]);
  assert.equal(b.name, 'nohm-big.jpg');
  assert.equal(b.type, 'image/jpeg');
  assert.deepEqual([b.width, b.height], [2048, 1536], 'long edge capped at 2048, shape kept');
  assert.deepEqual([r.width, r.height], [683, 2048], 'the EXIF rotation is baked in: upright, then capped');
  assert.equal(t.name, 'nohm-tiny.png', 'a tiny photo goes as it is');
  assert.deepEqual(posts.map((p) => p.status), [200, 413, 200]);
  console.log('✓ Photos: a 36 MB photo shrunk to 2048 px JPEG, EXIF orientation kept upright, one request each, the failed one named');
  await ctx.close();
}

// ── Run 7: the server’s web settings don't load: card entry and Google say so ──
for (const mode of ['fail', 'empty']) {
  await reset('?card=false');
  await fetch(`${BASE}/__webconfig?mode=${mode}`);
  const { ctx, page } = await fresh();
  await page.goto(`${PAGE}&trade=hvac`);
  await page.waitForSelector('.b-choice');
  await page.click('.b-choice');
  await page.fill('#f-description', 'Upstairs unit runs but blows warm air.');
  await page.click('[data-key=next]');
  await page.click('[data-tier=EXPRESS]');
  await page.waitForSelector('.b-google-off');
  assert.match(await page.textContent('.b-google-off'), /Google isn’t available/);
  await page.click('.b-tab:nth-child(2)');
  await page.fill('#f-email', 'ava@example.com');
  await page.fill('#f-password', 'password1');
  await page.click('[data-key=signin]');
  await addHome(page);
  await page.waitForSelector('.b-cardhost');
  await page.waitForFunction(() => /Card entry isn’t available/.test(document.querySelector('.b-err').textContent));
  assert.equal(await page.evaluate(() => window.__stripeKey), undefined, 'no card form without the server’s key');
  assert.equal(await page.$eval('[data-key=savecard]', (b) => b.disabled), true);
  console.log(`✓ /config/web ${mode}: no card form and no Google button, each with a clear message`);
  await ctx.close();
}

await browser.close();
console.log('all e2e runs passed');
