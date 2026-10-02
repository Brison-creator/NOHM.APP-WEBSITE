// End to end for /join and /join/renter in headless Chromium against
// the stub: node tools/book/stub-server.mjs 8787 &  node tools/join/e2e.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const PORT = Number(process.env.PORT || 8787);
const BASE = `http://localhost:${PORT}`;
const api = `?api=${BASE}/api/v1`;
const reset = (q = '') => fetch(`${BASE}/__reset${q}`).then((r) => r.json());
const log = () => fetch(`${BASE}/__log`).then((r) => r.json());
const shots = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
let n = 0;

const browser = await chromium.launch();
async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw new Error(`page error: ${e.message}`); });
  return { ctx, page };
}
async function snap(page, name) {
  const text = await page.textContent('main');
  assert.ok(!/\bnull\b|\bundefined\b/.test(text), `stray null/undefined on ${name}`);
  if (shots) { await page.waitForTimeout(350); await page.screenshot({ path: path.join(shots, `${String(++n).padStart(2, '0')}-${name}.png`), fullPage: true }); }
}
async function signUp(page) {
  await page.waitForSelector('[data-key=signup]');
  await snap(page, 'account');
  await page.fill('#f-firstName', 'Ray');
  await page.fill('#f-lastName', 'Diaz');
  await page.fill('#f-email', 'ray@example.com');
  await page.fill('#f-phone', '501-555-0199');
  await page.fill('#f-password', 'longenough1');
  await page.click('[data-key=signup]');
  await page.waitForSelector('#f-code');
  await page.fill('#f-code', '123456');
  await page.click('[data-key=verify]');
}
const tmp = path.join(os.tmpdir(), 'nohm-doc.png');
fs.writeFileSync(tmp, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));

