// /book runs 6–8: photos (shrunk, one per request, past 5 counted),
// the server's web settings missing, and phone sign-up.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BASE, PAGE, reset, log, snap, fresh, addHome, noisePng, withExifOrientation, consentUnderEveryPhone } from './lib.mjs';

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

// ── Run 6b: picking more than 5 photos: 5 are added and the rest are counted out loud ──
{
  await reset();
  const { ctx, page } = await fresh();
  await page.goto(`${PAGE}&trade=plumbing`);
  await page.waitForSelector('.b-choice');
  await page.click('.b-choice');
  await page.waitForSelector('#f-description');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  await page.setInputFiles('#f-photos', [1, 2, 3, 4, 5, 6, 7].map((n) => ({ name: `p${n}.png`, mimeType: 'image/png', buffer: png })));
  await page.waitForFunction(() => document.querySelectorAll('.b-thumb').length === 5);
  await page.waitForFunction(() => /Up to 5 photos; 2 not added\./.test(document.getElementById('book-toast').textContent));
  assert.equal(await page.isHidden('.b-addphoto'), true, 'no more to add');
  console.log('✓ Photos: 7 picked, 5 added, "Up to 5 photos; 2 not added."');
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

// ── Run 8: phone sign-up (no email, no password); the SMS consent under every phone field ──
{
  await reset();
  const { ctx, page } = await fresh();
  await page.goto(`${PAGE}&trade=plumbing`);
  await page.waitForSelector('.b-choice');
  await page.click('.b-choice');
  await page.fill('#f-description', 'Toilet runs all night and the handle sticks.');
  await page.click('[data-key=next]');
  await page.click('[data-tier=EXPRESS]');
  await page.waitForSelector('[data-key=phone-signup]');
  await consentUnderEveryPhone(page, 'email sign-up');
  await page.click('[data-key=phone-signup]');
  await page.waitForSelector('[data-key=phone-signup-send]');
  await snap(page, 'phone-signup');
  assert.equal(await page.$('#f-password'), null, 'no password on phone sign-up');
  await consentUnderEveryPhone(page, 'phone sign-up');
  // A phone that already has an account: the server's own words.
  await page.fill('#f-firstName', 'Ava');
  await page.fill('#f-lastName', 'Ng');
  await page.fill('#f-phone', '(512) 555-0100');
  await page.click('[data-key=phone-signup-send]');
  await page.waitForFunction(() => /already has an account/.test(document.querySelector('p.b-err').textContent));
  await page.fill('#f-phone', '(512) 555-0123');
  await page.click('[data-key=phone-signup-send]');
  await page.waitForSelector('#f-code');
  await page.fill('#f-code', '000000');
  await page.click('[data-key=verify]');
  await page.waitForSelector('#e-code:not(:empty)');
  await page.fill('#f-code', '123456');
  await page.click('[data-key=verify]');
  await addHome(page);
  await page.waitForSelector('[data-key=confirm]');
  await page.click('[data-key=confirm]');
  await page.waitForFunction(() => document.body.textContent.includes('The closest pro gets it first'));

  const calls = await log();
  const sends = calls.filter((c) => c.path === '/auth/phone-signup/send-otp');
  assert.deepEqual(sends.map((c) => c.body), [{ phone: '+15125550100', role: 'HOMEOWNER' }, { phone: '+15125550123', role: 'HOMEOWNER' }]);
  const verify = calls.filter((c) => c.path === '/auth/phone-signup/verify-otp').pop().body;
  assert.deepEqual(Object.keys(verify).sort(), ['appVersion', 'code', 'deviceId', 'deviceName', 'deviceType', 'firstName', 'lastName', 'phone', 'role']);
  assert.deepEqual([verify.phone, verify.firstName, verify.lastName, verify.role, verify.code, verify.deviceType], ['+15125550123', 'Ava', 'Ng', 'HOMEOWNER', '123456', 'web']);
  assert.ok(!calls.some((c) => c.path.startsWith('/auth/email-signup')), 'no email sign-up call');
  assert.ok(!calls.some((c) => c.path === '/auth/check-exists'), 'no email given, nothing to check');
  assert.ok(calls.some((c) => c.path === '/jobs' && c.method === 'POST' && c.auth === 'Bearer acc-1'));

  // Sign-in by text code has the consent line too.
  await reset();
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${PAGE}&trade=hvac`);
  await page.waitForSelector('.b-choice');
  await page.click('.b-choice');
  await page.fill('#f-description', 'No air at all from the vents upstairs.');
  await page.click('[data-key=next]');
  await page.click('[data-tier=EXPRESS]');
  await page.waitForSelector('.b-tab');
  await page.click('.b-tab:nth-child(2)');
  await page.click('text=Sign in with a text code instead');
  await page.waitForSelector('#f-phone');
  await consentUnderEveryPhone(page, 'text-code sign-in');
  console.log('✓ Phone sign-up: name + phone → code → account (server’s DTO exactly, taken phone shows the server’s message); SMS consent under every phone field');
  await ctx.close();
}
