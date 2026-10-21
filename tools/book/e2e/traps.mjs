// /book run 14: the spam checks (public/nohm/form-traps.js). The account
// screen has one decoy, out of sight and out of the tab order, through
// every mode; the code sends (and a new code) carry formTrap with the
// decoy empty and the time on screen, and no other call does; a filled
// decoy's 400 TRY_AGAIN shows the server's words (never "don't match");
// a throwaway email's 400 BAD_EMAIL shows under the email field, or on
// the code screen as the screen's error.

import assert from 'node:assert/strict';
import { PAGE, reset, log, snap, fresh } from './lib.mjs';

const TRAPPED = new Set(['/auth/email-signup/send-otp', '/auth/phone-signup/send-otp', '/auth/social-signup/send-otp', '/auth/login/send-otp', '/auth/login/email-password']);
const errText = (page) => page.$$eval('p.b-err', (els) => els.map((e) => e.textContent).join(' '));

/** A request carries formTrap as a person leaves it: an empty decoy, whole ms on screen. */
function assertTrap(entry, where) {
  assert.ok(entry && entry.formTrap, `${where} carries formTrap`);
  assert.deepEqual(Object.keys(entry.formTrap).sort(), ['hp', 'ms'], where);
  assert.equal(entry.formTrap.hp, '', `${where}: the decoy left empty`);
  assert.ok(Number.isInteger(entry.formTrap.ms) && entry.formTrap.ms > 0, `${where}: whole ms on screen (${entry.formTrap.ms})`);
}
/** Only the five auth calls carried formTrap, and the server never refused it as unknown. */
function onlyTrapped(calls) {
  for (const c of calls) if (c.formTrap) assert.ok(TRAPPED.has(c.path), `${c.method} ${c.path} carries formTrap`);
  assert.ok(!calls.some((c) => JSON.stringify(c.error || '').includes('formTrap')), 'no call refused for formTrap');
}
/** Exactly one decoy on the screen: in the form, off screen, hidden from screen readers, out of the tab order. */
async function assertDecoy(page, where) {
  const d = await page.$$eval('input[name=nohm_extra_field]', (els) => els.map((el) => {
    const wrap = el.closest('[aria-hidden="true"]');
    const r = el.getBoundingClientRect();
    return { inForm: Boolean(el.closest('form')), hidden: Boolean(wrap), display: wrap && getComputedStyle(wrap).display, offScreen: r.right <= 0, tabindex: el.getAttribute('tabindex'), autocomplete: el.getAttribute('autocomplete'), type: el.type, label: el.closest('label').textContent };
  }));
  assert.equal(d.length, 1, `${where}: one decoy`);
  assert.deepEqual(d[0], { inForm: true, hidden: true, display: 'block', offScreen: true, tabindex: '-1', autocomplete: 'off', type: 'text', label: 'Leave this empty' }, where);
}
async function toAccount(page, text) {
  await page.goto(`${PAGE}&trade=plumbing`);
  await page.waitForSelector('.b-choice');
  await page.click('.b-choice');
  await page.fill('#f-description', text);
  await page.click('[data-key=next]');
  await page.click('[data-tier=EXPRESS]');
  await page.waitForSelector('[data-key=signup]');
}

// ── Email sign-up: one decoy through every mode, never tabbed to; a throwaway email; a new code ──
{
  await reset();
  const { ctx, page } = await fresh();
  await toAccount(page, 'Water heater pilot light keeps going out.');
  await assertDecoy(page, 'email sign-up');
  // Tab from the first field past the button and the links: the decoy is never focused.
  await page.focus('#f-firstName');
  const seen = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => { const a = document.activeElement; return a ? a.name || a.dataset.key || a.textContent.trim().slice(0, 20) : ''; }));
  }
  assert.ok(seen.includes('signup'), `the walk passed the button (${seen.join(' | ')})`);
  assert.ok(!seen.includes('nohm_extra_field'), 'never focused by Tab');
  // Switching modes moves the one decoy; it never stacks.
  await page.click('.b-tab:nth-child(2)');
  await page.waitForSelector('[data-key=signin]');
  await assertDecoy(page, 'sign in');
  await page.click('text=Sign in with a text code instead');
  await page.waitForSelector('[data-key=phone]');
  await assertDecoy(page, 'sign in by text code');
  await page.click('text=Use my password instead');
  await page.click('.b-tab:nth-child(1)');
  await page.waitForSelector('[data-key=signup]');
  await assertDecoy(page, 'back to sign-up');

  // A throwaway email: the server's words under the email field.
  await page.fill('#f-firstName', 'Ava');
  await page.fill('#f-lastName', 'Ng');
  await page.fill('#f-email', 'ava@mailinator.com');
  await page.fill('#f-phone', '(512) 555-0123');
  await page.fill('#f-password', 'longenough1');
  await page.click('[data-key=signup]');
  await page.waitForSelector('#e-email:not(:empty)');
  assert.match(await page.textContent('#e-email'), /Throwaway addresses can’t be used/);
  assert.equal((await errText(page)).trim(), '', 'said at the field, not again below');
  await snap(page, 'trap-bad-email');
  await page.fill('#f-email', 'ava@example.com');
  await page.click('[data-key=signup]');
  await page.waitForSelector('#f-code');
  await assertDecoy(page, 'code screen (a new code is a send-otp)');
  await page.click('text=Send a new code');
  await page.waitForFunction(() => /Sent another code/.test(document.body.textContent));
  await page.fill('#f-code', '123456');
  await page.click('[data-key=verify]');
  await page.waitForSelector('#f-address');

  const calls = await log();
  const sends = calls.filter((c) => c.path === '/auth/email-signup/send-otp');
  assert.deepEqual(sends.map((c) => c.status), [400, 200, 200], 'throwaway refused, then the code, then a new code');
  assert.equal(sends[0].error.code, 'BAD_EMAIL');
  sends.forEach((c, i) => assertTrap(c, `email sign-up send-otp #${i + 1}`));
  assert.ok(sends.every((c) => !('formTrap' in c.body)), 'the stub took it off like humanToken');
  for (const p of ['/auth/check-exists', '/auth/email-signup/verify-otp']) assert.ok(calls.some((c) => c.path === p) && calls.filter((c) => c.path === p).every((c) => !c.formTrap), `${p} carries no formTrap`);
  onlyTrapped(calls);
  console.log('✓ Spam checks: one decoy (off screen, aria-hidden, never tabbed to) through every mode; send-otp and a new code carry formTrap, nothing else; BAD_EMAIL under the email field');
  await ctx.close();
}

