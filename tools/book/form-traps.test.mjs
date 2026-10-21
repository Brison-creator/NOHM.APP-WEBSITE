// node --test tools/book
// The spam checks' decoy and clock (public/nohm/form-traps.js): `ms` is
// whole milliseconds on screen, `hp` the decoy's value; the decoy is off
// screen, hidden from screen readers, out of the tab order and named so
// nothing autofills it; and only the five auth calls carry formTrap
// (the server refuses it anywhere else). /pro and /rentals are covered in
// tools/join/e2e.mjs, tools/rentals/rentals.test.mjs and its e2e.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { elapsedMs, trapFields, formTrapField, formTrap, addFormTrap, TRAP_NAME, TRAP_LABEL, MAX_MS } from '../../public/nohm/form-traps.js';
import { createApi } from '../../public/nohm/api.js';
import { createSession } from '../../public/nohm/session.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

/** Just enough DOM for the decoy; any HTML string throws. */
function fakeDoc() {
  class Text { constructor(t) { this.data = String(t); this.parent = null; } get textContent() { return this.data; } }
  class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.style = {}; this.className = ''; this.parent = null; this.value = ''; }
    append(...kids) {
      for (const k of kids) {
        const kid = typeof k === 'string' ? new Text(k) : k;
        if (kid.parent) kid.parent.children.splice(kid.parent.children.indexOf(kid), 1);
        kid.parent = this;
        this.children.push(kid);
      }
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] ?? null; }
    get textContent() { return this.children.map((c) => c.textContent).join(''); }
    set innerHTML(_) { throw new Error('innerHTML used'); }
    insertAdjacentHTML() { throw new Error('insertAdjacentHTML used'); }
    all() { return [this, ...this.children.flatMap((c) => (c instanceof El ? c.all() : []))]; }
  }
  return { createElement: (t) => new El(t), createTextNode: (t) => new Text(t), El };
}
/** A clock the test moves by hand. */
function clock(t = 1000) {
  const c = () => t;
  c.at = (v) => { t = v; };
  return c;
}

test('ms: whole milliseconds on screen, never negative, never past a 32-bit int', () => {
  assert.equal(elapsedMs(1000, 1000), 0);
  assert.equal(elapsedMs(1000, 1500.4), 500);
  assert.equal(elapsedMs(1000, 1500.6), 501);
  assert.equal(elapsedMs(2000, 1000), 0, 'a clock that went back reads 0');
  assert.equal(elapsedMs(NaN, 1000), 0);
  assert.equal(elapsedMs(undefined, 1000), 0);
  assert.equal(elapsedMs(0, 1e12), MAX_MS);
  assert.ok(Number.isInteger(elapsedMs(0.3, 7.9)));
});

test('the body field: { formTrap: { hp, ms } }, hp exactly as typed', () => {
  assert.deepEqual(trapFields('', 0, 4200.2), { formTrap: { hp: '', ms: 4200 } });
  assert.deepEqual(trapFields(null, 0, 1), { formTrap: { hp: '', ms: 1 } });
  assert.deepEqual(trapFields(' spam ', 10, 20), { formTrap: { hp: ' spam ', ms: 10 } });
});

test('only a well-formed formTrap is spread into a body; anything else adds nothing', () => {
  assert.deepEqual(formTrapField({ formTrap: { hp: '', ms: 5 } }), { formTrap: { hp: '', ms: 5 } });
  assert.deepEqual(formTrapField({ formTrap: { hp: 'x', ms: 5, extra: 1 }, other: 2 }), { formTrap: { hp: 'x', ms: 5 } }, 'nothing else rides along');
  for (const bad of [undefined, null, {}, { formTrap: null }, { formTrap: { hp: 1, ms: 5 } }, { formTrap: { hp: '', ms: 1.5 } }, { formTrap: { hp: '', ms: -1 } }, { formTrap: { hp: '' } }]) {
    assert.deepEqual(formTrapField(bad), {}, JSON.stringify(bad));
  }
});

test('the decoy: off screen (not display:none), hidden from screen readers, out of the tab order, never autofilled', () => {
  const doc = fakeDoc();
  const t = formTrap({ doc, now: clock() });
  assert.equal(t.el.getAttribute('aria-hidden'), 'true');
  assert.equal(t.el.style.position, 'absolute');
  assert.ok(parseInt(t.el.style.left, 10) <= -1000, 'pushed off the left edge');
  assert.equal(t.el.style.overflow, 'hidden');
  assert.notEqual(t.el.style.display, 'none');
  assert.notEqual(t.el.style.visibility, 'hidden');
  const input = t.input;
  assert.equal(input.tagName, 'INPUT');
  assert.equal(input.getAttribute('type'), 'text');
  assert.equal(input.getAttribute('name'), TRAP_NAME);
  assert.equal(input.getAttribute('tabindex'), '-1');
  assert.equal(input.getAttribute('autocomplete'), 'off');
  assert.doesNotMatch(TRAP_NAME, /mail|name|phone|tel|addr|company|org|web|url|fax|zip|postal|city|user|login|pass/i, 'no word a browser or password manager fills');
  assert.equal(input.getAttribute('data-lpignore'), 'true');
  assert.equal(input.getAttribute('data-1p-ignore'), 'true');
  // The label holds the input (no id to clash), with its words.
  const label = t.el.children[0];
  assert.equal(label.tagName, 'LABEL');
  assert.ok(label.children.includes(input));
  assert.equal(label.textContent, TRAP_LABEL);
  assert.equal(TRAP_LABEL, 'Leave this empty');
  assert.equal(t.el.all().filter((n) => n.tagName === 'INPUT').length, 1);
});

