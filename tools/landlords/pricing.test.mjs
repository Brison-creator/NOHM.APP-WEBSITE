import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (p) => readFile(new URL(`../../public/${p}`, import.meta.url), 'utf8');
const pricing = await read('pricing.js');
const landlords = await read('landlords/index.html');
const renters = await read('renters/index.html');
const ad = await read('go/landlords/index.html');
const role = await read('for/landlords/index.html');

// Free for landlords (owner, 2026-10-29: "It's absolutely free to the
// landlord. No spam no ads nothing."). NOHM is paid by the tenant's bank
// payment fee (which a landlord may cover) and by the application; the
// landlord pays only for work they book. Adding a rental still asks for a
// card on file (the owner's rule against fake accounts), so no page says "no card".
const OLD_PLAN = /Financial Management|per rental, per month|\/rental\/mo|no card|Pay only when you collect rent|Free until you collect rent|data-rental="(plan|incomeCheck)"|RENTAL_FINANCIAL_PER_RENTAL_MONTHLY|RENTAL_PLANS_BASE_MONTHLY/i;
const CARD_LINE = /We ask for a card on file to keep fake accounts out\. It&rsquo;s only charged for work you book\./;

test('public rental pricing: free for landlords, the tenant’s bank fee and the application', () => {
  assert.match(pricing, /free:\s*0/);
  assert.doesNotMatch(pricing, /\bplan:|incomeCheck:|membership|manager:/);
  // Autopilot: optional, per rental per month, for everyone (owner, 2026-10-29).
  assert.match(pricing, /autopilot:\s*19\.99/);
  assert.match(pricing, /walkthrough:\s*79/);
  assert.match(pricing, /application:\s*50/);
  // One background check: the old tiers are gone everywhere.
  assert.doesNotMatch(pricing, /applicationIncome|applicationPremium/);
  // Bank rent: a flat fee per payment (ACH_RENT_FEE), paid by the tenant.
  assert.match(pricing, /achFee:\s*7/);
  assert.doesNotMatch(pricing, /achRatePercent|achCap/);
});

// Free goes to the first 10,000 landlords, NOHM Founding Partners (owner,
// 2026-10-29), numbered by the server. There are almost no landlords yet,
// so no page ever shows a count or the spots left.
const FOUNDERS = /For the first 10,000 landlords: NOHM Founding Partners\. Your rentals are free for good/;
const COUNT = /spots? (left|remaining)|\d[\d,]* (left|remaining)|of 10,000 (taken|claimed|left)|data-(founding|partners?)-(count|left)|foundingPartnerCount|\/rentals\/plans/i;

test('every landlord page says free and how, with no old plan price', () => {
  for (const [name, page] of [['/landlords', landlords], ['/go/landlords', ad], ['/for/landlords', role]]) {
    assert.doesNotMatch(page, OLD_PLAN, name);
    assert.match(page, /Free for Founding Partners\.<br \/>Here&rsquo;s how\./, name);
    assert.match(page, FOUNDERS, name);
    assert.match(page, /you get a direct line to the founder with suggestions\./, name);
    assert.doesNotMatch(page, COUNT, name);
    assert.doesNotMatch(page, /Free for landlords\./, name);
    assert.match(page, /No spam\. No ads\. Nothing\./, name);
    // The two ways NOHM is paid, said plainly; the landlord may cover the bank fee.
    assert.match(page, /Your tenant pays/, name);
    assert.match(page, /when they pay rent by bank \(or you can cover it for them\)/i, name);
    assert.match(page, /About \$5 of it is the bank processor&rsquo;s cost\. NOHM keeps about \$2\./, name);
    assert.doesNotMatch(page, /you pay neither|not yours/, name);
    assert.match(page, /Applicants pay/, name);
    assert.match(page, /NOHM makes money on the application\./, name);
    // Work the landlord books is still theirs to pay, priced first.
    assert.match(page, /If you book a pro for a repair or a NOHM walkthrough, you pay for that work, and you see the price before you book[.:]/, name);
    assert.match(page, CARD_LINE, name);
    // Only what's true: no data promise the owner didn't make.
    assert.doesNotMatch(page, /never sell|don&rsquo;t sell|do not sell/i, name);
  }
});

