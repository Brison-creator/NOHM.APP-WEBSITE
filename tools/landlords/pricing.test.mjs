import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pricing = await readFile(new URL('../../public/pricing.js', import.meta.url), 'utf8');
const landlords = await readFile(new URL('../../public/landlords/index.html', import.meta.url), 'utf8');
const renters = await readFile(new URL('../../public/renters/index.html', import.meta.url), 'utf8');

test('public rental pricing matches the landlord product', () => {
  assert.match(pricing, /membership:\s*9/);
  assert.match(pricing, /plan:\s*7/);
  assert.match(pricing, /manager:\s*29/);
  assert.match(pricing, /walkthrough:\s*79/);
  assert.match(pricing, /application:\s*40/);
  assert.match(pricing, /applicationIncome:\s*50/);
  assert.match(pricing, /applicationPremium:\s*65/);
  assert.match(pricing, /achRatePercent:\s*0\.8/);
  assert.match(pricing, /achCap:\s*7/);
});

test('landlord page shows customer prices, ACH choice and comparison sources', () => {
  assert.match(landlords, /\$9[\s\S]*\$7/);
  assert.match(landlords, /0\.8%, capped at \$7/);
  assert.match(landlords, /tenant pays that fee on top or you absorb it/);
  assert.match(landlords, /Landlord cost comparison/);
  for (const name of ['RentRedi', 'TurboTenant', 'Zillow Rental Manager']) {
    assert.match(landlords, new RegExp(name));
  }
  assert.match(landlords, /rentredi\.com\/pricing/);
  assert.match(landlords, /turbotenant\.com\/pricing/);
  assert.match(landlords, /zillow\.com\/rental-manager/);
  assert.doesNotMatch(landlords, /wholesale cost|platform margin/i);
});

test('renter page shows the three applicant-facing tiers without internal economics', () => {
  assert.match(renters, /Standard screening is/);
  assert.match(renters, /Instant Income/);
  assert.match(renters, /Premium source-verified employment/);
  assert.doesNotMatch(renters, /wholesale cost|platform margin/i);
});
