import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const PUBLIC = new URL('../../public/', import.meta.url);
const read = (p) => readFile(new URL(p, PUBLIC), 'utf8');
const pricing = await read('pricing.js');
const landlords = await read('landlords/index.html');
const renters = await read('renters/index.html');
const ad = await read('go/landlords/index.html');
const adOld = await read('go/landlords/old/index.html');
const role = await read('for/landlords/index.html');

// The landlord plan (owner, 2026-11-16: "7.99 a month to add as many rentals
// as you want then we keep all the other fees in place the same way ok that
// makes sense also first month is free"). One price per landlord account per
// month, however many rentals, with the first month free; the tenant's bank
// payment fee, the walkthrough and Autopilot are as they were. Applying is
// free for the renter, and background checks (Certn) are not live for renters
// (2026-11-19): a page may say they are coming soon and nothing more, never a
// price, a provider or an income check (the last tests here).
// The earlier founding-partner program (free for the first 10,000
// landlords) is closed (owner, 2026-11-16: "forget the founding members stuff
// ok that isnt working ok lets completely shift the model"): no landlord page
// offers it, shows a count, or calls a landlord's rentals free.
const PLAN = Number(pricing.match(/^\s*plan:\s*([\d.]+)/m)[1]);
const PLAN_TEXT = `$${PLAN}`;
const YEAR_TEXT = `$${(Math.round(PLAN * 12 * 100) / 100).toFixed(2)}`;
// The card on file is charged for booked work, for NOHM Autopilot (the server
// bills it to the rental card even when the plan was bought in a store) and,
// on the web, for the plan. Never "charged only for".
const CARD_LINE = /We ask for a card on file to keep fake accounts out\. It&rsquo;s charged for work you book, and for NOHM Autopilot if you turn it on\. If you start your plan on the web, it is also charged for the plan after your free month\./;