// ── Pro ───────────────────────────────────────────────────────────
{
  await reset();
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/join/${api}`);
  await signUp(page);

  await page.waitForSelector('#f-businessName');
  await snap(page, 'pro-profile');
  await page.click('[data-key=next]');
  await page.waitForSelector('.b-field.bad');
  assert.equal(await page.textContent('#e-businessName'), '2 to 40 characters', 'problems are named per field before anything is sent');
  await page.fill('#f-businessName', 'Diaz Plumbing');
  await page.selectOption('#f-primaryTradeId', 't-plumb');
  await page.fill('#f-baseZip', '72011');
  await page.click('[data-radius="30"]');
  await page.fill('#f-yearsExperience', '11');
  await page.fill('#f-licenseNumber', 'MP-4471');
  await page.fill('#f-serviceCallFeeRange', '$89');
  await page.click('[data-key=next]');

  await page.waitForSelector('[data-doc=HEADSHOT]');
  await snap(page, 'pro-documents');
  assert.ok(await page.$('[data-doc=TRADE_LICENSE]'), 'plumbing needs a trade license');
  await page.setInputFiles('#f-doc-HEADSHOT', tmp);
  await page.waitForFunction(() => document.querySelector('[data-doc=HEADSHOT]').classList.contains('on'));
  await page.setInputFiles('#f-doc-DRIVERS_LICENSE', tmp);
  await page.waitForFunction(() => document.querySelector('[data-doc=DRIVERS_LICENSE]').classList.contains('on'));
  await page.click('[data-key=next]');

  await page.waitForSelector('[data-key=stripe]');
  await snap(page, 'pro-payouts');
  const [popup] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-key=stripe]')]);
  // The tab opens inside the tap (blank), then goes to the link once the server returns it.
  await popup.waitForURL(/\/stripe\/return\//, { timeout: 10000 });
  await popup.close();
  await fetch(`${BASE}/__stripe-done`); // Stripe finished; the page polls status
  await page.waitForSelector('#f-attestedName', { timeout: 15000 });

  await snap(page, 'pro-agreement');
  assert.ok((await page.textContent('.b-standard')).includes('Price before work'), 'the Standard list is the site’s');
  await page.fill('#f-attestedName', 'R'); // the server wants 2 to 100 characters
  await page.click('[data-key=agree]');
  await page.waitForSelector('#e-attestedName:not(:empty)');
  await page.fill('#f-attestedName', 'Ray Diaz');
  await page.click('[data-key=agree]');

  await page.waitForSelector('[data-key=submit]');
  await snap(page, 'pro-review');
  assert.match(await page.textContent('.b-card'), /Diaz Plumbing/);
  assert.match(await page.textContent('.b-card'), /72011 · 30 miles/);
  assert.match(await page.textContent('.b-card'), /Stripe connected/);
  assert.match(await page.textContent('.b-card'), /2 to upload/);
  await page.click('[data-key=submit]');
  await page.waitForFunction(() => document.body.textContent.includes('Under review'));
  await snap(page, 'pro-status');

  // A reload lands on status, from the server's dashboard, not from anything saved here.
  await page.reload();
  await page.waitForFunction(() => document.body.textContent.includes('Under review'));

  const calls = await log();
  const prof = calls.find((c) => c.method === 'PATCH' && c.path === '/contractors/profile').body;
  assert.deepEqual(prof, { firstName: 'Ray', lastName: 'Diaz', businessName: 'Diaz Plumbing', baseZip: '72011', serviceRadius: 30, primaryTradeId: 't-plumb', licenseNumber: 'MP-4471', yearsExperience: 11, serviceCallFeeRange: '$89' });
  const verify = calls.find((c) => c.path === '/auth/email-signup/verify-otp').body;
  assert.equal(verify.role, 'CONTRACTOR');
  assert.equal(verify.phone, '+15015550199');
  const docs = calls.filter((c) => c.path === '/contractors/documents' && c.method === 'POST');
  assert.deepEqual(docs.map((d) => d.body._fields.docType), ['HEADSHOT', 'DRIVERS_LICENSE']);
  const seq = calls.map((c) => `${c.method} ${c.path}`).filter((x) => /stripe|attestation|video|submit-review/.test(x));
  assert.deepEqual(seq.slice(0, 2), ['GET /stripe/connect/status', 'GET /stripe/connect/status']);
  assert.ok(seq.includes('POST /stripe/connect/create'));
  assert.ok(seq.indexOf('POST /contractors/attestation') < seq.indexOf('POST /contractors/submit-review'));
  assert.ok(!seq.includes('POST /contractors/video-complete'), 'no video was shown, so none is marked watched');
  console.log('✓ Pro: sign-up → profile+trades → documents → Stripe (new tab, polled) → agreement → submit → under review, survives reload');
  await ctx.close();
}

// ── Renter ────────────────────────────────────────────────────────
{
  await reset();
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/join/renter/${api}`);
  await signUp(page);
  await page.waitForSelector('[data-invite="482913"]');
  await snap(page, 'renter-invite');
  assert.match(await page.textContent('[data-invite="482913"]'), /11008 Chambers Rd, Bauxite.*\$1,250 on the 1st/s);
  // The typed path first: a wrong code is refused before any call.
  await page.fill('#f-inviteCode', '12');
  await page.click('[data-key=next]');
  await page.waitForSelector('#e-inviteCode:not(:empty)');
  await page.click('[data-invite="482913"]');
  await page.waitForSelector('#f-otpCode');
  await snap(page, 'renter-confirm');
  await page.fill('#f-otpCode', '000000');
  await page.click('[data-key=accept]');
  await page.waitForSelector('#e-otpCode:not(:empty)');
  await page.fill('#f-otpCode', '123456');
  await page.click('[data-key=accept]');
  await page.waitForFunction(() => document.body.textContent.includes('Your lease is on NOHM'));
  await snap(page, 'renter-done');
  assert.match(await page.textContent('.b-card'), /HIN 7QW-3HN-2KD/);
  await page.reload();
  await page.waitForFunction(() => document.body.textContent.includes('Your lease is on NOHM'));

  const calls = await log();
  const seq = calls.map((c) => `${c.method} ${c.path}`).filter((x) => x.includes('/tenants/'));
  assert.deepEqual(seq.slice(0, 5), ['GET /tenants/my-property', 'GET /tenants/my-invites', 'GET /tenants/invite/482913', 'POST /tenants/invite/482913/send-otp', 'POST /tenants/invite/482913/accept']);
  assert.equal(calls.filter((c) => c.path.endsWith('/accept')).length, 2, 'the wrong code was sent once and refused');
  assert.equal(calls.find((c) => c.path === '/auth/email-signup/verify-otp').body.role, 'TENANT');
  console.log('✓ Renter: sign-up → invite (listed and typed) → text code → lease linked, survives reload');
  await ctx.close();
}

// ── Wrong account type ───────────────────────────────────────────
{
  await reset();
  const { ctx, page } = await fresh();
  await page.goto(`${BASE}/book/${api}`);
  await page.waitForSelector('[data-trade=PLUMBING]');
  await page.click('[data-trade=PLUMBING]');
  await page.click('.b-choice');
  await page.fill('#f-description', 'Leak under the sink, cabinet is wet.');
  await page.click('[data-key=next]');
  await page.click('[data-tier=EXPRESS]');
  await page.waitForSelector('[data-key=signup]');
  await page.fill('#f-firstName', 'Ava'); await page.fill('#f-lastName', 'Ng'); await page.fill('#f-email', 'ava@example.com'); await page.fill('#f-phone', '5125550123'); await page.fill('#f-password', 'longenough1');
  await page.click('[data-key=signup]');
  await page.waitForSelector('#f-code'); await page.fill('#f-code', '123456'); await page.click('[data-key=verify]');
  await page.waitForSelector('#f-address');
  await page.goto(`${BASE}/join/${api}`);
  await page.waitForFunction(() => document.body.textContent.includes('different kind of account'));
  await snap(page, 'wrong-role');
  console.log('✓ A homeowner on /join is told it’s a different kind of account');
  await ctx.close();
}

await browser.close();
console.log('all join e2e runs passed');
