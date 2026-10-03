// /book against the server that's live today (stub legacy mode): no
// /config/web and no phone sign-up (both 404), and 401s without codes.
// The site falls back to LEGACY_WEB_CONFIG for the card, offers no phone
// sign-up, still refreshes an expired session, and books end to end.

import assert from 'node:assert/strict';
import { BASE, PAGE, reset, log, snap, fresh, signUp, addHome } from './lib.mjs';

const LEGACY_KEY = 'pk_live_51Ssr6TGRifyQNvisAhdcN4bxhMn0CIzJhoTwhy2HC43a7vCmMl8ydkvR3PSMXcCzFcJEEJTtF9QvvsuTTf3igRt5007K5t99sr';

// ── Run 10: legacy server: sign up by email, card with the fallback key, expired session refreshed, booked ──
{
  await reset('?card=false');
  await fetch(`${BASE}/__legacy/on`);
  const { ctx, page } = await fresh();
  await page.goto(`${PAGE}&trade=hvac`);
  await page.waitForSelector('.b-choice');
  await page.click('.b-choice');
  await page.fill('#f-description', 'Upstairs unit runs but blows warm air.');
  await page.click('[data-key=next]');
  await page.click('[data-tier=EXPRESS]');
  // Once /config/web has answered (404), Google is off and there's no phone sign-up.
  await page.waitForSelector('.b-google-off');
  await page.waitForTimeout(200);
  assert.equal(await page.isVisible('[data-key=phone-signup]'), false, 'no phone sign-up on the old server');
  await snap(page, 'legacy-account');
  await signUp(page);
  await page.waitForSelector('#f-address');
  // The old server's expired token: a 401 with no code still refreshes once and resends.
  await fetch(`${BASE}/__expire-once`);
  await addHome(page);
  await page.waitForSelector('.b-cardhost[data-stripe-mounted]');
  assert.equal(await page.evaluate(() => window.__stripeKey), LEGACY_KEY, 'the fallback key, only because /config/web is 404');
  await page.evaluate(() => window.__cardChange({ complete: true }));
  await page.click('[data-key=savecard]');
  await page.waitForSelector('[data-key=confirm]');
  assert.match(await page.textContent('.b-card'), /visa •••• 4242/);
  await page.click('[data-key=confirm]');
  await page.waitForFunction(() => document.body.textContent.includes('The closest pro gets it first'));
  await snap(page, 'legacy-done');

  const calls = await log();
  const web = calls.find((c) => c.path === '/config/web');
  assert.equal(web.status, 404);
  assert.equal(calls.filter((c) => c.path === '/config/web').length, 1, 'asked once');
  assert.ok(!calls.some((c) => c.path.startsWith('/auth/phone-signup')), 'phone sign-up never tried');
  const around = calls.map((c) => `${c.method} ${c.path.split('?')[0]} ${c.status}`).filter((x) => /autocomplete|refresh/.test(x));
  assert.deepEqual(around.slice(0, 3), ['GET /places/autocomplete 401', 'POST /auth/refresh 200', 'GET /places/autocomplete 200']);
  assert.deepEqual(calls.filter((c) => c.path.startsWith('/stripe/customer/') && c.method === 'POST').map((c) => c.path), ['/stripe/customer/setup-intent', '/stripe/customer/confirm-card']);
  assert.equal(await page.evaluate(() => window.__confirmedSecret), 'seti_secret');
  const job = calls.find((c) => c.path === '/jobs' && c.method === 'POST');
  assert.equal(job.status, 201);
  assert.equal(job.body.isExpress, true);
  console.log('✓ Legacy server: /config/web 404 → fallback key, card saved, no phone sign-up, a code-less 401 refreshed, booked');
  await ctx.close();
}

// ── Run 11: a send-otp 404 (old server reached anyway): the button goes, plain words, email still works ──
{
  await reset();
  const { ctx, page } = await fresh();
  await page.goto(`${PAGE}&trade=plumbing`);
  await page.waitForSelector('.b-choice');
  await page.click('.b-choice');
  await page.fill('#f-description', 'Toilet runs all night and the handle sticks.');
  await page.click('[data-key=next]');
  await page.click('[data-tier=EXPRESS]');
  await page.waitForSelector('[data-key=phone-signup]:visible');
  await fetch(`${BASE}/__legacy/on`); // the server changed under the page
  await page.click('[data-key=phone-signup]');
  await page.fill('#f-firstName', 'Ava');
  await page.fill('#f-lastName', 'Ng');
  await page.fill('#f-phone', '(512) 555-0123');
  await page.click('[data-key=phone-signup-send]');
  await page.waitForSelector('[data-key=signup]');
  await page.waitForFunction(() => document.querySelector('p.b-err').textContent === 'Phone sign-up isn’t available yet. Use email.');
  assert.ok(!(await page.textContent('#book')).includes('Cannot POST'), 'never the raw 404 text');
  assert.equal(await page.isVisible('[data-key=phone-signup]'), false, 'the button is gone');
  await fetch(`${BASE}/__legacy/off`);
  console.log('✓ Phone sign-up 404: the button goes and the page says to use email');
  await ctx.close();
}
