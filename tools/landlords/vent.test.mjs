// "Vent to us" (owner, 2026-10-29: "just a text box no email collection 1
// box submit that's it"): the rules (public/nohm/vent.js), the form
// (public/nohm/vent-form.js) and the two pages that carry it.
//   Run: node --test tools/landlords/*.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ventProblem, ventBody, ventError, VENT_MAX, VENT_TOO_SHORT, VENT_TOO_LONG, VENT_BUSY, VENT_THANKS,
} from '../../public/nohm/vent.js';

const read = (p) => readFile(new URL(`../../public/${p}`, import.meta.url), 'utf8');
const trap = { formTrap: { hp: '', ms: 5400 } };

test('the words: 3 to 4,000 characters once trimmed, in the server’s own words', () => {
  assert.equal(ventProblem(''), VENT_TOO_SHORT);
  assert.equal(ventProblem('  hi  '), VENT_TOO_SHORT);
  assert.equal(ventProblem(null), VENT_TOO_SHORT);
  assert.equal(ventProblem('Late rent'), '');
  assert.equal(ventProblem('x'.repeat(VENT_MAX)), '');
  assert.equal(ventProblem('x'.repeat(VENT_MAX + 1)), VENT_TOO_LONG);
  assert.equal(VENT_TOO_SHORT, 'Tell us a little more.');
});

test('the body is the words, the page and the traps, and nothing else', () => {
  assert.deepEqual(ventBody('  Tenants never answer.  ', 'go/landlords', trap), {
    text: 'Tenants never answer.', page: 'go/landlords', formTrap: { hp: '', ms: 5400 },
  });
  // A page the server would refuse is left out rather than sent.
  assert.deepEqual(Object.keys(ventBody('Late rent', 'Go Landlords!', trap)), ['text', 'formTrap']);
  assert.deepEqual(Object.keys(ventBody('Late rent', 'x'.repeat(121), trap)), ['text', 'formTrap']);
  // No traps: no formTrap key (never a malformed one).
  assert.deepEqual(ventBody('Late rent', 'for/landlords', {}), { text: 'Late rent', page: 'for/landlords' });
  // Extra things a caller might pass never ride along.
  const body = ventBody('Late rent', 'go/landlords', { formTrap: { hp: 'x', ms: 10 }, email: 'a@b.co', name: 'A' });
  assert.deepEqual(Object.keys(body).sort(), ['formTrap', 'page', 'text']);
});

test('what the server says no with: its first message on a 400, the limit on a 429', () => {
  assert.equal(ventError({ status: 400, body: { message: ['Tell us a little more.'] } }), 'Tell us a little more.');
  assert.equal(ventError({ status: 400, body: { message: 'Keep it under 4,000 characters.' } }), 'Keep it under 4,000 characters.');
  assert.equal(ventError({ status: 400, body: null }), VENT_TOO_SHORT);
  assert.equal(ventError({ status: 429 }), VENT_BUSY);
  assert.equal(VENT_BUSY, 'That’s a lot at once. Try again in a little while.');
  assert.match(ventError({ status: 0, message: 'Can’t reach NOHM right now. Check your connection and try again.' }), /Can’t reach NOHM/);
  assert.match(ventError({ status: 500 }), /didn’t go through/);
  assert.equal(VENT_THANKS, 'Thank you. The founder reads every one.');
});

test('the form: one box and Submit, signed out, elements only', async () => {
  // The code without its comments (which say what it never does).
  const js = (await read('nohm/vent-form.js')).replace(/^\s*\/\/.*$/gm, '');
  assert.match(js, /http\.post\('\/feedback\/vent', ventBody\(box\.value, page, trap\.fields\(\)\), \{ auth: false \}\)/);
  assert.match(js, /h\('textarea\.vent-text'/);
  assert.match(js, /h\('button\.btn', \{ type: 'submit' \}, 'Submit'\)/);
  assert.match(js, /btn\.disabled = true;/, 'the button is off while sending');
  assert.match(js, /addFormTrap\(form\)/);
  // No email, name or phone box, no Turnstile, no HTML strings.
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.doesNotMatch(js, /type: '(email|tel)'|humanCheck|turnstile|createSession|localStorage/i);
  assert.equal((js.match(/h\('textarea/g) || []).length, 1);
  assert.equal((js.match(/h\('input/g) || []).length, 0);
});

test('the ad page and the role page carry the box, with nothing that asks who you are', async () => {
  for (const [f, page] of [['go/landlords/index.html', 'go/landlords'], ['for/landlords/index.html', 'for/landlords']]) {
    const html = await read(f);
    const at = html.indexOf('<h2>Vent to us.</h2>');
    assert.ok(at > 0, f);
    const sec = html.slice(html.lastIndexOf('<section', at), html.indexOf('</section>', at));
    assert.match(sec, /What frustrates you about being a landlord\? Tell the founder\. We&rsquo;ll help you solve it\./, f);
    assert.match(sec, new RegExp(`data-vent="${page}"`), f);
    assert.match(sec, /Anonymous\. We keep only what you write\./, f);
    assert.doesNotMatch(sec, /<input|<form|type="email"|cf-turnstile/, f);
    // Near the bottom: just before the last ask.
    assert.ok(html.indexOf('<section class="final"', at) > at, f);
    assert.match(html, /<script src="\/book\/config\.js"><\/script>/, f);
    assert.match(html, /<script type="module" src="\/nohm\/vent-form\.js"><\/script>/, f);
  }
  // The ad page counts that the box was seen, and nothing it holds.
  const ad = await read('go/landlords/index.html');
  assert.match(ad, /<section class="sec wrap" id="vent" data-seen="vent">/);
  const track = await read('go/landlords/track.js');
  assert.doesNotMatch(track, /textarea|data-vent|vent-text|\.value\b/);
});

test('the privacy policy says what the box keeps', async () => {
  const privacy = await read('privacy/index.html');
  assert.match(privacy, /The &ldquo;Vent to us&rdquo; box for landlords on nohm\.app keeps only the words you type and the page you sent them from, with no name, email or address\./);
});