// Every built page under /landlords/ (topics, forms, guides) and the
// hand-written landlord pages. The privacy, terms and SMS pages are left out
// on purpose: they describe a welcome text that really goes to the few
// existing founding partners, and are not marketing.
async function walk(dir) {
  const out = [];
  for (const e of await readdir(new URL(dir, PUBLIC), { withFileTypes: true })) {
    const rel = `${dir}${e.name}`;
    if (e.isDirectory()) out.push(...(await walk(`${rel}/`)));
    else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out;
}
const BUILT = await walk('landlords/');
const HAND = ['go/landlords/index.html', 'go/landlords/old/index.html', 'for/landlords/index.html', 'join/landlord/index.html', 'start/index.html', 'ig/index.html', 'landlords/index.html'];

test('pricing.js has the plan: $7.99 a month, 30 days free, and no "free" key for rentals', () => {
  assert.equal(PLAN, 7.99);
  assert.match(pricing, /trialDays:\s*30/);
  assert.doesNotMatch(pricing, /^\s*free:/m);
  assert.doesNotMatch(pricing, /incomeCheck:|membership|manager:|\bfounding[A-Za-z]*:/i);
  // Everything else is as it was.
  assert.match(pricing, /autopilot:\s*19\.99/);
  assert.match(pricing, /walkthrough:\s*79/);
  assert.match(pricing, /application:\s*50/);
  assert.match(pricing, /achFee:\s*7/);
  assert.doesNotMatch(pricing, /applicationIncome|applicationPremium|achRatePercent|achCap/);
  // The ways a page shows it: the plan, twelve months of it, the free days.
  assert.match(pricing, /data-rental-year/);
  assert.match(pricing, /data-rental-days/);
  assert.equal(YEAR_TEXT, '$95.88');
});

test('no landlord page offers the closed founding-partner program, calls rentals free, or says "Sign up free"', async () => {
  const BANNED = [
    /first 10,000|10,000 landlords|of 10,000/i,
    /founding (partner|member)|founders partners/i,
    /free for good|free for the first|free for landlords|free for founding/i,
    /sign up free|sign up for nohm free|free to sign up|why is it free|how nohm is free/i,
    /direct line to the founder/i,
    /no (monthly fee|subscription|plan)\b|never (a|charged a) subscription/i,
    /rentals? (are|is) free|free (rental|landlord) software|list (your|a) rental for free|data-rental="free"/i,
    /cheapest|lowest price|lowest-priced|lowest cost/i,
  ];
  for (const f of [...HAND, ...BUILT]) {
    const page = await read(f);
    for (const re of BANNED) assert.doesNotMatch(page, re, `${f}: ${re}`);
  }
  // No count, no "spots left", on the pages people read.
  const COUNT = /spots? (left|remaining)|of 10,000 (taken|claimed|left)|data-(founding|partners?)-(count|left)|foundingPartnerCount|\/rentals\/plans/i;
  for (const f of HAND) assert.doesNotMatch(await read(f), COUNT, f);
  // The one "free" that may attach to the landlord plan is the first month.
  for (const [name, page] of [['/landlords', landlords], ['/for/landlords', role], ['/go/landlords', ad], ['/go/landlords/old', adOld]]) {
    assert.match(page, /first month (is )?free|free month/i, name);
    assert.doesNotMatch(page, /free to use/i, name);
  }
});

test('the plan is on every landlord page that prices things, from pricing.js, with matching typed fallbacks', () => {
  for (const [name, page] of [['/landlords', landlords], ['/for/landlords', role], ['/go/landlords', ad], ['/go/landlords/old', adOld]]) {
    assert.match(page, /<script src="\/pricing\.js"><\/script>/, name);
    const spans = [...page.matchAll(/data-rental="plan">([^<]+)</g)].map((m) => m[1]);
    assert.ok(spans.length >= 2, `${name} shows the plan`);
    for (const s of spans) assert.equal(s, PLAN_TEXT, name);
    for (const m of page.matchAll(/data-rental-year="plan">([^<]+)</g)) assert.equal(m[1], YEAR_TEXT, name);
    // The words a crawler reads without running a script.
    const meta = page.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(meta.includes(PLAN_TEXT), `${name}: the description says ${PLAN_TEXT}`);
    // (/landlords keeps its search title: what it is, not what it costs.)
    if (name !== '/landlords') assert.ok(page.match(/<title>([^<]+)<\/title>/)[1].includes(PLAN_TEXT), `${name}: the title says ${PLAN_TEXT}`);
    // No price typed outside a price span: every "$7.99" in the body sits in one.
    const body = page.slice(page.indexOf('<body'));
    for (const m of body.matchAll(/\$7\.99/g)) {
      assert.ok(/data-rental(-year)?="plan">$/.test(body.slice(Math.max(0, m.index - 24), m.index)), `${name}: a typed ${PLAN_TEXT} outside a price span`);
    }
  }
});

test('/landlords, /for/landlords and /go/landlords say what the plan is, how it is billed and that the payment fees are unchanged', () => {
  for (const [name, page] of [['/landlords', landlords], ['/for/landlords', role], ['/go/landlords', ad]]) {
    assert.match(page, /for as many rentals as you add/i, name);
    assert.match(page, /First month free|first month is free|Your first month is free/i, name);
    assert.match(page, /cancel any time/i, name);
    assert.match(page, /billed by the App Store or Google Play when you (buy it )?in the app/i, name);
    assert.match(page, /(to|on) your card (when you buy it )?on the web/i, name);
    assert.match(page, /never (pay )?more than <span data-rental="plan">\$7\.99<\/span> a month/i, name);
    assert.match(page, /Financial Management on every rental: rent collection and tracking, ledgers and financial records, payment reminders and financial reporting/, name);
    // The card on file is still there, charged for booked work and (on the web) the plan.
    assert.match(page, /card on file/i, name);
    assert.doesNotMatch(page, /only charged for work you book\b/, name);
  }
  for (const [name, page] of [['/landlords', landlords], ['/for/landlords', role], ['/go/landlords', ad], ['/go/landlords/old', adOld]]) {
    assert.doesNotMatch(page, /charged only for (work|repairs)/i, name);
    assert.match(page, /NOHM Autopilot if you turn it on\. If you start your plan on the web, it is also charged for the plan after your free month\./, name);
  }
  for (const [name, page] of [['/landlords', landlords], ['/go/landlords', ad]]) assert.match(page, /Schedule E/, name);
  assert.match(landlords, CARD_LINE);
  assert.match(role, CARD_LINE);
  // Payment fees: the tenant's bank fee (about $5 the processor's, about $2 NOHM's). Applications are free.
  assert.match(landlords, /<h3>Your tenant pays<\/h3>\s*<div class="price"><b data-rental="achFee">\$7<\/b><\/div>/);
  assert.match(landlords, /When they pay rent by bank \(or you can cover it for them\)\. About \$5 of it is the bank processor&rsquo;s cost\. NOHM keeps about \$2\./);
  assert.match(role, /when they pay rent by bank \(or you can cover it for them\)/i);
  assert.match(role, /About \$5 of it is the bank processor&rsquo;s cost\. NOHM keeps about \$2\./);
  assert.match(ad, /About \$5 of it is the bank processor&rsquo;s cost, and NOHM keeps about \$2\./);
  assert.match(landlords, /<h3>Applications<\/h3>\s*<div class="price"><b>\$0<\/b><\/div>\s*<p>Applying is free for your applicant\. Your applicant pays for the background and credit check\.<\/p>/);
  assert.match(role, /<p class="name">Applications<\/p>\s*<p class="price">\$0<\/p>\s*<p class="per">for you and for your applicant<\/p>\s*<p>Your applicant pays for the background and credit check\.<\/p>/);
  assert.match(ad, /<dt>Applications<\/dt><dd>Applying is free for you and for your applicant\. Your applicant pays for the background and credit check\.<\/dd>/);
  assert.match(adOld, /<dt>Applications<\/dt><dd>Applying is free for you and for your applicant\. Your applicant pays for the background and credit check\.<\/dd>/);
  // A returned bank payment, in the words of the app's own plan terms.
  for (const [name, page] of [['/landlords', landlords], ['/go/landlords', ad]]) {
    assert.match(page, /If a tenant&rsquo;s bank payment is returned, the bank&rsquo;s return fee \(about \$4\) is taken from your next payout\./, name);
  }
  // Work the landlord books is still theirs to pay, priced first.
  assert.match(landlords, /If you book a pro for a repair or a NOHM walkthrough, you pay for that work, and you see the price before you book[.:]/);
  assert.match(role, /If you book a pro for a repair or a NOHM walkthrough, you pay for that work, and you see the price before you book[.:]/);
  assert.doesNotMatch(landlords + role + ad, /you pay neither|not yours|never sell|don&rsquo;t sell|do not sell/i);
});

test('"What does it cost?": the plan, the free month, cancel any time, and the unchanged fees in one short list', () => {
  for (const [name, page] of [['/landlords', landlords], ['/go/landlords', ad]]) {
    const at = page.indexOf('<summary>What does ');
    assert.ok(at > 0, name);
    const faq = page.slice(at, page.indexOf('</details>', at));
    assert.match(faq, /What does (NOHM|it) cost\?/, name);
    assert.match(faq, /<span data-rental="plan">\$7\.99<\/span> a month per landlord account, for as many rentals as you add\. Your first month is free, and you can cancel any time\./, name);
    assert.match(faq, /<li>The plan: <span data-rental="plan">\$7\.99<\/span> a month, however many rentals\./, name);
    assert.match(faq, /<li>Your tenant&rsquo;s bank payment: <span data-(rental|price)="(achFee|ACH_RENT_FEE)">\$7<\/span> each time, paid by the tenant or covered by you\./, name);
    assert.match(faq, /<li>Applications: free\. Background and credit checks: paid by the applicant\.<\/li>/, name);
    assert.match(faq, /<li>NOHM Walkthrough: <span data-rental="walkthrough">\$79<\/span>, only if you order one\./, name);
    assert.match(faq, /<li>NOHM Autopilot: <span data-(rental|price)="(autopilot|RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY)">\$19\.99<\/span> a month per rental, optional\./, name);
  }
  // The old questions are gone.
  assert.doesNotMatch(ad, /data-q="(why-free|after)"|What if I&rsquo;m not in/);
  // What NOHM is paid by.
  assert.match(landlords, /<summary>How does NOHM make money\?<\/summary><p>From the plan\. And when your tenant pays rent by bank, they pay a <span data-rental="achFee">\$7<\/span> fee/);
  assert.match(ad, /NOHM is paid by the plan and about \$2 of each \$7 bank payment fee\. NOHM takes no cut of your rent\./);
});

test('the ad pages: the button says "Start your free month", and the sign-up tags stay', () => {
  for (const from of ['lp-hero', 'lp-final', 'lp-ps']) {
    assert.match(ad, new RegExp(`<a class="btn" href="/join/landlord/\\?from=${from}">Start your free month</a>`), from);
  }
  for (const from of ['old-hero', 'old-final']) {
    assert.match(adOld, new RegExp(`<a class="btn" href="/join/landlord/\\?from=${from}">Start your free month</a>`), from);
  }
  assert.match(ad, /<h1>Rent paid straight to your bank\. Every rental run from your phone\.<\/h1>/);
  assert.match(adOld, /<h1>Rental software\. <span data-rental="plan">\$7\.99<\/span> a month, first month free\.<\/h1>/);
  assert.match(adOld, /<meta name="robots" content="noindex, follow" \/>/);
  assert.match(ad, /<meta name="robots" content="noindex, follow" \/>/);
});

test('the role page and /landlords: "One plan. Every rental.", the plan card, and the vent box with no perk wording', () => {
  assert.match(role, /<p class="sub"><span data-rental="plan">\$7\.99<\/span> a month for every rental\. First month free\.<\/p>/);
  assert.match(role, /<h2>One plan\.<br \/>Every rental\.<\/h2>/);
  assert.match(role, /<p class="name">Your plan<\/p>/);
  assert.match(role, /<p class="name">Your tenant pays<\/p>/);
  assert.match(role, /<p class="name">Applications<\/p>/);
  assert.match(role, /<h2>Vent to us\.<\/h2>/);
  assert.match(role, /Tell the founder\. We&rsquo;ll help you solve it\./);
  assert.match(landlords, /<h2>One plan\.<br \/>Every rental\.<\/h2>/);
  assert.match(landlords, /<h3>Your plan<\/h3>\s*<div class="price"><b data-rental="plan">\$7\.99<\/b><\/div>/);
});

test('the landlord topic pages and every forms and guide page end on the plan, built from pricing.js', async () => {
  const ASK = `<p><span data-rental="plan">${PLAN_TEXT}</span> a month for every rental. First month free.</p>`;
  for (const slug of ['rent-collection', 'tenant-screening', 'lease-signing', 'rental-listings', 'maintenance', 'accounting', 'autopilot']) {
    const page = await read(`landlords/${slug}/index.html`);
    assert.ok(page.includes(ASK), slug);
    assert.match(page, /<script src="\/pricing\.js" defer><\/script>/, slug);
  }
  for (const slug of ['rent-collection', 'accounting']) {
    const page = await read(`landlords/${slug}/index.html`);
    assert.match(page, /<h2>One plan\. Every rental\.<\/h2>/, slug);
    assert.match(page, /<p class="lede"><span data-rental="plan">\$7\.99<\/span> a month per landlord account, for as many rentals as you add\. First month free\. Cancel any time\.<\/p>/, slug);
    assert.match(page, /<p class="name">Your tenant pays<\/p>/, slug);
    assert.match(page, /About \$5 of it is the bank processor&rsquo;s cost\. NOHM keeps about \$2\./, slug);
  }
  assert.match(await read('landlords/rent-collection/index.html'), /<meta name="description" content="[^"]*\$7\.99 a month, first month free\./);
  const autopilot = await read('landlords/autopilot/index.html');
  assert.match(autopilot, /<p class="name">Your plan<\/p>\s*<p class="price"><span data-rental="plan">\$7\.99<\/span><\/p>/);
  // Forms, guides and the hubs: the same ask.
  for (const f of ['landlords/forms/index.html', 'landlords/forms/arkansas/index.html', 'landlords/forms/late-rent-notice/index.html', 'landlords/guides/arkansas/index.html']) {
    const page = await read(f);
    assert.ok(page.includes(ASK), f);
    assert.match(page, /<script src="\/pricing\.js" defer><\/script>/, f);
  }
  const guides = BUILT.filter((f) => f.startsWith('landlords/guides/arkansas/') && f.split('/').length === 5);
  assert.ok(guides.length >= 8, 'the Arkansas guides');
  for (const f of guides) assert.ok((await read(f)).includes(ASK), f);
});

