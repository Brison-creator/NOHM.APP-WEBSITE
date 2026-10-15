import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const pricing = await readFile(new URL('../../public/pricing.js', import.meta.url), 'utf8');
const landlords = await readFile(new URL('../../public/landlords/index.html', import.meta.url), 'utf8');
const renters = await readFile(new URL('../../public/renters/index.html', import.meta.url), 'utf8');

/**
 * pricing.js run against a fake page holding one element with [attrs]:
 * the prices it holds, and the text it wrote into that element.
 */
function runPricing(attrs = {}) {
  const probe = { textContent: '', getAttribute: (k) => attrs[k] };
  const document = { querySelectorAll: (sel) => (sel.slice(1, -1) in attrs ? [probe] : []) };
  const ctx = { document };
  vm.runInNewContext(pricing + '\nthis.P = NOHM_PRICING;', ctx);
  return { P: ctx.P, text: probe.textContent };
}
const rendered = (attrs) => runPricing(attrs).text;

test('rental plans: Free, Financial Management and NOHM Autopilot at the server prices', () => {
  const r = runPricing().P.rentals;
  assert.equal(r.planBase, 9);
  assert.equal(r.financialPerRental, 7);
  assert.equal(r.autopilotPerRental, 19.99);
  assert.equal(r.walkthrough, 79);
  assert.equal(r.achFlat, 7);
  assert.equal(r.achReturn, 4);
  assert.equal(r.incomeCheck, 20);
  assert.equal(r.screeningStandard, 55);
  assert.equal(r.screeningReady, 75);
  // NOHM Ready is sold as an add-on to Standard: always the difference.
  assert.equal(r.readyAddOn, r.screeningReady - r.screeningStandard);
  assert.equal(r.readyAddOn, 20);
  // The old plan, application fee and ACH percentage are gone.
  for (const old of ['membership', 'plan', 'manager', 'application', 'achRatePercent', 'achCap']) {
    assert.ok(!(old in r), `rentals.${old} is stale`);
  }
});

test('pricing.js writes prices with cents only when there are some, and works out sums', () => {
  assert.equal(rendered({ 'data-rental': 'autopilotPerRental' }), '$19.99');
  assert.equal(rendered({ 'data-rental': 'financialPerRental' }), '$7');
  assert.equal(rendered({ 'data-rental': 'readyAddOn' }), '$20');
  // The owner's example: 2 Autopilot + 1 Financial Management.
  assert.equal(rendered({ 'data-rental-sum': 'planBase autopilotPerRental*2 financialPerRental' }), '$55.98');
});

test('landlord page: the three plans, the account fee, the card on file and the fees', () => {
  for (const name of ['Free', 'Financial Management', 'NOHM Autopilot']) {
    assert.match(landlords, new RegExp(`<h3>${name}</h3>`));
  }
  assert.match(landlords, /data-rental="financialPerRental">\$7</);
  assert.match(landlords, /data-rental="autopilotPerRental">\$19\.99</);
  assert.match(landlords, /data-rental="planBase">\$9</);
  assert.match(landlords, /data-rental-sum="planBase autopilotPerRental\*2 financialPerRental">\$55\.98</);
  assert.match(landlords, /Adding a rental never starts one/);
  assert.match(landlords, /No rental on a paid plan, no account fee/);
  assert.match(landlords, /safe from fraud and lets you request service/);
  assert.match(landlords, /data-rental="achFlat">\$7</);
  assert.match(landlords, /your tenant pays it on top or you pay it from your payout/);
  assert.match(landlords, /data-rental="achReturn">\$4</);
  assert.match(landlords, /NOHM takes no percentage of rent/);
  assert.match(landlords, /data-rental="walkthrough">\$79</);
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
});

test('renter page: free applications, Standard Screening and NOHM Ready as +$20', () => {
  assert.match(renters, /Apply free\./);
  assert.match(renters, /data-rental="screeningStandard">\$55</);
  assert.match(renters, /\+<span data-rental="readyAddOn">\$20<\/span>/);
  assert.match(renters, /data-rental="screeningReady">\$75</);
  assert.match(renters, /doesn&rsquo;t guarantee approval/);
  assert.match(renters, /30 days to finish Certn&rsquo;s short identity form/);
  assert.match(renters, /Massachusetts and Vermont screening isn&rsquo;t sold/);
  assert.match(renters, /NOHM Income Check costs you nothing/);
  assert.doesNotMatch(renters, /wholesale cost|platform margin/i);
});

test('no stale rental claims on either page', () => {
  for (const [name, page] of [['landlords', landlords], ['renters', renters]]) {
    assert.doesNotMatch(page, /NOHM Manager/, `${name}: NOHM Manager is NOHM Autopilot`);
    assert.doesNotMatch(page, /data-rental="(membership|plan|manager|application)"/, `${name}: old pricing keys`);
    assert.doesNotMatch(page, /0\.8%|capped at \$7|max \$7/, `${name}: ACH is a flat fee`);
    assert.doesNotMatch(page, /\$29|\$50 background|background check is|paid by the applicant/i, `${name}: old prices`);
    assert.doesNotMatch(page, /AI answers tenant messages/, `${name}: Autopilot is a programmed chat`);
    assert.doesNotMatch(page, /Instant Income|applicationIncome|applicationPremium/, `${name}: old tiers`);
    assert.doesNotMatch(page, /use it (on|for) other applications|share it with other landlords/i, `${name}: sharing is off`);
  }
});
