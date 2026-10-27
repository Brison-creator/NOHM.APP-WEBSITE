// node --test tools/join
// nohm.app/pro (the supply-house flyer): the short form's rules, and what
// it hands /join so the full sign-up starts filled in.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { interestProblems, interestBody, interestError, sourceFrom, tradeSlugFrom, tradeFor, tradeCrowd, tradePhoto, tradeHero } from '../../public/pro/lib/form.js';
import { cleanPrefill, savePrefill, readPrefill, clearPrefill } from '../../public/nohm/pro-prefill.js';
import { profileFormFrom } from '../../public/join/lib/pro-flow.js';

const FORM = { firstName: ' Dale ', lastName: 'Smith', phone: '(501) 555-0142', email: '', tradeId: 't-plumb', zip: '72015', businessName: '' };

test('name, mobile, trade and ZIP are the must-haves; email and business help', () => {
  assert.deepEqual(interestProblems(FORM), {});
  const p = interestProblems({});
  assert.deepEqual(Object.keys(p).sort(), ['firstName', 'lastName', 'phone', 'tradeId', 'zip']);
  assert.equal(interestProblems({ ...FORM, email: 'nope' }).email, 'A real email address, or leave it empty');
  assert.equal(interestProblems({ ...FORM, zip: '7201' }).zip, 'Your 5-digit ZIP');
  assert.equal(interestProblems({ ...FORM, businessName: 'x'.repeat(41) }).businessName, 'Up to 40 characters', '/join’s profile takes 40');
});

test('the body is the server’s DTO: E.164 phone, trimmed, empty extras left out', () => {
  assert.deepEqual(interestBody(FORM, 'flyer'), { firstName: 'Dale', lastName: 'Smith', phone: '+15015550142', tradeId: 't-plumb', zip: '72015', source: 'flyer' });
  const full = interestBody({ ...FORM, email: ' dale@abcair.com ', businessName: ' ABC  Air ' }, 'flyer');
  assert.equal(full.email, 'dale@abcair.com');
  assert.equal(full.businessName, 'ABC Air');
});

test('where they came from: ?from=flyer, or the page itself', () => {
  assert.equal(sourceFrom('?from=flyer'), 'flyer');
  assert.equal(sourceFrom('?from=sign'), 'sign');
  assert.equal(sourceFrom(''), 'pro-page');
  assert.equal(sourceFrom('?from=<script>'), 'pro-page');
  assert.equal(sourceFrom(`?from=${'a'.repeat(31)}`), 'pro-page');
});

test('a trade’s own link names the trade and picks it in the form', () => {
  assert.equal(tradeSlugFrom('?trade=handyman&from=mysaline'), 'handyman');
  assert.equal(tradeSlugFrom('?trade=house-cleaning'), 'house-cleaning');
  assert.equal(tradeSlugFrom(''), '');
  assert.equal(tradeSlugFrom('?trade=<script>'), '');
  assert.equal(tradeSlugFrom('?trade=HANDYMAN'), '', 'slugs are lowercase');
  const trades = [{ id: 't-h', name: 'HANDYMAN' }, { id: 't-c', name: 'HOUSE_CLEANING' }];
  assert.equal(tradeFor('handyman', trades).id, 't-h');
  assert.equal(tradeFor('house-cleaning', trades).id, 't-c');
  assert.equal(tradeFor('roofing', trades), undefined);
  assert.equal(tradeFor('', trades), undefined);
  assert.equal(tradeCrowd('handyman'), 'Handymen');
  assert.equal(tradeCrowd('house-cleaning'), 'House cleaners');
  assert.equal(tradeCrowd('nope'), '');
  assert.equal(tradeCrowd('constructor'), '', 'only the page’s own trades');
});

test('a trade’s link shows that trade’s photo, when there is one', () => {
  assert.equal(tradePhoto('handyman'), '/img/services/handyman.jpg');
  assert.equal(tradePhoto('house-cleaning'), '/img/services/house-cleaning.jpg');
  assert.equal(tradePhoto('roofing'), '', 'no photo yet: the page keeps its own');
  assert.equal(tradePhoto(''), '');
  for (const slug of ['appliance', 'electrical', 'flooring', 'garage-door', 'gutters', 'handyman', 'house-cleaning', 'hvac', 'landscaping', 'locksmith', 'painting', 'pest-control', 'plumbing', 'pressure-washing', 'tree-service']) {
    assert.ok(existsSync(new URL(`../../public${tradePhoto(slug)}`, import.meta.url)), `${slug}'s photo is on the site`);
  }
});

