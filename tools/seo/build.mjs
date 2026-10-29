// Builds the topic pages: one page per subject for the people who search
// for it, nationwide (never a town: NOHM is wherever local pros have
// joined).
//
//   /services/<trade>/   homeowners booking that trade
//   /pros/<trade>/       pros of that trade looking for jobs
//   /landlords/<topic>/  one landlord job: rent, screening, leases, ...
//   /pros/ready-now/     on-demand work for pros
//
// Every claim here is one the site already makes (/homeowners,
// /for/homeowners, /for/pros, /landlords, /for/landlords) or the app's
// own lists (the trade issues are public/book/lib/issues.js, the app's
// catalog). Prices come from /pricing.js and /for/live.js, never typed.
//
// Run after changing anything here:  node tools/seo/build.mjs
// tools/seo/build.test.mjs fails while a page is out of date.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ISSUES } from '../../public/book/lib/issues.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const HOST = 'https://nohm.app';

// ── The 15 services ───────────────────────────────────────────────
// slug (as on /services and /book), the server's Trade.name, the /services
// card's label and words, who does it, and how people search for it.
// `book`: bookable on the web (/book?trade=<slug>); `video`: a loop in
// public/video/<slug>-720.*.
export const SERVICES = [
  { slug: 'plumbing', name: 'PLUMBING', label: 'Plumbing', blurb: 'Leaks, clogs, water heaters', who: 'a plumber', search: 'Book a Local Plumber', h1: 'Book a local plumber.', jobs: 'plumbing jobs', book: true, video: true, pos: '50% 0%' },
  { slug: 'hvac', name: 'HVAC', label: 'HVAC', blurb: 'No heat, no AC', who: 'an HVAC pro', search: 'Book HVAC Repair, Heating & AC', h1: 'Book HVAC repair.', jobs: 'HVAC jobs', book: true },
  { slug: 'electrical', name: 'ELECTRICAL', label: 'Electrical', blurb: 'Outages, outlets, breakers', who: 'an electrician', search: 'Book a Local Electrician', h1: 'Book a local electrician.', jobs: 'electrical jobs', book: true },
  { slug: 'appliance', name: 'APPLIANCE', label: 'Appliance', blurb: 'Washers, dryers, fridges', who: 'an appliance repair pro', search: 'Book Appliance Repair', h1: 'Book appliance repair.', jobs: 'appliance repair jobs', book: true, video: true, pos: '50% 30%' },
  { slug: 'locksmith', name: 'LOCKSMITH', label: 'Locksmith', blurb: 'Locked out, rekeys', who: 'a locksmith', search: 'Book a Local Locksmith', h1: 'Book a local locksmith.', jobs: 'locksmith jobs', video: true },
  { slug: 'pressure-washing', name: 'PRESSURE_WASHING', label: 'Pressure Washing', blurb: 'Driveways, siding, decks', who: 'a pressure washing pro', search: 'Book Pressure Washing', h1: 'Book pressure washing.', jobs: 'pressure washing jobs' },
  { slug: 'handyman', name: 'HANDYMAN', label: 'Handyman', blurb: 'Small fixes, drywall patches', who: 'a handyman', search: 'Book a Local Handyman', h1: 'Book a local handyman.', jobs: 'handyman jobs' },
  { slug: 'landscaping', name: 'LANDSCAPING', label: 'Landscaping & Lawn Care', blurb: 'Mowing, beds, yard cleanups', who: 'a landscaper', search: 'Book Lawn Care & Landscaping', h1: 'Book lawn care and landscaping.', jobs: 'lawn care and landscaping jobs', video: true, pos: '50% 25%' },
  { slug: 'gutters', name: 'GUTTERS', label: 'Gutter Service', blurb: 'Cleaning, repairs, guards', who: 'a gutter pro', search: 'Book Gutter Cleaning & Repair', h1: 'Book gutter cleaning and repair.', jobs: 'gutter jobs' },
  { slug: 'garage-door', name: 'GARAGE_DOOR', label: 'Garage Door Service', blurb: 'Stuck doors, springs, openers', who: 'a garage door pro', search: 'Book Garage Door Repair', h1: 'Book garage door repair.', jobs: 'garage door jobs' },
  { slug: 'pest-control', name: 'PEST_CONTROL', label: 'Pest Control', blurb: 'Ants, roaches, rodents', who: 'a pest control pro', search: 'Book Pest Control', h1: 'Book pest control.', jobs: 'pest control jobs', video: true, pos: '50% 25%' },
  { slug: 'painting', name: 'PAINTING', label: 'Painting', blurb: 'Interior, exterior, touch-ups', who: 'a painter', search: 'Book a Local Painter', h1: 'Book a local painter.', jobs: 'painting jobs', video: true, pos: '60% 50%' },
  { slug: 'flooring', name: 'FLOORING', label: 'Flooring', blurb: 'Installs, repairs, refinishing', who: 'a flooring pro', search: 'Book Flooring Install & Repair', h1: 'Book flooring install and repair.', jobs: 'flooring jobs', video: true },
  { slug: 'house-cleaning', name: 'HOUSE_CLEANING', label: 'House Cleaning', blurb: 'Regular, deep, move-out', who: 'a house cleaner', search: 'Book House Cleaning', h1: 'Book house cleaning.', jobs: 'house cleaning jobs', pos: '50% 30%' },
  { slug: 'tree-service', name: 'TREE_SERVICE', label: 'Tree Service', blurb: 'Trimming, removal, storm cleanup', who: 'a tree service pro', search: 'Book Tree Service', h1: 'Book tree service.', jobs: 'tree service jobs' },
];