test('the landlord topic pages (tools/seo/build.mjs) carry no old plan price', async () => {
  for (const slug of ['rent-collection', 'tenant-screening', 'lease-signing', 'rental-listings', 'maintenance', 'accounting', 'autopilot']) {
    const page = await read(`landlords/${slug}/index.html`);
    assert.doesNotMatch(page, OLD_PLAN, slug);
    assert.doesNotMatch(page, COUNT, slug);
    assert.match(page, /Free for the first 10,000 landlords\. No spam\. No ads\. Nothing\./, slug);
  }
  for (const slug of ['rent-collection', 'accounting']) {
    const page = await read(`landlords/${slug}/index.html`);
    assert.match(page, /<h2>Free for Founding Partners\.<\/h2>/, slug);
    assert.match(page, FOUNDERS, slug);
  }
});

test('the ad page: Founding Partners in the hero and the questions, Autopilot free for them', () => {
  assert.match(ad, /<p class="free">Free for the first 10,000 landlords: NOHM Founding Partners\. <a href="#free">Here&rsquo;s how<\/a><\/p>/);
  assert.match(ad, /<details data-q="founding">/);
  assert.match(ad, /One of the first 10,000 landlords to sign up for NOHM\. Your rentals are free for good, and you get a direct line to the founder with suggestions\./);
  assert.match(ad, /<p class="price-line">Optional: <span data-price="RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY">\$19\.99<\/span> a month per rental, and it runs the rental for you\.<\/p>/);
  assert.match(role, /<p class="sub">Free for the first 10,000 landlords: NOHM Founding Partners\.<\/p>/);
});

test('the ad page: free and how right under the hero, counted by track.js', () => {
  const hero = ad.indexOf('data-seen="hero"');
  const free = ad.indexOf('data-seen="free"');
  const versus = ad.indexOf('data-seen="versus"');
  assert.ok(hero < free && free < versus, 'the free part comes right after the hero');
  assert.match(ad, /<a href="#free">Here&rsquo;s how<\/a>/);
  assert.match(ad, /<section class="sec wrap" id="free" data-seen="free">/);
  assert.match(ad, /data-q="money"/);
  assert.doesNotMatch(ad, /data-q="card"|data-seen="price"/);
});

test('landlord page shows customer prices and comparison sources', () => {
  assert.match(landlords, /data-rental="free">\$0/);
  assert.match(landlords, /data-rental="achFee">\$7/);
  assert.match(landlords, /data-rental="application">\$50/);
  assert.match(landlords, /data-rental="walkthrough">\$79/);
  assert.doesNotMatch(landlords, /0\.8%|data-rental="membership"|data-rental="manager"/);
  assert.match(landlords, /Your tenant pays the <span data-rental="achFee">\$7<\/span> bank payment fee, or you can cover it for them\./);
  assert.match(landlords, /Landlord cost comparison/);
  for (const name of ['RentRedi', 'TurboTenant', 'Zillow Rental Manager']) {
    assert.match(landlords, new RegExp(name));
  }
  assert.match(landlords, /rentredi\.com\/pricing/);
  assert.match(landlords, /turbotenant\.com\/pricing/);
  assert.match(landlords, /zillow\.com\/rental-manager/);
  assert.doesNotMatch(landlords, /wholesale cost|platform margin/i);
  // The problem the Income Check answers, and the order it runs in.
  assert.match(landlords, /W-2s and bank statements can be faked/);
  assert.match(landlords, /NOHM Income Check · Free/);
  assert.match(landlords, /Approve\.<\/b> They pay the deposit/);
  assert.doesNotMatch(landlords, /Instant Income|applicationIncome|applicationPremium/);
});