test('the handyman has a hero of his own, on /pro/handyman/ and his link', () => {
  assert.equal(tradeHero('handyman'), '/img/pro-handyman-hero');
  assert.equal(tradeHero('roofing'), '');
  assert.equal(tradeHero('constructor'), '');
  for (const f of ['-960.webp', '-1600.webp', '-1600.jpg']) {
    assert.ok(existsSync(new URL(`../../public${tradeHero('handyman')}${f}`, import.meta.url)), `handyman hero${f}`);
  }
  const page = readFileSync(new URL('../../public/pro/handyman/index.html', import.meta.url), 'utf8');
  assert.match(page, /<body data-trade="handyman">/, 'the page picks Handyman in the form');
  assert.match(page, /\/img\/pro-handyman-hero-1600\.jpg/);
  assert.match(page, /og:image" content="https:\/\/nohm\.app\/img\/og-pro-handyman\.jpg"/);
  // His video card: plays once (no loop, no autoplay attribute: promo.js starts it), silent.
  assert.match(page, /<dialog class="promo" id="promo"/);
  assert.match(page, /<video muted playsinline preload="auto" poster="\/video\/handyman-thunder-poster\.jpg">/);
  assert.match(page, /<script src="\/pro\/promo\.js" defer><\/script>/);
  for (const f of ['handyman-thunder-720.mp4', 'handyman-thunder-720.webm', 'handyman-thunder-poster.jpg']) {
    assert.ok(existsSync(new URL(`../../public/video/${f}`, import.meta.url)), f);
  }
});

test('a refusal is said plainly, with the number to call', () => {
  assert.match(interestError({ status: 429 }), /Too many tries.*501-618-0026/);
  assert.equal(interestError({ status: 400, message: 'Choose your trade.' }), 'Choose your trade.');
  assert.match(interestError(null), /501-618-0026/);
});

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('the prefill: only known fields, trimmed and capped, gone on clear', () => {
  const s = memoryStorage();
  savePrefill(s, { ...FORM, password: 'x', businessName: 'B'.repeat(60) });
  const got = readPrefill(s);
  assert.deepEqual(Object.keys(got).sort(), ['businessName', 'firstName', 'lastName', 'phone', 'tradeId', 'zip']);
  assert.equal(got.firstName, 'Dale');
  assert.equal(got.businessName.length, 40);
  clearPrefill(s);
  assert.equal(readPrefill(s), null);
  assert.equal(cleanPrefill({ zip: 'abcde', tradeId: 'a b' }), null, 'a bad ZIP or trade id is dropped');
  assert.equal(cleanPrefill('nope'), null);
});

test('the prefill never breaks a page: blocked or broken storage reads as nothing', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
  savePrefill(blocked, FORM);
  assert.equal(readPrefill(blocked), null);
  clearPrefill(blocked);
  const broken = memoryStorage();
  broken.setItem('nohm.proPrefill', '{not json');
  assert.equal(readPrefill(broken), null);
});

test('the profile starts with what they typed on /pro, but the server’s answers win', () => {
  const pre = { businessName: 'ABC Air', zip: '72015', tradeId: 't-hvac' };
  const empty = profileFormFrom({ profile: { businessName: 'Not Provided' }, trades: [] }, { firstName: 'Dale', lastName: 'Smith' }, pre);
  assert.equal(empty.businessName, 'ABC Air');
  assert.equal(empty.baseZip, '72015');
  assert.equal(empty.primaryTradeId, 't-hvac');
  const saved = profileFormFrom({ profile: { businessName: 'Smith Heating', baseZip: '72011' }, trades: [{ id: 't-plumb' }] }, null, pre);
  assert.equal(saved.businessName, 'Smith Heating');
  assert.equal(saved.baseZip, '72011');
  assert.equal(saved.primaryTradeId, 't-plumb');
  assert.equal(profileFormFrom(null, null).businessName, '', 'no prefill, as before');
});