test('the landlords page lists the topics without calling listings free', () => {
  assert.match(landlords, /<li><a href="\/landlords\/rental-listings\/">Rental listings<span>Photos, an Apply button, unlimited applications<\/span><\/a><\/li>/);
  assert.doesNotMatch(landlords, /<span>Free, with unlimited applications<\/span>/);
});

test('landlord page shows customer prices and comparison sources', () => {
  assert.match(landlords, /data-rental="plan">\$7\.99/);
  assert.match(landlords, /data-rental="achFee">\$7/);
  assert.match(landlords, /data-rental="walkthrough">\$79/);
  assert.doesNotMatch(landlords, /0\.8%|data-rental="membership"|data-rental="manager"|data-rental="free"/);
  assert.match(landlords, /Your tenant pays the <span data-rental="achFee">\$7<\/span> bank payment fee, or you can cover it for them\./);
  assert.doesNotMatch(landlords, /wholesale cost|platform margin/i);
  // Applications, told as the story's scene, in the order the app runs them:
  // sent from the app, filled in on the applicant's phone, the check seen in
  // the app, the renter picked, the lease signed.
  assert.match(landlords, /<h3>Your next tenant applies from her phone\.<\/h3>\s*<p>You send the application with one tap\. She fills it in, in English or Spanish\. You see her background and credit check, pick your renter, and the lease is signed on both phones\./);
  assert.match(landlords, /<li>Applications are free for applicants<\/li>\s*<li>Background and credit checks<\/li>/);
  assert.doesNotMatch(landlords, /Instant Income|applicationIncome|applicationPremium/);
});