test('the clock: from when the form is shown, restarted for a new step; the decoy keeps its value', () => {
  const doc = fakeDoc();
  const now = clock(1000);
  const form = doc.createElement('form');
  const t = addFormTrap(form, { doc, now });
  assert.equal(form.children.at(-1), t.el, 'the decoy goes in last');
  now.at(3500.4);
  assert.deepEqual(t.fields(), { formTrap: { hp: '', ms: 2500 } });
  t.restart();
  now.at(3600);
  assert.equal(t.fields().formTrap.ms, 100);
  // A bot fills it: that sticks across steps.
  t.input.value = 'http://spam.example';
  t.restart();
  assert.equal(t.fields().formTrap.hp, 'http://spam.example');
  // One decoy per screen: attaching to the next step's form moves it.
  const next = doc.createElement('form');
  now.at(5000);
  t.attach(next);
  assert.equal(form.children.includes(t.el), false);
  assert.equal(next.children.at(-1), t.el);
  now.at(5250);
  assert.equal(t.fields().formTrap.ms, 250, 'attach restarts the clock');
});

test('only the five auth calls carry formTrap, next to humanToken as before', async () => {
  const posts = [];
  const http = { post: async (p, body) => { posts.push({ path: p, body }); return {}; } };
  const api = createApi(http, createSession(memStore(), { deviceName: 'Test browser' }));
  const T = { formTrap: { hp: '', ms: 4200 } };
  const signup = { firstName: 'Ava', lastName: 'Ng', email: 'a@b.co', phone: '+15125550123', password: 'longenough1', role: 'HOMEOWNER' };
  await api.auth.emailSignupSendOtp(signup, 'tok', T);
  await api.auth.phoneSignupSendOtp({ phone: '+15125550123', role: 'HOMEOWNER' }, 'tok', T);
  await api.auth.socialSignupSendOtp('+15125550123', 'tok', T);
  await api.auth.loginSendOtp('+15125550123', 'tok', T);
  await api.auth.loginEmailPassword('a@b.co', 'pw', 'tok', T);
  // Every other auth call, handed the same thing anyway: it never goes.
  await api.auth.checkExists('a@b.co', T);
  await api.auth.emailSignupVerify(signup, '123456', T);
  await api.auth.phoneSignupVerify({ phone: '+15125550123', firstName: 'Ava', lastName: 'Ng', role: 'HOMEOWNER' }, '123456', T);
  await api.auth.loginVerifyDeviceOtp('a@b.co', '123456', T);
  await api.auth.loginVerifyOtp('+15125550123', '123456', T);
  await api.auth.googleSignin('id-token', 'HOMEOWNER', T);
  await api.auth.googleSignupWithPhone('id-token', '+15125550123', '123456', 'HOMEOWNER', T);
  const carrying = posts.filter((x) => 'formTrap' in x.body).map((x) => x.path);
  assert.deepEqual(carrying, ['/auth/email-signup/send-otp', '/auth/phone-signup/send-otp', '/auth/social-signup/send-otp', '/auth/login/send-otp', '/auth/login/email-password']);
  for (const x of posts.slice(0, 5)) {
    assert.deepEqual(x.body.formTrap, { hp: '', ms: 4200 }, x.path);
    assert.equal(x.body.humanToken, 'tok', `${x.path}: the human check's token is untouched`);
  }
  // Without a trap, the bodies are what they were.
  posts.length = 0;
  await api.auth.phoneSignupSendOtp({ phone: '+15125550123', role: 'HOMEOWNER' });
  await api.auth.loginEmailPassword('a@b.co', 'pw');
  assert.deepEqual(posts[0].body, { phone: '+15125550123', role: 'HOMEOWNER' });
  assert.equal('formTrap' in posts[1].body, false);
  assert.equal('humanToken' in posts[1].body, false);
});

test('the decoy is built from elements, and the account screens, /pro and /rentals all use it', () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, 'public', f), 'utf8');
  assert.doesNotMatch(read('nohm/form-traps.js'), /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write/);
  assert.match(read('nohm/account.js'), /const trap = formTrap\(\)/, 'one trap per account screen');
  assert.match(read('pro/pro.js'), /\.\.\.trap\.fields\(\)/);
  assert.match(read('rentals/ui/listing-view.js'), /contactBody\(values, human\.token\(\), trap\.fields\(\)\)/);
});
