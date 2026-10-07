// /book run 10: "I'm human" on. The server gives a Turnstile site key;
// the box shows above the button, nothing is sent until it's ticked,
// the code goes out with its token, and a new code needs the box again.
// The security marks show under the form, "Human-verified" among them.

import assert from 'node:assert/strict';
import { BASE, PAGE, reset, log, snap, fresh, describeAndSpeed } from './lib.mjs';

// A stand-in for Cloudflare's script: a checkbox that hands over a token.
const FAKE_TURNSTILE = `window.turnstile = {
  render(el, o) { const l = document.createElement('label'); l.className = 'fake-ts'; const c = document.createElement('input'); c.type = 'checkbox';
    c.onchange = () => (c.checked ? o.callback('tok-human') : o['expired-callback']()); l.append(c, ' I am human'); el.append(l); this._c = c; return 'w1'; },
  reset() { if (this._c) this._c.checked = false; },
};`;

{
  await reset();
  await fetch(`${BASE}/__webconfig?mode=human`);
  const { ctx, page } = await fresh();
  await ctx.route('https://challenges.cloudflare.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_TURNSTILE }));
  await page.goto(`${PAGE}&trade=plumbing`);
  await page.waitForSelector('.b-choice');
  await page.click('.b-choice');
  await describeAndSpeed(page, 'EXPRESS', 'Kitchen faucet drips all night.');
  await page.waitForSelector('[data-key=signup]');
  await page.waitForSelector('.b-human .fake-ts');
  await page.waitForSelector('.b-trust');
  assert.match(await page.textContent('.b-trust'), /Encrypted.*Human-verified.*Never sold/s);
  await snap(page, 'account-human');

  await page.fill('#f-firstName', 'Ava');
  await page.fill('#f-lastName', 'Ng');
  await page.fill('#f-email', 'ava@example.com');
  await page.fill('#f-phone', '(512) 555-0123');
  await page.fill('#f-password', 'longenough1');
  await page.click('[data-key=signup]');
  await page.waitForFunction(() => [...document.querySelectorAll('p.b-err')].some((e) => /human first/.test(e.textContent)));
  assert.equal((await log()).filter((c) => c.path === '/auth/email-signup/send-otp').length, 0, 'nothing sent before the box');

  await page.check('.b-human .fake-ts input');
  await page.click('[data-key=signup]');
  await page.waitForSelector('#f-code');
  const sends = (await log()).filter((c) => c.path === '/auth/email-signup/send-otp');
  assert.equal(sends.length, 1);
  assert.equal(sends[0].status, 200);

  // A new code is another text: the box again.
  await page.waitForSelector('.b-human .fake-ts');
  await page.click('text=Send a new code');
  await page.waitForFunction(() => [...document.querySelectorAll('p.b-err')].some((e) => /human first/.test(e.textContent)));
  await page.check('.b-human .fake-ts input');
  await page.click('text=Send a new code');
  await page.waitForFunction(() => /Sent another code/.test(document.body.textContent));
  assert.equal((await log()).filter((c) => c.path === '/auth/email-signup/send-otp' && c.status === 200).length, 2);
  await ctx.close();
  console.log('✓ "I’m human": nothing sent until the box is ticked; the code and a new code each carry a token; Human-verified among the security marks');
}