// The comparison (owner's rule: competitor figures link the provider's own
// current pricing page and say when they were checked; only paid plans; never
// "cheapest"; a figure that can't be verified is dropped). Checked 2026-11-16
// by fetching each page. Dropped: Landlord Studio (its page showed £12 on the
// plan cards and $15 in its US table), Hemlane ($28 platform fee plus per-unit
// charges, so no single price) and the free plans (paid plans only).
const CHECKED = 'November 16, 2026';
const SOURCES = {
  'RentRedi, annual plan': 'https://rentredi.com/pricing',
  'TurboTenant Essentials': 'https://www.turbotenant.com/pricing/',
  'TurboTenant Pro': 'https://www.turbotenant.com/pricing/',
  'TenantCloud Starter': 'https://www.tenantcloud.com/pricing',
  'Baselane Smart': 'https://www.baselane.com/pricing/',
  'Avail Unlimited Plus': 'https://www.avail.co/pricing',
};

test('the comparison: paid plans only, each competitor figure with its own pricing page and the date it was checked', () => {
  const at = landlords.indexOf('<section class="compare"');
  const compare = landlords.slice(at, landlords.indexOf('</section>', at));
  assert.match(compare, /Landlord cost comparison/);
  assert.match(compare, /Paid plans only, each checked on the company&rsquo;s own pricing page on November 16, 2026\./);
  assert.match(compare, /Some of these companies also have free plans, and feature sets differ, so this compares what the paid plans cost, not what they do\./);
  const rows = [...compare.matchAll(/<tr( class="nohm-row")?>([\s\S]*?)<\/tr>/g)].filter((m) => !m[2].includes('<th>'));
  const nohm = rows.find((m) => m[1]);
  assert.ok(nohm && /data-rental="plan">\$7\.99/.test(nohm[2]) && /data-rental-year="plan">\$95\.88/.test(nohm[2]), 'NOHM: $7.99 a month, $95.88 a year');
  const others = rows.filter((m) => !m[1]);
  assert.deepEqual(others.map((m) => m[2].match(/<td>([^<]+)<\/td>/)[1]), Object.keys(SOURCES));
  for (const m of others) {
    const name = m[2].match(/<td>([^<]+)<\/td>/)[1];
    assert.ok(m[2].includes(`<a href="${SOURCES[name]}" target="_blank" rel="noopener">`), `${name}: a link to the provider's own pricing page`);
    assert.ok(m[2].includes(`<small>Checked ${CHECKED}</small>`), `${name}: when it was checked`);
  }
  // The figures as the pages showed them on that day.
  const figure = (name) => others.find((m) => m[2].includes(`<td>${name}</td>`))[2];
  assert.match(figure('RentRedi, annual plan'), /\$12 a month, billed annually\. \$29\.95 a month if billed monthly\./);
  assert.match(figure('TurboTenant Essentials'), /\$149 a year for 1&ndash;10 units/);
  assert.match(figure('TurboTenant Pro'), /\$199 a year for 1&ndash;10 units/);
  assert.match(figure('TenantCloud Starter'), /\$15 a month, billed annually/);
  assert.match(figure('Baselane Smart'), /\$20 a month, on an annual plan/);
  assert.match(figure('Avail Unlimited Plus'), /\$9 per unit, per month/);
  // The dropped ones are not shown, and no free plan is in the table.
  assert.doesNotMatch(compare, /Landlord Studio|Hemlane|Zillow|Innago|Stessa/);
  // Other companies are named only inside this component.
  const rest = landlords.slice(0, at) + landlords.slice(landlords.indexOf('</section>', at));
  for (const co of ['RentRedi', 'TurboTenant', 'TenantCloud', 'Baselane', 'Avail']) {
    assert.doesNotMatch(rest, new RegExp(`\\b${co}\\b`), co);
    for (const [name, page] of [['/for/landlords', role], ['/go/landlords', ad], ['/go/landlords/old', adOld]]) assert.doesNotMatch(page, new RegExp(`\\b${co}\\b`), `${name}: ${co}`);
  }
});