test('renter page shows the one background check, a free Income Check and the bank fee, without internal economics', () => {
  assert.match(renters, /the background check is <span data-rental="application">/);
  assert.match(renters, /NOHM Income Check costs you nothing\./);
  assert.doesNotMatch(renters, /your landlord pays for it/);
  assert.match(renters, /<span data-rental="achFee">\$7<\/span> bank payment fee, shown before you pay; your landlord may cover it\./);
  assert.match(renters, /Applying is free unless your landlord asks for a background check\./);
  assert.doesNotMatch(renters, /Instant Income|applicationIncome|applicationPremium/);
  assert.doesNotMatch(renters, /wholesale cost|platform margin/i);
});

test('renter pages: a free app, with the bank fee and the background check said where they apply', async () => {
  for (const f of ['renters/index.html', 'for/renters/index.html', 'invite/renter/index.html']) {
    const page = await read(f);
    // The app costs nothing; paying rent by bank and a background check have fees.
    assert.doesNotMatch(page, /Free for renters|NOHM costs renters nothing|Applying is free\.|Always\.</, f);
  }
  const role = await read('for/renters/index.html');
  assert.match(role, /Applying is free unless your landlord asks for a background check/);
  assert.match(role, /<span data-price="ACH_RENT_FEE">\$7<\/span> bank payment fee, shown before you pay; your landlord may cover it\./);
});

// NOHM Autopilot is not free: $19.99 a month per rental for everyone,
// Founding Partners included (owner, 2026-10-29: "Wait Nohm autopilot cost
// still ok"), shown beside what a property manager takes (about 10%).
const AUTOPILOT_FREE = /Autopilot too|and (NOHM )?Autopilot\.|the books and (NOHM )?Autopilot|Autopilot[^<.]{0,40}\b(free|included)\b|free for Founding Partners: turn it on|Optional, and free for Founding Partners\. Turn it on/i;
const PM = (price, share) => new RegExp(`A property manager takes about 10% of the rent: \\$150 a month on a \\$1,500 home\\. Autopilot is ${price}, about ${share}\\.`);

test('Autopilot is priced, never free, with the property manager line beside it', async () => {
  const autopilotTopic = await read('landlords/autopilot/index.html');
  for (const [name, page] of [['/landlords', landlords], ['/go/landlords', ad], ['/for/landlords', role], ['/landlords/autopilot', autopilotTopic]]) {
    assert.doesNotMatch(page, AUTOPILOT_FREE, name);
    assert.doesNotMatch(page, /15%/, name);
  }
  // The live pages take the price and its share from the server's key...
  const live = PM('<span data-price="RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY">\\$19\\.99<\\/span>', '<span data-price-share="RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY" data-share-of="150000">1\\.3%<\\/span>');
  assert.match(ad, live);
  assert.match(role, live);
  // ...the others from /pricing.js.
  const local = PM('<span data-rental="autopilot">\\$19\\.99<\\/span>', '<span data-rental-share="autopilot" data-share-of="1500">1\\.3%<\\/span>');
  assert.match(landlords, local);
  assert.match(autopilotTopic, local);
  assert.match(landlords, /<h3>NOHM Autopilot<\/h3>\s*<div class="price"><b data-rental="autopilot">\$19\.99<\/b><\/div>/);
  // The $0 card keeps the rest and says Autopilot is optional at its price.
  for (const page of [ad, role]) {
    assert.match(page, /late fees and reports\. No plan, no monthly fee\. NOHM Autopilot is optional: <span data-price="RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY">\$19\.99<\/span> a month per rental, and it runs the rental for you\./);
  }
  assert.match(landlords, /late fees and reports\. No plan, no monthly fee\. NOHM Autopilot is optional, priced below\./);
});

test('the typed fallbacks match /pricing.js: $19.99 and its share of $1,500', () => {
  const autopilot = Number(pricing.match(/autopilot:\s*([\d.]+)/)[1]);
  const share = `${Math.round((autopilot / 1500) * 1000) / 10}%`;
  assert.equal(share, '1.3%');
  for (const page of [landlords, ad, role]) {
    for (const m of page.matchAll(/data-(?:rental|price)="(?:autopilot|RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY)">([^<]+)</g)) assert.equal(m[1], `$${autopilot}`);
    for (const m of page.matchAll(/data-(?:rental|price)-share="[^"]+" data-share-of="\d+">([^<]+)</g)) assert.equal(m[1], share);
  }
});
