import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pricing = await readFile(new URL('../../public/pricing.js', import.meta.url), 'utf8');
const landlords = await readFile(new URL('../../public/landlords/index.html', import.meta.url), 'utf8');
const renters = await readFile(new URL('../../public/renters/index.html', import.meta.url), 'utf8');

test('public rental pricing matches the landlord product', () => {
  // Per-rental plans, no account fee (owner, 2026-10-20).
  assert.match(pricing, /free:\s*0/);
  assert.match(pricing, /plan:\s*7/);
  assert.match(pricing, /autopilot:\s*19\.99/);
  assert.doesNotMatch(pricing, /membership|manager:/);
  assert.match(pricing, /walkthrough:\s*79/);
  assert.match(pricing, /application:\s*50/);
  assert.match(pricing, /incomeCheck:\s*20/);
  // One background check: the old tiers are gone everywhere.
  assert.doesNotMatch(pricing, /applicationIncome|applicationPremium/);
  // Bank rent: a flat fee per payment (ACH_RENT_FEE).
  assert.match(pricing, /achFee:\s*7/);
  assert.doesNotMatch(pricing, /achRatePercent|achCap/);
});

test('landlord page shows customer prices, ACH choice and comparison sources', () => {
  assert.match(landlords, /data-rental="free">\$0/);
  assert.match(landlords, /data-rental="plan">\$7/);
  assert.match(landlords, /data-rental="autopilot">\$19\.99/);
  assert.doesNotMatch(landlords, /0\.8%|data-rental="membership"|data-rental="manager"/);
  assert.match(landlords, /tenant pays it on top or you absorb it/);
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
  assert.match(landlords, /data-rental="incomeCheck"/);
  assert.match(landlords, /Approve\.<\/b> They pay the deposit/);
  assert.doesNotMatch(landlords, /Instant Income|applicationIncome|applicationPremium/);
});

test('renter page shows the one background check and a free Income Check, without internal economics', () => {
  assert.match(renters, /the background check is <span data-rental="application">/);
  assert.match(renters, /NOHM Income Check costs you nothing/);
  assert.doesNotMatch(renters, /Instant Income|applicationIncome|applicationPremium/);
  assert.doesNotMatch(renters, /wholesale cost|platform margin/i);
});