test('renter page: applying is free, the bank fee is said, and the background and credit check is not priced', () => {
  assert.match(renters, /<span data-rental="achFee">\$7<\/span> bank payment fee, shown before you pay; your landlord may cover it\. Applying is free\. Your landlord pays for the repairs they approve\./);
  assert.match(renters, /<summary>How much is a rental application\?<\/summary><p>Nothing\. Applying is free\.<\/p>/);
  assert.match(renters, /<summary>Is there a background and credit check\?<\/summary><p>Your landlord can ask for one with your application\. You fill in the application on your phone and pay for the background and credit check there\./);
  assert.doesNotMatch(renters, /your landlord pays for it/);
  assert.doesNotMatch(renters, /Instant Income|applicationIncome|applicationPremium/);
  assert.doesNotMatch(renters, /wholesale cost|platform margin/i);
});

test('renter pages: a free app and a free application, with the bank fee said where it applies', async () => {
  for (const f of ['renters/index.html', 'for/renters/index.html', 'invite/renter/index.html']) {
    const page = await read(f);
    // The app and applying cost nothing; paying rent by bank has a fee.
    assert.doesNotMatch(page, /Free for renters|NOHM costs renters nothing|Always\.</, f);
  }
  const renterRole = await read('for/renters/index.html');
  assert.match(renterRole, /One application, right from your phone\. Applying is free\.<\/p>/);
  assert.match(renterRole, /<span data-price="ACH_RENT_FEE">\$7<\/span> bank payment fee, shown before you pay; your landlord may cover it\. Applying is free\.<\/p>/);
});

