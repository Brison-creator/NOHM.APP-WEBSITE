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
// payment fee and by the application; the landlord pays only for work they book.
const OLD_PLAN = /Financial Management|19\.99|per rental, per month|\/rental\/mo|card on file|Pay only when you collect rent|Free until you collect rent|data-rental="(plan|autopilot|incomeCheck)"|RENTAL_(FINANCIAL|AUTOPILOT)_PER_RENTAL_MONTHLY|RENTAL_PLANS_BASE_MONTHLY/;

test('public rental pricing: free for landlords, the tenant’s bank fee and the application', () => {
  assert.match(pricing, /free:\s*0/);
  assert.doesNotMatch(pricing, /\bplan:|autopilot:|incomeCheck:|membership|manager:/);
  assert.match(pricing, /walkthrough:\s*79/);
  assert.match(pricing, /application:\s*50/);
  // One background check: the old tiers are gone everywhere.
  assert.doesNotMatch(pricing, /applicationIncome|applicationPremium/);
  // Bank rent: a flat fee per payment (ACH_RENT_FEE), paid by the tenant.
  assert.match(pricing, /achFee:\s*7/);
  assert.doesNotMatch(pricing, /achRatePercent|achCap/);
});

test('every landlord page says free and how, with no old plan price', () => {
  for (const [name, page] of [['/landlords', landlords], ['/go/landlords', ad], ['/for/landlords', role]]) {
    assert.doesNotMatch(page, OLD_PLAN, name);
    assert.match(page, /Free for landlords\.<br \/>Here&rsquo;s how\./, name);
    assert.match(page, /No spam\. No ads\. Nothing\./, name);
    // The two ways NOHM is paid, said plainly.
    assert.match(page, /Your tenant pays/, name);
    assert.match(page, /About \$5 of it is the bank processor&rsquo;s cost\. NOHM keeps about \$2\./, name);
    assert.match(page, /Applicants pay/, name);
    assert.match(page, /NOHM makes money on the application\./, name);
    // Work the landlord books is still theirs to pay, priced first.
    assert.match(page, /If you book a pro for a repair or a NOHM walkthrough, you pay for that work, and you see the price before you book[.:]/, name);
    // Only what's true: no data promise the owner didn't make.
    assert.doesNotMatch(page, /never sell|don&rsquo;t sell|do not sell/i, name);
  }
});

test('the landlord topic pages (tools/seo/build.mjs) carry no old plan price', async () => {
  for (const slug of ['rent-collection', 'tenant-screening', 'lease-signing', 'rental-listings', 'maintenance', 'accounting', 'autopilot']) {
    const page = await read(`landlords/${slug}/index.html`);
    assert.doesNotMatch(page, OLD_PLAN, slug);
    assert.match(page, /Free for landlords\. No spam\. No ads\. Nothing\./, slug);
  }
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
  assert.match(landlords, /The <span data-rental="achFee">\$7<\/span> bank payment fee is your tenant&rsquo;s, not yours\./);
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
  assert.match(renters, /<span data-rental="achFee">\$7<\/span> bank payment fee/);
  assert.doesNotMatch(renters, /Instant Income|applicationIncome|applicationPremium/);
  assert.doesNotMatch(renters, /wholesale cost|platform margin/i);
});