// Three Quotes' launch categories (replacements only), by trade.
const QUOTES = {
  HVAC: 'HVAC systems and packaged HVAC units',
  PLUMBING: 'water heaters and tankless water heaters',
  ELECTRICAL: 'electrical panels and standby generators',
};

// ── Landlord topics ───────────────────────────────────────────────
// Each says only what /landlords and /for/landlords say.
const LANDLORD = [
  {
    slug: 'rent-collection',
    title: 'Online Rent Collection for Landlords | NOHM',
    desc: 'Collect rent online by bank transfer, straight to your own account. Autopay, reminders and late fees run themselves. $7 per rental a month, only when you turn it on.',
    h1: 'Collect rent online.',
    sub: 'Tenants pay by bank, straight to your account. Autopay, reminders and late fees run themselves.',
    img: ['renter', 1448, 1086, '50% 30%', 'A renter on his couch paying rent and sending a repair request from his phone'],
    cards: [
      ['Straight to you.', 'Rent goes to your own connected payout account. NOHM takes no cut of rent.'],
      ['Autopay for tenants.', 'Tenants set it once. Reminders go out before rent is due.'],
      ['Late fees, automatic.', 'Set your grace days and late fee once, and NOHM adds it when rent is late.'],
      ['Paid, due and late.', 'See every unit at a glance. Record cash and check payments too.'],
    ],
    specsTitle: 'Rent on NOHM.',
    specs: [
      ['Rent by bank transfer', 'ACH, straight to your own account'],
      ['Autopay', 'Tenants pay on time without thinking about it'],
      ['Reminders', 'Sent before rent is due'],
      ['Late fees and grace days', 'Added automatically'],
      ['Cash and check', 'Record payments made outside the app'],
      ['One-off charges', 'Add them, or waive them'],
      ['Ledgers and reports', 'Every payment on the record, per rental'],
    ],
    price: 'rent',
  },
  {
    slug: 'tenant-screening',
    title: 'Tenant Screening for Landlords | NOHM',
    desc: 'Screen tenants without fake paperwork: a Certn background check paid by the applicant where allowed, and an optional NOHM Income Check straight from their bank.',
    h1: 'Screen tenants. Skip the fake paperwork.',
    soon: 'paidScreening',
    sub: 'Edited pay stubs, W-2s and bank statements are sold online, and they look real. NOHM never asks applicants for paperwork.',
    img: ['door', 1536, 864, '60% 30%', 'A NOHM pro walking up to a rental’s front door'],
    cards: [
      ['Background check.', 'Certn runs identity, credit and criminal checks. <span data-rental="application">$50</span>, paid by the applicant where the law allows.'],
      ['Income, from the bank.', 'The optional NOHM Income Check reads income from the applicant’s own bank through Plaid. <span data-rental="incomeCheck">$20</span>, paid by you, only if they connect.'],
      ['Local limits, applied.', 'Where a state or city sets less, the applicant pays less. NOHM applies the limit before checkout.'],
      ['Notices sent for you.', 'Adverse-action notices go out for you when you decline.'],
    ],
    steps: [
      ['Send the application.', 'They apply by text and pay for the background check.'],
      ['See the results.', 'The background check shows up in the app.'],
      ['Approve.', 'They pay the deposit and first month from their bank, straight to your account.'],
    ],
  },
  {
    slug: 'lease-signing',
    title: 'Online Lease Signing & Move-In Reports | NOHM',
    desc: 'Upload your lease and e-sign it in any order, with a certificate. Room-by-room condition reports both sides sign, and move-out shown beside move-in.',
    h1: 'Sign the lease. Lock the move-in.',
    sub: 'E-sign your own lease in the app, then put every room on the record with a condition report both sides sign.',
    img: ['ready', 1536, 1024, '50% 30%', 'A NOHM specialist arriving at a rental with the unit’s details on his tablet'],
    cards: [
      ['Your lease, signed.', 'Upload your own lease. Both sides e-sign in any order, with a certificate, and the signed copy is saved for good.'],
      ['Every room, on the record.', 'Room-by-room condition reports with photos and notes. Both sides sign, then it locks.'],
      ['Move-out, side by side.', 'At move-out every room sits beside how it looked on day one.'],
      ['Deposits, itemized.', 'Itemized deposit statements, with reminders before the deadline.'],
    ],
    specsTitle: 'NOHM Walkthrough.',
    specsLede: 'Rather not do the report yourself? Order a NOHM Walkthrough and a trained local specialist does it for you. <span data-rental="walkthrough">$79</span>, and you pay only when the report is in.',
  },
  {
    slug: 'rental-listings',
    title: 'List Your Rental for Free | NOHM',
    desc: 'List a rental for free with photos and an Apply button. Unlimited applications sent by text, Fair Housing wording checks, and the listing comes down when the lease is signed.',
    h1: 'List it. Fill it.',
    sub: 'List in minutes with photos and an Apply button. Unlimited applications, free.',
    img: ['landlord', 1920, 1280, '22% 35%', 'A landlord with a clipboard shaking hands with her new tenants in the kitchen of a rental'],
    cards: [
      ['Listed in minutes.', 'Photos, rent and an Apply button. Fair Housing wording checks as you write.'],
      ['Applications by text.', 'Send the application to anyone who asks. Unlimited, and free.'],
      ['Down when it’s rented.', 'The listing comes down when a lease is signed.'],
      ['Ready for next time.', 'After move-out, the next listing is drafted for you.'],
    ],
    specsTitle: 'Where renters see it.',
    specs: [
      ['nohm.app/rentals', '<span data-rentals="live" hidden>Your listings appear on <a href="/rentals">nohm.app/rentals</a></span><span data-rentals="soon">Coming soon</span>'],
      ['Zillow, Trulia and HotPads', 'Coming soon'],
      ['Your own link', 'Share the listing anywhere'],
    ],
    rentals: true,
  },
  {
    slug: 'maintenance',
    title: 'Rental Maintenance Requests & Repairs | NOHM',
    desc: 'Tenants send repair requests with photos. Approve with a tap, pick your pro or auto-assign, approve estimates before work, and keep every receipt.',
    h1: 'Repairs, handled.',
    sub: 'Tenants send requests with photos. You approve, or let NOHM Autopilot handle it.',
    img: ['prep', 1536, 1024, '45% 40%', 'A NOHM pro in his van reviewing the job on his tablet'],
    cards: [
      ['Requests with photos.', 'Tenants snap it and send it. Approve, or decline with a reason.'],
      ['Your pro, or ours.', 'Choose your own pro or auto-assign a local pro who meets the NOHM Standard.'],
      ['Estimates first.', 'Approve the estimate before any work starts, and see the cost before you reschedule or cancel.'],
      ['Every repair, kept.', 'Rate every pro and keep the receipt, on the unit’s record.'],
    ],
    specsTitle: 'Pick your speed.',
    speeds: true,
  },
  {
    slug: 'accounting',
    title: 'Rental Property Accounting & Schedule E | NOHM',
    desc: 'Income, costs and profit for every rental, with receipts attached and recurring costs that post themselves. A Schedule E-ready tax report for your accountant.',
    h1: 'Know what every unit makes.',
    sub: 'Income, costs and profit for each rental. At tax time, send your accountant a Schedule E-ready report in one tap.',
    img: ['q-hero', 1672, 941, '50% 50%', 'Local pros from many trades, each wearing a NOHM patch, gathered in front of their work trucks'],
    cards: [
      ['Profit per unit.', 'Income, costs and profit for every rental, and costs shared across rentals.'],
      ['Receipts on every entry.', 'Attach the receipt, and recurring costs post themselves.'],
      ['Schedule E, sorted.', 'Every entry in IRS Schedule E categories.'],
      ['Year-end, done.', 'A tax report as PDF and CSV, emailed straight to your accountant.'],
    ],
    price: 'books',
  },
  {
    slug: 'autopilot',
    title: 'NOHM Autopilot: Hands-Off Rental Management | NOHM',
    desc: 'NOHM Autopilot answers tenant messages, books repairs, reviews every estimate and brings you the decisions that are yours. Emergencies go straight to you.',
    h1: 'Hands off. Still in charge.',
    sub: 'Write a few house notes and NOHM Autopilot takes it from there.',
    img: ['door', 1536, 864, '60% 30%', 'A NOHM pro walking up to a rental’s front door'],
    cards: [
      ['Tenants, answered.', 'It answers tenant messages from your house notes.'],
      ['Repairs, booked.', 'It books repairs within the limit you set and reviews every estimate.'],
      ['Your calls stay yours.', 'It brings you the decisions that are yours to make.'],
      ['Emergencies go to you.', 'Fire, gas or water go straight to you, every time.'],
    ],
    specsTitle: 'You stay in the loop.',
    specs: [
      ['Activity log', 'Everything it did, when'],
      ['Weekly summary', 'The week on your rentals, in one read'],
      ['After move-out', 'It relists the unit'],
    ],
    price: 'autopilot',
  },
];