// NOHM Autopilot is not free: $19.99 a month per rental, shown beside what a
// property manager takes (about 10%).
const AUTOPILOT_FREE = /Autopilot too|and (NOHM )?Autopilot\.|the books and (NOHM )?Autopilot|Autopilot[^<.]{0,40}\b(free|included)\b|Optional, and free/i;
const PM = (price, share) => new RegExp(`A property manager takes about 10% of the rent: \\$150 a month on a \\$1,500 home\\. Autopilot is ${price}, about ${share}\\.`);

test('Autopilot is priced, never free, with the property manager line beside it', async () => {
  const autopilotTopic = await read('landlords/autopilot/index.html');
  for (const [name, page] of [['/landlords', landlords], ['/go/landlords', ad], ['/for/landlords', role], ['/landlords/autopilot', autopilotTopic]]) {
    assert.doesNotMatch(page, AUTOPILOT_FREE, name);
    assert.doesNotMatch(page, /15%/, name);
  }
  // The role page takes the price and its share from the server's key...
  const live = PM('<span data-price="RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY">\\$19\\.99<\\/span>', '<span data-price-share="RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY" data-share-of="150000">1\\.3%<\\/span>');
  assert.match(role, live);
  // ...the others from /pricing.js.
  const local = PM('<span data-rental="autopilot">\\$19\\.99<\\/span>', '<span data-rental-share="autopilot" data-share-of="1500">1\\.3%<\\/span>');
  assert.match(landlords, local);
  assert.match(autopilotTopic, local);
  assert.match(landlords, /<h3>NOHM Autopilot<\/h3>\s*<div class="price"><b data-rental="autopilot">\$19\.99<\/b><\/div>/);
  // The ad page says it is optional, at its price, and what a property manager takes.
  assert.match(ad, /<dt>Autopilot<\/dt><dd>Optional, <span data-price="RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY">\$19\.99<\/span> a month per rental\./);
  assert.match(ad, /A property manager takes about 10% of the rent: \$150 a month on a \$1,500 home\./);
  // The plan card keeps Autopilot optional and priced.
  assert.match(role, /NOHM Autopilot is optional: <span data-price="RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY">\$19\.99<\/span> a month per rental, and it runs the rental for you\./);
  assert.match(landlords, /NOHM Autopilot is optional, priced below\./);
});

