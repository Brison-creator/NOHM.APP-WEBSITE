// Shared by the /book headless runs (tools/book/e2e.mjs): the browser,
// the stub's controls, and the steps several runs walk (describe and
// pick a speed, sign up, add a home). Run files import from here.

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

export const PORT = Number(process.env.PORT || 8787);
export const BASE = `http://localhost:${PORT}`;
export const PAGE = `${BASE}/book/?api=${BASE}/api/v1`;

export const reset = (q = '') => fetch(`${BASE}/__reset${q}`).then((r) => r.json());
export const log = () => fetch(`${BASE}/__log`).then((r) => r.json());
const shots = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

export const browser = await chromium.launch();
let n = 0;
export async function snap(page, name) {
  const text = await page.textContent('#book');
  assert.ok(!/\bnull\b|\bundefined\b/.test(text), `stray null/undefined on ${name}: ${text.slice(0, 200)}`);
  if (shots) await page.waitForTimeout(350); // let the screen's fade-in finish
  if (shots) await page.screenshot({ path: path.join(shots, `${String(++n).padStart(2, '0')}-${name}.png`), fullPage: true });
}

// window.__cardChange({ complete: true }) plays the person finishing the
// card fields; confirmCardSetup succeeds, recording the client secret.
const FAKE_STRIPE = `window.Stripe = function (key) {
  window.__stripeKey = key;
  return {
    elements: function () { return { create: function () { return { mount: function (el) { el.dataset.stripeMounted = '1'; }, on: function (ev, fn) { if (ev === 'change') window.__cardChange = fn; }, destroy: function () {} }; } }; },
    confirmCardSetup: function (secret) { window.__confirmedSecret = secret; return Promise.resolve({ setupIntent: { status: 'succeeded' } }); },
  };
};`;

/** A PNG of random pixels (it doesn't compress, so it's as big as it looks). */
export function noisePng(w, h) {
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
export function withExifOrientation(jpeg, o) {
  const tiff = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0, 0, 0, 0, 0]);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const len = Buffer.alloc(2); len.writeUInt16BE(payload.length + 2);
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1]), len, payload, jpeg.subarray(2)]);
}

/** Every phone field on the screen carries the SMS consent words under it. */
export async function consentUnderEveryPhone(page, where) {
  const fields = await page.$$eval('input[type=tel]', (els) => els.map((el) => (el.closest('.b-field').querySelector('.b-hint') || {}).textContent || ''));
  assert.ok(fields.length > 0, `a phone field on ${where}`);
  for (const hint of fields) assert.match(hint, /agree to get account texts from NOHM.*Reply STOP to opt out/, `SMS consent under the phone field on ${where}`);
}

export async function fresh() {
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

export async function describeAndSpeed(page, tier, text) {
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

export async function signUp(page) {
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

export async function addHome(page) {
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
