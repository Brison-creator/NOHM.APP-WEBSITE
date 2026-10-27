// node --test tools/ads
// The landlord ad page's email form (nohm.app/go/landlords): its rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leadProblems, leadSource, leadBody, leadError } from '../../public/go/landlords/lead.js';

test('a name and a real email are the must-haves', () => {
  assert.deepEqual(leadProblems({ name: 'Pat', email: 'pat@example.com' }), {});
  assert.deepEqual(Object.keys(leadProblems({})).sort(), ['email', 'name']);
  assert.equal(leadProblems({ name: 'Pat', email: 'pat@' }).email, 'A real email address');
  assert.equal(leadProblems({ name: '  ', email: 'pat@example.com' }).name, 'Your name');
});

test('where they came from: the Facebook ad, Instagram, or the page', () => {
  assert.equal(leadSource('?fbclid=IwZ123'), 'fb-landlords');
  assert.equal(leadSource('?utm_source=facebook&utm_campaign=landlords'), 'fb-landlords');
  assert.equal(leadSource('?utm_source=instagram'), 'ig-landlords');
  assert.equal(leadSource(''), 'lp-landlords');
  for (const s of ['fb-landlords', 'ig-landlords', 'lp-landlords']) assert.match(s, /^[a-z0-9-]{1,30}$/, 'the server takes it');
});

test('the body is the server’s DTO: trimmed, email lowercased', () => {
  assert.deepEqual(leadBody({ name: ' Pat   Landlord ', email: ' Pat@Example.com ' }, 'fb-landlords'), { name: 'Pat Landlord', email: 'pat@example.com', source: 'fb-landlords' });
});

test('a refusal is said plainly, with the number to call', () => {
  assert.match(leadError({ status: 429 }), /Too many tries.*888-230-NOHM/);
  assert.equal(leadError({ status: 400, message: 'Enter your name.' }), 'Enter your name.');
  assert.match(leadError(null), /888-230-NOHM/);
});

test('the page has the form, its script and its settings', () => {
  const page = readFileSync(new URL('../../public/go/landlords/index.html', import.meta.url), 'utf8');
  assert.match(page, /<section class="sec wrap lead" id="email">/);
  assert.match(page, /<div class="b-main" id="lead-form">/);
  assert.match(page, /<script src="\/book\/config\.js"><\/script>/);
  assert.match(page, /<script type="module" src="\/go\/landlords\/email\.js"><\/script>/);
});