test('the typed fallbacks match /pricing.js: $19.99 and its share of $1,500', () => {
  const autopilot = Number(pricing.match(/autopilot:\s*([\d.]+)/)[1]);
  const share = `${Math.round((autopilot / 1500) * 1000) / 10}%`;
  assert.equal(share, '1.3%');
  for (const page of [landlords, ad, adOld, role]) {
    for (const m of page.matchAll(/data-(?:rental|price)="(?:autopilot|RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY)">([^<]+)</g)) assert.equal(m[1], `$${autopilot}`);
    for (const m of page.matchAll(/data-(?:rental|price)-share="[^"]+" data-share-of="\d+">([^<]+)</g)) assert.equal(m[1], share);
  }
});

test('the founding-partner line is on no page of the site except the SMS, privacy and terms pages', async () => {
  // Those three describe the founder's welcome text that really goes to the
  // few existing founding partners (compliance wording): left as they are.
  const allowed = new Set(['sms/index.html', 'privacy/index.html', 'terms/index.html']);
  const files = (await walk('')).filter((f) => !f.startsWith('vendor/') && !f.startsWith('landlords/forms/') && !f.startsWith('landlords/guides/'));
  for (const f of files) {
    if (allowed.has(f)) continue;
    assert.doesNotMatch(await read(f), /founding partner|first 10,000|free for good/i, f);
  }
  for (const f of allowed) assert.match(await read(f), /Founding Partner/, f);
});

// Background and credit checks (owner, 2026-11-20: "On the site just put
// background and credit check it's ok we will get it done before the signup
// starts don't want to forget to go back"). The site said "coming soon" from
// 2026-11-19, while they were not live for real renters; it now says a
// landlord gets a background and credit check, in those words, paid by the
// applicant, and nothing more: no price, no provider, no income or bank
// check. THEY MUST BE ON before sign-ups and ads start; if they are not, the
// "coming soon" wording comes back (git show 3d4c1e3). The Terms' section C.2
// ("NOHM may offer ... background checks of service providers") and the
// Privacy Policy's Plaid section are legal wording, not marketing.
const SAID = [/background and credit checks?/gi];
const NOT_SAID = /Certn|RENTAL_APPLICATION_FEE|data-rental="application"|paidScreening|Income Check|W-2|credit and criminal|checks the bank|fake paperwork|adverse-action|coming soon to NOHM|Background checks are (coming soon|not on yet)/i;

test('background and credit checks: said in those words, with no price, provider or income check', async () => {
  const legal = new Set(['terms/index.html', 'privacy/index.html']);
  const files = (await walk('')).filter((f) => !f.startsWith('vendor/') && !f.startsWith('landlords/forms/') && !f.startsWith('landlords/guides/'));
  for (const f of files) {
    if (legal.has(f)) continue;
    let page = await read(f);
    assert.doesNotMatch(page, NOT_SAID, f);
    for (const re of SAID) page = page.replace(re, '');
    assert.doesNotMatch(page, /background check|credit check/i, `${f}: said some other way`);
  }
  // No $50 on a landlord or renter page (it was the background check's price).
  for (const f of [...HAND, 'renters/index.html', 'for/renters/index.html', 'landlords/tenant-screening/index.html', 'landlords/rental-listings/index.html']) {
    assert.doesNotMatch(await read(f), /\$50\b/, f);
  }
  // The topic page keeps its address; the tiles follow.
  const topic = await read('landlords/tenant-screening/index.html');
  assert.match(topic, /<title>Tenant Screening for Landlords: Background and Credit Checks \| NOHM<\/title>/);
  assert.match(topic, /<h1>Tenant screening\.<\/h1>/);
  assert.match(landlords, /<li><a href="\/landlords\/tenant-screening\/">Tenant screening<span>Background and credit checks<\/span><\/a><\/li>/);
  assert.match(role, /<h3>Screen applicants\.<\/h3>\s*<p>They apply on their phone\. You see their background and credit check in the app\.<\/p>/);
  // The landlord page's story names it where the next tenant applies.
  assert.match(landlords, /You see her background and credit check, pick your renter/);
  // The ad page shows two app pictures; the third said "Rent collection is free".
  assert.equal([...ad.matchAll(/<figure>/g)].length, 2);
  assert.doesNotMatch(ad, /tools\.webp/);
});

// No landlord page promises a complete list of costs. The app's plan terms
// also list Stripe's payment processing fees (payout fees, a monthly account
// fee, dispute and returned payment fees, taken from rent collected), and
// whether the payout and account fees reach a landlord depends on the kind of
// payout account the server gives them. Until that is settled the pages say
// how NOHM gets paid and what a landlord pays NOHM, and no more than that.
test('no landlord page claims to list every cost', () => {
  const COMPLETE = /every way|all of it|exactly what it costs|every cost|here(&rsquo;s| is) what it costs|the whole catch/i;
  for (const [name, page] of [['/landlords', landlords], ['/for/landlords', role], ['/go/landlords', ad], ['/go/landlords/old', adOld]]) {
    // The words people read: the head's description and the body, not the CSS comments.
    const read = page.match(/<meta name="description" content="([^"]+)"/)[1] + page.slice(page.indexOf('<body'));
    assert.doesNotMatch(read, COMPLETE, name);
  }
  assert.match(ad, /<h2>What&rsquo;s the catch\?<\/h2>\s*<p>Here is how NOHM gets paid, and what you pay NOHM\.<\/p>/);
  assert.match(ad, /<b>your first month is free<\/b>\. Here&rsquo;s how NOHM gets paid\.<\/p>/);
  assert.match(ad, /<meta name="description" content="[^"]*your first month is free\. Here is how NOHM gets paid\." \/>/);
  assert.match(landlords, /Your first month is free, and you can cancel any time\. Here is how NOHM gets paid, and what you pay NOHM\.<\/p>/);
});