const LANDLORD_LABEL = {
  'rent-collection': ['Rent collection', 'Paid by bank, straight to you'],
  'tenant-screening': ['Tenant screening', 'No fake paperwork'],
  'lease-signing': ['Leases and move-ins', 'E-sign and condition reports'],
  'rental-listings': ['Rental listings', 'Free, with unlimited applications'],
  maintenance: ['Maintenance', 'Requests, pros and receipts'],
  accounting: ['Accounting and taxes', 'Profit per unit, Schedule E'],
  autopilot: ['NOHM Autopilot', 'Hands off, still in charge'],
};

// ── Shared pieces ─────────────────────────────────────────────────

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Copy in this file is written with real characters; HTML gets entities.
const text = (s) => s.replace(/&(?![a-z#0-9]+;)/g, '&amp;').replace(/’/g, '&rsquo;');
const titleCase = (s) => s.replace(/\b(?!and\b)[a-z]/g, (c) => c.toUpperCase());
const attr = (s) => esc(s).replace(/’/g, '&rsquo;');

const BADGES = (dark) => `<div class="store-cta${dark ? ' store-cta--center store-cta--on-dark' : ''}">
            <ul class="store-cta__badges">
              <li><a class="store-badge store-badge--app-store" href="https://apps.apple.com/us/app/nohm-app/id6761128513" aria-label="Download NOHM on the App Store"><img src="/img/badges/app-store.svg" width="144" height="48" alt="" /></a></li>
              <li><a class="store-badge store-badge--google-play" href="https://play.google.com/store/apps/details?id=com.nohm.app" aria-label="Get NOHM on Google Play"><img src="/img/badges/google-play.png" width="161" height="48" alt="" /></a></li>
            </ul>
          </div>`;

const FOOTER = `  <footer>
    <span>NOHM&trade; &copy; 2026</span>
    <a href="/homeowners">Homeowners</a>
    <a href="/landlords">Landlords</a>
    <a href="/renters">Renters</a>
    <a href="/local-pros">Local Pros</a>
    <a href="/pros">For Pros</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="/support">Support</a>
    <a href="tel:+18882306646">888-230-NOHM</a>
  </footer>`;

function page({ url, title, desc, ogImage, ogAlt, ld, body, scripts }) {
  const t = text(title);
  const d = text(desc);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <!-- Built by tools/seo/build.mjs: change it there, then run it. -->
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <link rel="canonical" href="${HOST}${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="NOHM" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:url" content="${HOST}${url}" />
  <meta property="og:image" content="${HOST}${ogImage}" />
  <meta property="og:image:alt" content="${attr(ogAlt)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="theme-color" content="#ffffff" />
  <link rel="icon" href="/favicon.ico?v=2" sizes="48x48" />
  <link rel="icon" type="image/png" href="/favicon-192.png" sizes="192x192" />
  <link rel="icon" type="image/png" href="/favicon-512.png" sizes="512x512" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preload" href="/fonts/sora/sora-latin-700-800.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/fonts/manrope/manrope-latin-400-700.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/type.css" />
  <link rel="stylesheet" href="/bar.css" />
  <link rel="stylesheet" href="/screens.css" />
  <link rel="stylesheet" href="/store-cta.css" />
  <link rel="stylesheet" href="/for/for.css" />
  <link rel="stylesheet" href="/topic.css" />
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
  <header class="bar"><a href="/">NOHM</a></header>
  <main>
${body}
  </main>
${FOOTER}
${scripts.map((s) => `  <script src="${s}" defer></script>`).join('\n')}
  <script src="/menu.js" defer></script>
</body>
</html>
`;
}

const crumbs = (trail) =>
  `<p class="crumbs">${trail.map(([href, name]) => (href ? `<a href="${href}">${text(name)}</a>` : text(name))).join('<span aria-hidden="true">/</span>')}</p>`;

const breadcrumbLd = (trail, url) => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map(([href, name], i) => ({ '@type': 'ListItem', position: i + 1, name, item: HOST + (href || url) })),
});

const ORG = { '@type': 'Organization', '@id': `${HOST}/#org`, name: 'NOHM', url: `${HOST}/` };

function opening({ trail, h1, soon, sub, actions, shot }) {
  return `    <section class="opening">
      <div class="copy">
        ${crumbs(trail)}
        <h1>${text(h1)}${soon ? `<span class="soon" data-feature-off="${soon}">Coming soon</span>` : ''}</h1>
        <p class="sub">${text(sub)}</p>
        <div class="actions">
          ${actions}
        </div>
      </div>
      <div class="shot">${shot}</div>
    </section>`;
}

const photo = (src, w, h, pos, alt) =>
  `<img src="${src}" width="${w}" height="${h}" fetchpriority="high" alt="${attr(alt)}"${pos ? ` style="object-position: ${pos}"` : ''} />`;

function servicePhoto(s, alt) {
  const pos = s.pos ? ` style="object-position: ${s.pos}"` : '';
  const img = `<img src="/img/services/${s.slug}.jpg" fetchpriority="high" alt="${attr(alt)}"${pos} />`;
  if (!s.video) return img;
  return `${img}<video autoplay muted loop playsinline preload="metadata" poster="/img/services/${s.slug}.jpg" aria-hidden="true"${pos}><source src="/video/${s.slug}-720.mp4" type="video/mp4" /><source src="/video/${s.slug}-720.webm" type="video/webm" /></video>`;
}

const cards = (list) => `      <ul class="reasons">
${list.map(([h, p]) => `        <li>
          <h3>${text(h)}</h3>
          <p>${text(p)}</p>
        </li>`).join('\n')}
      </ul>`;

const specs = (list) => `      <ul class="specs">
${list.map(([b, s]) => `        <li><b>${text(b)}</b><span>${text(s)}</span></li>`).join('\n')}
      </ul>`;

const steps = (list) => `      <ol class="steps">
${list.map(([b, s]) => `        <li><div><b>${text(b)}</b><span>${text(s)}</span></div></li>`).join('\n')}
      </ol>`;

const section = (h2, inner, lede) => `    <section class="sec wrap">
      <h2>${text(h2)}</h2>
${lede ? `      <p class="lede">${text(lede)}</p>\n` : ''}${inner}
    </section>`;

const more = (h2, list) => section(h2, `      <ul class="more">
${list.map(([href, name, line]) => `        <li><a href="${href}">${text(name)}<span>${text(line)}</span></a></li>`).join('\n')}
      </ul>`);

const final = (h2, p, actions) => `    <section class="final">
      <h2>${text(h2)}</h2>
      <p>${text(p)}</p>
      <div class="actions">
        ${actions}
      </div>
    </section>`;

// The three speeds, as the homeowner pages say them; fees from /pricing.js.
const SPEEDS = `      <ul class="plans plans--3">
        <li class="plan">
          <p class="name">Standard</p>
          <p class="price">$0</p>
          <p class="per">NOHM fee</p>
          <p>A local pro in a day or two.</p>
        </li>
        <li class="plan plan--lead">
          <p class="name">Express</p>
          <p class="price"><s data-fee-regular="express" hidden>$40</s><span data-fee="express">$20</span></p>
          <p class="per">NOHM fee</p>
          <p>The same day.</p>
        </li>
        <li class="plan">
          <p class="name">NOHM NOW</p>
          <p class="price"><s data-fee-regular="now" hidden>$60</s><span data-fee="now">$30</span></p>
          <p class="per">NOHM fee</p>
          <p>Within 60 minutes of booking.</p>
        </li>
      </ul>
      <p class="fine">Plus the pro&rsquo;s own charges, which you see and approve. Express and NOHM NOW need a pro who&rsquo;s ready near you.</p>`;

const COVERAGE = 'NOHM is available wherever local pros have joined, and grows as more pros sign on.';

// ── Pages ─────────────────────────────────────────────────────────

function servicePage(s) {
  const url = `/services/${s.slug}/`;
  const trail = [['/', 'Home'], ['/services/', 'All Services'], [null, s.label]];
  const lower = s.blurb.toLowerCase();
  const desc = `${s.h1.replace(/\.$/, '')}: ${lower}. A local pro who meets the NOHM Standard, in a day or two with no NOHM fee, the same day, or within the hour.`;
  const bookBtn = s.book ? `<a class="btn" href="/book?trade=${s.slug}">Book ${text(s.who)}</a>` : '';
  const actions = s.book ? `${bookBtn}\n          ${BADGES(false)}` : BADGES(false);
  const issues = ISSUES[s.name].map((i) => [i.title, i.description]);
  const body = [
    opening({
      trail,
      h1: s.h1,
      sub: `${s.blurb}. Tell NOHM what’s wrong and a local pro who meets the NOHM Standard takes the job.`,
      actions,
      shot: servicePhoto(s, `${s.label} on NOHM`),
    }),
    section(`What ${s.who} can handle.`, specs(issues)),
    section('Pick your speed.', SPEEDS),
    section('Three steps. Done.', steps([
      ['Tell NOHM what’s wrong.', `Pick ${s.label === 'HVAC' ? 'HVAC' : s.label.toLowerCase()}, add a photo and a few words.`],
      ['A local pro accepts.', 'See who’s coming and track them on the way.'],
      ['Handled and saved.', 'Pay in the app, and the work is saved to your home’s record.'],
    ])),
    section('Why NOHM.', cards([
      ['Local pros.', 'Independent, owner-operated local businesses.'],
      ['One standard.', 'Every pro is held to the NOHM Standard.'],
      ['Free to use.', 'Standard has no NOHM fee. Pay only for speed.'],
      ['Every repair, saved.', 'Your home keeps its own history of the work.'],
    ]) + `\n      <p class="note">${text(COVERAGE)}</p>`),
    more('Other services.', SERVICES.filter((o) => o !== s).map((o) => [`/services/${o.slug}/`, o.label, o.blurb])),
    final('It’s always something. NOHM it.', s.book ? `Book ${s.who} on the web, or get the app.` : `Book ${s.who} in the NOHM app.`,
      s.book ? `<a class="btn btn--light" href="/book?trade=${s.slug}">Book now</a>\n        ${BADGES(true)}` : BADGES(true)),
  ].join('\n\n');
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Service', name: s.label, serviceType: s.label, description: `${s.blurb}.`, provider: ORG, url: HOST + url },
      breadcrumbLd(trail, url),
    ],
  };
  return [url, page({ url, title: `${s.search} | NOHM`, desc, ogImage: '/img/crew-1672.jpg', ogAlt: 'Local pros on NOHM', ld, body, scripts: ['/pricing.js'] })];
}

function proPage(s) {
  const url = `/pros/${s.slug}/`;
  const trail = [['/', 'Home'], ['/pros/', 'For Pros'], [null, s.label]];
  const Jobs = s.jobs[0].toUpperCase() + s.jobs.slice(1);
  const h1 = `More ${s.jobs}. No lead fees.`;
  const desc = `Get ${s.jobs} from local homeowners and landlords on NOHM: ${s.blurb.toLowerCase()}. No lead fees, no monthly fee: 7.9% only when you get paid.`;
  const quotes = QUOTES[s.name];
  const reasons = [
    ['No lead fees. No ads.', 'A lead is the hope of a job. On NOHM, one request goes to one pro, and NOHM only earns when you get paid.'],
    ['Jobs come to you.', 'Real requests from homeowners and landlords near you: booked, scheduled and same-day.'],
    ['Go live. Get NOW jobs.', 'Turn on Ready Now for four hours and take NOHM NOW calls when you have a gap.'],
    ['Paid through Stripe.', 'Payouts go straight to your bank. Tips are 100% yours.'],
    ['Your business, your way.', 'Your schedule, your rates, your team. NOHM handles the booking and the payment.'],
  ];
  if (quotes) reasons.splice(3, 0, ['Win the big ones.', `Quote replacements of ${quotes} with Three Quotes. You set the full price, and pay <span data-rate="threeQuotesFeeRate">5%</span> only on jobs you win.`]);
  const body = [
    opening({
      trail,
      h1,
      sub: `Local homeowners and landlords book ${s.who.replace(/^an? /, '')}s on NOHM. Free to join. Pay only when you get paid.`.replace(/handymans/, 'handymen'),
      actions: `<a class="btn" href="/join">Join as a pro</a>\n          ${BADGES(false)}`,
      shot: servicePhoto(s, `${s.label} pro on NOHM`),
    }),
    section(`${Jobs} on NOHM.`, specs(ISSUES[s.name].map((i) => [i.title, i.description])), 'What homeowners and landlords ask for.'),
    section('Built for pros.', cards(reasons)),
    section('Free to join. Pay only when you get paid.', `      <ul class="plans plans--2">
        <li class="plan">
          <p class="name">To join</p>
          <p class="price">$0</p>
          <p class="per">no lead fees, no monthly fee</p>
          <p>Sign up, pick your trades and get approved.</p>
        </li>
        <li class="plan plan--lead">
          <p class="name">Per job</p>
          <p class="price"><span data-rate="platformFeeRate">7.9%</span></p>
          <p class="per">of what you&rsquo;re paid</p>
          <p>Only on jobs you complete. Card processing is its own line, and tips are 100% yours.</p>
        </li>
      </ul>${quotes ? '\n      <p class="fine">Three Quotes jobs: a <span data-rate="threeQuotesFeeRate">5%</span> service fee on jobs you win, deducted from your funds, never added to the homeowner&rsquo;s price.</p>' : ''}`),
    section('Get on NOHM.', steps([
      ['Sign up and pick your trades.', 'On the web or in the app, in a few minutes.'],
      ['Add your license, insurance and payouts.', 'Snap your documents and connect your bank through Stripe.'],
      ['Agree to the NOHM Standard.', 'Get approved, and start taking jobs.'],
    ]) + `\n      <p class="note">${text(COVERAGE)}</p>`),
    more('Other trades.', SERVICES.filter((o) => o !== s).map((o) => [`/pros/${o.slug}/`, o.label, `${o.jobs[0].toUpperCase()}${o.jobs.slice(1)}`])),
    final('Your next job is on NOHM.', 'Free to join. Pay only when you get paid.', `<a class="btn btn--light" href="/join">Join as a pro</a>\n        ${BADGES(true)}`),
  ].join('\n\n');
  const ld = { '@context': 'https://schema.org', '@graph': [breadcrumbLd(trail, url)] };
  return [url, page({ url, title: `${titleCase(s.jobs)} for Pros, No Lead Fees | NOHM`, desc, ogImage: '/img/crew-1672.jpg', ogAlt: 'Local pros on NOHM', ld, body, scripts: ['/for/live.js'] })];
}

function landlordPage(t) {
  const url = `/landlords/${t.slug}/`;
  const [label] = LANDLORD_LABEL[t.slug];
  const trail = [['/', 'Home'], ['/landlords/', 'Landlords'], [null, label]];
  const [img, w, h, pos, alt] = t.img;
  const parts = [
    opening({
      trail,
      h1: t.h1,
      soon: t.soon,
      sub: t.sub,
      actions: `${BADGES(false)}\n          <a class="textlink" href="https://business.nohm.app/">Sign in on the web</a>`,
      shot: photo(`/img/${img}-960.jpg`, w, h, pos, alt),
    }),
    section('What you get.', cards(t.cards)),
  ];
  if (t.steps) parts.push(section('How it works.', steps(t.steps) + `\n      <p class="fine">The <span data-rental="application">$50</span> applies only where state and local law allow it; NOHM applies the limit before checkout. NOHM never asks for W-2s or bank statements.</p>`));
  if (t.specs) parts.push(section(t.specsTitle, specs(t.specs)));
  if (t.specsLede) parts.push(`    <section class="sec wrap">
      <h2>${text(t.specsTitle)}</h2>
      <p class="lede">${text(t.specsLede)}</p>
    </section>`);
  if (t.speeds) parts.push(section(t.specsTitle, SPEEDS));
  if (t.price === 'rent' || t.price === 'books') {
    parts.push(section('Free until you collect rent.', `      <ul class="plans plans--2">
        <li class="plan">
          <p class="name">Free</p>
          <p class="price"><span data-rental="free">$0</span></p>
          <p class="per">forever</p>
          <p>Listings, unlimited applications, tenant invites, repair requests and messages.</p>
        </li>
        <li class="plan plan--lead">
          <p class="name">Financial Management</p>
          <p class="price"><span data-rental="plan">$7</span></p>
          <p class="per">per rental, per month, only on rentals you enroll</p>
          <p>Rent collection, autopay, reminders, late fees, ledgers and reports.</p>
        </li>
      </ul>
      <p class="fine">Each bank rent payment carries a <span data-rental="achFee">$7</span> processing fee, and you choose whether the tenant pays it or you absorb it. NOHM takes no cut of rent. <a href="/landlords/">See every plan</a>.</p>`));
  }
  if (t.price === 'autopilot') {
    parts.push(section('One price per rental.', `      <ul class="plans plans--2">
        <li class="plan plan--lead">
          <p class="name">NOHM Autopilot</p>
          <p class="price"><span data-rental="autopilot">$19.99</span></p>
          <p class="per">per rental, per month</p>
          <p>Everything in Financial Management, plus Autopilot on that rental.</p>
        </li>
        <li class="plan">
          <p class="name">Free</p>
          <p class="price"><span data-rental="free">$0</span></p>
          <p class="per">every other rental</p>
          <p>Turn Autopilot on only for the units you want handled.</p>
        </li>
      </ul>`));
  }
  parts.push(more('Everything else for landlords.', LANDLORD.filter((o) => o !== t).map((o) => [`/landlords/${o.slug}/`, ...LANDLORD_LABEL[o.slug]])));
  parts.push(final('Got rentals? NOHM it.', 'Free to use. Pay only when you collect rent.', `${BADGES(true)}\n        <a class="textlink" href="https://business.nohm.app/" style="color:#fff">Sign in on the web</a>`));
  const ld = { '@context': 'https://schema.org', '@graph': [breadcrumbLd(trail, url)] };
  const scripts = ['/pricing.js'];
  if (t.soon) scripts.push('/for/live.js');
  return [url, page({ url, title: t.title, desc: t.desc, ogImage: `/img/${img}-960.jpg`, ogAlt: alt, ld, body: parts.join('\n\n'), scripts })];
}

function readyNowPage() {
  const url = '/pros/ready-now/';
  const trail = [['/', 'Home'], ['/pros/', 'For Pros'], [null, 'Ready Now']];
  const body = [
    opening({
      trail,
      h1: 'Go live. Get NOW jobs.',
      sub: 'Got a gap in your day? Turn on Ready Now for four hours and take NOHM NOW calls from homeowners nearby.',
      actions: `<a class="btn" href="/join">Join as a pro</a>\n          ${BADGES(false)}`,
      shot: photo('/img/pro-now-720.jpg', 720, 405, '50% 40%', 'A NOHM pro heading out to a NOHM NOW job'),
    }),
    section('How Ready Now works.', steps([
      ['Turn on Ready Now.', 'You’re live for four hours, ready to leave right away.'],
      ['Take a NOHM NOW call.', 'Homeowners who need it within the hour book the pros who are live.'],
      ['Be there within 60 minutes.', 'NOHM NOW is within 60 minutes of being booked. Paid through Stripe.'],
    ])),
    section('Built for pros.', cards([
      ['No lead fees. No ads.', 'A lead is the hope of a job. On NOHM, one request goes to one pro, and NOHM only earns when you get paid.'],
      ['Your schedule.', 'Go live when you have the time. Nobody books you when you’re not.'],
      ['Paid through Stripe.', 'Payouts go straight to your bank. Tips are 100% yours.'],
      ['One standard.', 'Every pro on NOHM is held to the NOHM Standard.'],
    ]) + `\n      <p class="note">${text(COVERAGE)}</p>`),
    more('Find your trade.', SERVICES.map((o) => [`/pros/${o.slug}/`, o.label, `${o.jobs[0].toUpperCase()}${o.jobs.slice(1)}`])),
    final('Your next job is on NOHM.', 'Free to join. Pay only when you get paid.', `<a class="btn btn--light" href="/join">Join as a pro</a>\n        ${BADGES(true)}`),
  ].join('\n\n');
  const ld = { '@context': 'https://schema.org', '@graph': [breadcrumbLd(trail, url)] };
  return [url, page({ url, title: 'Same-Day Home Repair Jobs for Pros: Ready Now | NOHM', desc: 'Turn on Ready Now for four hours and take NOHM NOW calls from homeowners nearby: within 60 minutes of being booked. No lead fees. Free to join.', ogImage: '/img/pro-now-1122.jpg', ogAlt: 'A NOHM pro heading out to a NOHM NOW job', ld, body, scripts: [] })];
}

// The links each hub page carries to its topic pages, between markers.
const HUBS = {
  'services/index.html': ['Every service, up close.', SERVICES.map((s) => [`/services/${s.slug}/`, s.label, s.blurb])],
  'pros/index.html': ['Find your trade.', [...SERVICES.map((s) => [`/pros/${s.slug}/`, s.label, `${s.jobs[0].toUpperCase()}${s.jobs.slice(1)}`]), ['/pros/ready-now/', 'Ready Now', 'Same-day NOHM NOW jobs']]],
  'landlords/index.html': ['Go deeper.', LANDLORD.map((t) => [`/landlords/${t.slug}/`, ...LANDLORD_LABEL[t.slug]])],
};
const START = '<!-- topics: built by tools/seo/build.mjs -->';
const END = '<!-- /topics -->';

function hub(s, [h2, list]) {
  const block = `${START}
    <section class="topics" aria-label="${attr(h2.replace(/\.$/, ''))}">
      <h2>${text(h2)}</h2>
      <ul class="more">
${list.map(([href, name, line]) => `        <li><a href="${href}">${text(name)}<span>${text(line)}</span></a></li>`).join('\n')}
      </ul>
    </section>
    ${END}`;
  if (s.includes(START)) return s.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  // First time: just before the page's closing section, and topic.css in the head.
  const at = s.lastIndexOf('    <section class="end">') >= 0 ? s.lastIndexOf('    <section class="end">') : s.lastIndexOf('    <section class="join"');
  if (at < 0) throw new Error('no place for the topics');
  s = s.slice(0, at) + '    ' + block + '\n\n' + s.slice(at);
  return s.includes('/topic.css') ? s : s.replace('</head>', '  <link rel="stylesheet" href="/topic.css" />\n</head>');
}

export function build() {
  const out = new Map();
  for (const s of SERVICES) out.set(...servicePage(s));
  for (const s of SERVICES) out.set(...proPage(s));
  for (const t of LANDLORD) out.set(...landlordPage(t));
  out.set(...readyNowPage());
  const files = new Map([...out].map(([url, html]) => [path.join(ROOT, url, 'index.html'), html]));
  for (const [rel, h] of Object.entries(HUBS)) {
    const f = path.join(ROOT, rel);
    files.set(f, hub(fs.readFileSync(f, 'utf8'), h));
  }
  // The sitemap lists every topic page between its markers.
  const sm = path.join(ROOT, 'sitemap.xml');
  const urls = [...out.keys()].map((u) => `  <url><loc>${HOST}${u}</loc></url>`).join('\n');
  const SM_START = '  <!-- topics: tools/seo/build.mjs -->';
  const SM_END = '  <!-- /topics -->';
  let x = fs.readFileSync(sm, 'utf8');
  const block = `${SM_START}\n${urls}\n${SM_END}`;
  x = x.includes(SM_START) ? x.replace(new RegExp(`${SM_START}[\\s\\S]*?${SM_END}`), block) : x.replace('</urlset>', `${block}\n</urlset>`);
  files.set(sm, x);
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let n = 0;
  for (const [f, html] of build()) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== html) {
      fs.writeFileSync(f, html);
      n++;
    }
  }
  console.log(`${n} file(s) written`);
}