// ── A bot fills the decoy on password sign-in: the server's TRY_AGAIN words, not "don't match" ──
{
  await reset();
  const { ctx, page } = await fresh();
  await toAccount(page, 'Garbage disposal hums but won’t spin.');
  await page.click('.b-tab:nth-child(2)');
  await page.fill('#f-email', 'ava@example.com');
  await page.fill('#f-password', 'password1');
  await page.evaluate(() => { document.querySelector('input[name=nohm_extra_field]').value = 'http://spam.example'; });
  await page.click('[data-key=signin]');
  await page.waitForFunction(() => [...document.querySelectorAll('p.b-err')].some((e) => /Wait a moment, then try again/.test(e.textContent)));
  assert.doesNotMatch(await errText(page), /don’t match/);
  await snap(page, 'trap-try-again');
  const tried = (await log()).filter((c) => c.path === '/auth/login/email-password');
  assert.equal(tried.length, 1);
  assert.deepEqual([tried[0].status, tried[0].error.code, tried[0].formTrap.hp], [400, 'TRY_AGAIN', 'http://spam.example']);
  // A person's wrong password is still "don't match"; the right one signs in.
  await page.evaluate(() => { document.querySelector('input[name=nohm_extra_field]').value = ''; });
  await page.fill('#f-password', 'not-the-password');
  await page.click('[data-key=signin]');
  await page.waitForFunction(() => [...document.querySelectorAll('p.b-err')].some((e) => /don’t match/.test(e.textContent)));
  await page.fill('#f-password', 'password1');
  await page.click('[data-key=signin]');
  await page.waitForSelector('#f-address');
  const calls = await log();
  calls.filter((c) => c.path === '/auth/login/email-password').slice(1).forEach((c, i) => assertTrap(c, `password sign-in #${i + 2}`));
  onlyTrapped(calls);
  console.log('✓ Spam checks: a filled decoy on sign-in gets the server’s TRY_AGAIN words (not "don’t match"); a wrong password still reads "don’t match"');
  await ctx.close();
}

// ── Phone sign-up with a throwaway email: refused at the code (where the email is sent), said as the screen's error ──
{
  await reset();
  const { ctx, page } = await fresh();
  await toAccount(page, 'Shutoff valve under the sink drips.');
  await page.click('[data-key=phone-signup]');
  await page.waitForSelector('[data-key=phone-signup-send]');
  await assertDecoy(page, 'phone sign-up');
  await page.fill('#f-firstName', 'Ava');
  await page.fill('#f-lastName', 'Ng');
  await page.fill('#f-phone', '(512) 555-0123');
  await page.fill('#f-email', 'ava@mailinator.com');
  await page.click('[data-key=phone-signup-send]');
  await page.waitForSelector('#f-code');
  await page.fill('#f-code', '123456');
  await page.click('[data-key=verify]');
  await page.waitForFunction(() => [...document.querySelectorAll('p.b-err')].some((e) => /Throwaway addresses/.test(e.textContent)));
  assert.equal(await page.textContent('#e-code'), '', 'not the code’s fault');
  const calls = await log();
  assertTrap(calls.find((c) => c.path === '/auth/phone-signup/send-otp'), 'phone sign-up send-otp');
  const verify = calls.find((c) => c.path === '/auth/phone-signup/verify-otp');
  assert.deepEqual([verify.status, verify.error.code, Boolean(verify.formTrap)], [400, 'BAD_EMAIL', false]);
  onlyTrapped(calls);
  console.log('✓ Spam checks: phone sign-up send-otp carries formTrap; a throwaway email refused at the code is the screen’s error, not the code’s');
  await ctx.close();
}
