// Builds the topic pages: one page per subject for the people who search
// for it, nationwide (never a town: NOHM is wherever local pros have
// joined).
//
//   /services/<trade>/   homeowners booking that trade
//   /pros/<trade>/       pros of that trade looking for jobs
//   /landlords/<topic>/  one landlord job: rent, screening, leases, ...
//   /pros/ready-now/     on-demand work for pros
//   /landlords/forms/    landlord forms and notices, state by state, from
//                        the app's own catalog (legal-forms.json)
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
    desc: 'Collect rent online by bank transfer, straight to your own account. Autopay, reminders and late fees run themselves. Free for the first 10,000 landlords: no plan, no monthly fee.',
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
      ['Income, from the bank.', 'The optional NOHM Income Check reads income from the applicant’s own bank through Plaid. Free for Founding Partners.'],
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
    <span class="eho" style="display:inline-flex;align-items:center;gap:6px"><svg viewBox="0 0 100 84" width="21" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M50 0 100 30v10l-8-5v49H8V35l-8 5V30zm0 11L16 31.5V76h68V31.5zM34.5 40h31v9h-31zm0 15h31v9h-31z"/></svg>Equal Housing Opportunity</span>
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

function page({ url, title, desc, ogImage, ogAlt, ld, body, scripts, styles = [] }) {
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
${styles.map((h) => `  <link rel="stylesheet" href="${h}" />\n`).join('')}  <script type="application/ld+json">${JSON.stringify(ld)}</script>
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

// The three speeds, as the homeowner pages say them; fees from /pricing.js,
// one price each (owner, 2026-10-29: "make now permantly 60 for 60 no
// discounts now its confusing and also express is 30 now standard is 48
// hours out no sooner no matter what").
const SPEEDS = `      <ul class="plans plans--3">
        <li class="plan">
          <p class="name">Standard</p>
          <p class="price">$0</p>
          <p class="per">NOHM fee</p>
          <p>A local pro 48 hours or more after you book, never sooner.</p>
        </li>
        <li class="plan plan--lead">
          <p class="name">Express</p>
          <p class="price"><span data-fee="express">$30</span></p>
          <p class="per">NOHM fee</p>
          <p>A pro today.</p>
        </li>
        <li class="plan">
          <p class="name">NOHM NOW</p>
          <p class="price"><span data-fee="now">$60</span></p>
          <p class="per">NOHM fee</p>
          <p>60 for 60: a pro at your door within 60 minutes of booking, or you don&rsquo;t pay the NOW fee.</p>
        </li>
      </ul>
      <p class="fine">Plus the pro&rsquo;s own charges, which you see and approve. Express and NOHM NOW need a pro who&rsquo;s ready near you.</p>`;

const COVERAGE = 'NOHM is available wherever local pros have joined, and grows as more pros sign on.';

// ── Pages ─────────────────────────────────────────────────────────

function servicePage(s) {
  const url = `/services/${s.slug}/`;
  const trail = [['/', 'Home'], ['/services/', 'All Services'], [null, s.label]];
  const lower = s.blurb.toLowerCase();
  const desc = `${s.h1.replace(/\.$/, '')}: ${lower}. A local pro who meets the NOHM Standard. No NOHM fee 48 hours or more out, Express for a pro today, or NOHM NOW: 60 for 60.`;
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
  // Free for NOHM Founding Partners, the first 10,000 landlords (owner,
  // 2026-10-29), and how: the tenant's bank fee and the application, as
  // /landlords says it. Never a count of who's left.
  const FOUNDERS = 'For the first 10,000 landlords: NOHM Founding Partners. Your rentals are free for good.';
  if (t.price === 'rent' || t.price === 'books') {
    parts.push(section('Free for Founding Partners.', `      <ul class="plans plans--2">
        <li class="plan plan--lead">
          <p class="name">You pay</p>
          <p class="price"><span data-rental="free">$0</span></p>
          <p class="per">for every rental, for good</p>
          <p>Rent collection, autopay, reminders, late fees, the books and reports. No plan, no monthly fee.</p>
        </li>
        <li class="plan">
          <p class="name">Your tenant pays</p>
          <p class="price"><span data-rental="achFee">$7</span></p>
          <p class="per">when they pay rent by bank (or you can cover it for them)</p>
          <p>About $5 of it is the bank processor&rsquo;s cost. NOHM keeps about $2.</p>
        </li>
      </ul>
      <p class="fine">NOHM takes no cut of rent. No spam. No ads. <a href="/landlords/">How NOHM is free</a>.</p>`, FOUNDERS));
  }
  // NOHM Autopilot is optional and priced per rental for everyone, Founding
  // Partners included (owner, 2026-10-29: "Wait Nohm autopilot cost still
  // ok"), set against a property manager's cut; the price and its share of
  // a $1,500 rent come from /pricing.js.
  if (t.price === 'autopilot') {
    parts.push(section('One price per rental.', `      <ul class="plans plans--2">
        <li class="plan plan--lead">
          <p class="name">NOHM Autopilot</p>
          <p class="price"><span data-rental="autopilot">$19.99</span></p>
          <p class="per">a month per rental, on the rentals you choose</p>
          <p>Optional, and it runs the rental for you.</p>
        </li>
        <li class="plan">
          <p class="name">Everything else</p>
          <p class="price"><span data-rental="free">$0</span></p>
          <p class="per">for every rental, for good</p>
          <p>Listings, leases, repairs, rent collection and the books, for NOHM Founding Partners: the first 10,000 landlords. No plan, no monthly fee.</p>
        </li>
      </ul>
      <p class="pm-line">A property manager takes about 10% of the rent: $150 a month on a $1,500 home. Autopilot is <span data-rental="autopilot">$19.99</span>, about <span data-rental-share="autopilot" data-share-of="1500">1.3%</span>.</p>
      <p class="fine">No spam. No ads. <a href="/landlords/">How NOHM is free</a>.</p>`));
  }
  parts.push(more('Everything else for landlords.', [...LANDLORD.filter((o) => o !== t).map((o) => [`/landlords/${o.slug}/`, ...LANDLORD_LABEL[o.slug]]), FORMS_LINK]));
  parts.push(final('Got rentals? NOHM it.', 'Free for the first 10,000 landlords. No spam. No ads. Nothing.', `${BADGES(true)}\n        <a class="textlink" href="https://business.nohm.app/" style="color:#fff">Sign in on the web</a>`));
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
      ['Be there within 60 minutes.', 'NOHM NOW is 60 for 60: the clock starts when you&rsquo;re booked. Paid through Stripe.'],
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


// ── Landlord forms, state by state ────────────────────────────────
// Owner, 2026-11-07, on how landlords find NOHM: a free page for each
// state's notices and forms ("Yes do that"), with search first ("Make sure
// SEO is paramount"). Three layers, each for what landlords type:
//   /landlords/forms/                      eviction notices and forms by state
//   /landlords/forms/<state>/              one state's forms ("arkansas eviction notice")
//   /landlords/forms/<state>/<form>/       one form ("arkansas 3 day notice to quit")
//   /landlords/forms/<type>/               one kind of form, state by state
//                                          ("late rent notice by state")
// The forms, their words and statutes are the app's own (legal-forms.json,
// a copy of the server's catalog; tools/seo/export-legal-forms.md). A page
// never says a lawyer reviewed a form, and always says it isn't legal advice.
const FORMS_DATA = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'legal-forms.json'), 'utf8'));
const FORMS = FORMS_DATA.states;
const FORMS_UPDATED = FORMS_DATA._exported;
const FORMS_LINK = ['/landlords/forms/', 'Legal forms', 'Eviction notices and forms by state'];
const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const stateUrl = (st) => `/landlords/forms/${slugOf(st.name)}/`;
const formUrl = (st, f) => `${stateUrl(st)}${slugOf(f.label)}/`;
const html = (s) => esc(s).replace(/’/g, '&rsquo;');
const formId = (key) => key.toLowerCase().replace(/_/g, '-');
const FORMS_OG = ['/img/landlord-960.jpg', 'A landlord with a clipboard shaking hands with her new tenants in the kitchen of a rental'];
const NOT_ADVICE = 'Not legal advice. NOHM isn’t a law firm. These forms are built from each state’s statutes as NOHM read them. Laws change, and cities and counties can add their own rules, so check the law under each form, or ask a local lawyer, before you serve one. Use them at your own risk.';
const FILLED = [
  ['Pick the state and the form.', 'Notices, move-in and move-out forms, and court papers, in the order you’d use them.'],
  ['NOHM fills it in from the lease.', 'Names, the address, the rent and the dates come from the lease in NOHM.'],
  ['Type in the blue boxes.', 'Add what the lease can’t know, then print, download or share it.'],
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const updatedOn = (() => { const [y, m, d] = FORMS_UPDATED.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; })();
// "3-day notice to quit" → "3-Day Notice to Quit", for titles.
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
const titled = (s) => s.split(' ').map((w, i) => w.split('-').map((p, k) => (i > 0 && k === 0 && SMALL.has(p.toLowerCase()) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('-')).join(' ');
// A form's name inside a sentence: "Notice of entry" → "notice of entry",
// never an acronym ("UD-100" stays).
const inline = (s) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
// A description cut at a word, under Google's ~160 characters.
const clip = (s, n = 158) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,:;]$/, '') + '…');

// The kinds of form landlords search for across states. Arkansas, the
// first state built, has its own key for some of them (`ar`), matched in
// Arkansas only: another state's form under that key is another notice.
const FORM_TYPES = [
  { slug: 'late-rent-notice', keys: ['NOTICE_RENT'], ar: 'NOTICE_TO_QUIT', name: 'Late rent notice', the: 'late rent notice', title: 'Late Rent Notice by State: Pay or Quit Rules | NOHM', h1: 'Late rent notices, state by state.', lead: 'The written notice for unpaid rent, in each state: what it’s called, when you can serve it, and the law behind it.' },
  { slug: 'lease-violation-notice', keys: ['NOTICE_LEASE_VIOLATION'], ar: 'NOTICE_OF_NONCOMPLIANCE', name: 'Lease violation notice', the: 'lease violation notice', title: 'Lease Violation Notice by State | NOHM', h1: 'Lease violation notices, state by state.', lead: 'The notice for a tenant who broke the lease (other than rent), in each state: what it’s called, when you can serve it, and the law.' },
  { slug: 'notice-to-end-tenancy', keys: ['NOTICE_END_TENANCY'], ar: 'NOTICE_OF_TERMINATION', name: 'Notice to end a tenancy', the: 'notice to end a tenancy', title: 'Notice to End a Tenancy by State (Notice to Vacate) | NOHM', h1: 'Notices to end a tenancy, state by state.', lead: 'The notice that ends a month-to-month or other periodic tenancy, in each state: how much notice, when, and the law.' },
  { slug: 'notice-of-entry', keys: ['NOTICE_OF_ENTRY'], name: 'Notice of entry', the: 'notice of entry', title: 'Landlord Notice of Entry by State | NOHM', h1: 'Landlord notice of entry, state by state.', lead: 'Telling a tenant you’re coming in, in each state: how much notice, when, and the law.' },
  { slug: 'rent-increase-notice', keys: ['NOTICE_OF_RENT_CHANGE'], name: 'Rent increase notice', the: 'rent increase notice', title: 'Rent Increase Notice by State | NOHM', h1: 'Rent increase notices, state by state.', lead: 'Telling a tenant the rent is changing, in each state: how much notice, when, and the law.' },
  { slug: 'security-deposit-itemization', keys: ['DEPOSIT_ITEMIZATION'], name: 'Security deposit itemization', the: 'security deposit itemization', title: 'Security Deposit Itemization by State: Deadlines | NOHM', h1: 'Security deposit itemization, state by state.', lead: 'The itemized list of deductions from a deposit, in each state: when it’s due back, and the law.' },
  { slug: 'move-in-checklist', keys: ['MOVE_IN_CHECKLIST'], ar: 'MOVE_IN_DEFECT_FORM', name: 'Move-in checklist', the: 'move-in checklist', title: 'Move-In Condition Checklist by State | NOHM', h1: 'Move-in condition checklists, state by state.', lead: 'The record of a rental’s condition when the tenant moves in, in each state: when to use it, and the law.' },
  { slug: 'abandoned-property-notice', keys: ['PROPERTY_LEFT_BEHIND'], name: 'Abandoned property notice', the: 'abandoned property notice', title: 'Abandoned Property Notice by State | NOHM', h1: 'Notices for property left behind, state by state.', lead: 'What to do with a tenant’s things left after move-out, in each state: the notice, how long to wait, and the law.' },
  { slug: 'eviction-filing', keys: ['EVICTION_FILING_WORKSHEET'], ar: 'UNLAWFUL_DETAINER_COMPLAINT', name: 'Eviction court forms', the: 'eviction court forms', title: 'Eviction Court Forms by State | NOHM', h1: 'Eviction court forms, state by state.', lead: 'The court papers to file for an eviction, in the states NOHM has them: what they are, when to file, and the law.' },
];
const isType = (t, st, f) => t.keys.includes(f.key) || (st.code === 'AR' && f.key === t.ar);
const typeOf = (st, f) => FORM_TYPES.find((t) => isType(t, st, f));
const rowsOf = (t) => FORMS.flatMap((st) => st.forms.filter((f) => isType(t, st, f)).map((f) => ({ st, f })));
const placeCount = (rows) => {
  const places = new Set(rows.map((r) => r.st.code));
  const dc = places.has('DC');
  const n = places.size - (dc ? 1 : 0);
  return n === 50 && dc ? 'all 50 states and DC' : `${n} states${dc ? ' and DC' : ''}`;
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function host(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; }
}
const readLaw = (f) => f.sources.map((u) => `<a href="${esc(u)}" rel="nofollow noopener" target="_blank">${esc(host(u))}</a>`).join(', ');
const GENERIC = 'The statute doesn’t set this notice’s exact words: check it before you serve one.';

// The opening of a forms page: words first, no photo (the answer above the
// fold), and when it was last brought up to date.
function textOpening({ trail, h1, sub, extra = '' }) {
  return `    <section class="opening opening--text">
      <div class="copy">
        ${crumbs(trail)}
        <h1>${html(h1)}</h1>
        <p class="sub">${html(sub)}</p>
        <p class="updated">Updated <time datetime="${FORMS_UPDATED}">${updatedOn}</time></p>${extra}
        <div class="actions">
          ${BADGES(false)}
          <a class="textlink" href="https://business.nohm.app/">Sign in on the web</a>
        </div>
      </div>
    </section>`;
}

const finalAsk = final('Got rentals? NOHM it.', 'Free for the first 10,000 landlords. No spam. No ads. Nothing.', `${BADGES(true)}\n        <a class="textlink" href="https://business.nohm.app/" style="color:#fff">Sign in on the web</a>`);
const fine = `    <section class="sec wrap">
      <p class="fine forms-fine">${html(NOT_ADVICE)}</p>
    </section>`;

function webPageLd({ url, title, desc, trail, extra = {} }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbLd(trail, url),
      {
        '@type': 'WebPage', '@id': `${HOST}${url}`, url: `${HOST}${url}`, name: title, description: desc,
        inLanguage: 'en-US', dateModified: FORMS_UPDATED, isPartOf: { '@type': 'WebSite', name: 'NOHM', url: `${HOST}/` },
        publisher: ORG, ...extra,
      },
    ],
  };
}

function formCard(st, f) {
  const law = f.citations.length ? `\n          <div><dt>The law</dt><dd>${f.citations.map(html).join('; ')}</dd></div>` : '';
  const notes = f.notes.length
    ? `\n        <details>\n          <summary>Good to know</summary>\n          <ul>\n${f.notes.map((n) => `            <li>${html(n)}</li>`).join('\n')}\n          </ul>\n        </details>`
    : '';
  const generic = f.generic ? `\n        <p class="form-check">${html(GENERIC)}</p>` : '';
  return `      <article class="form" id="${formId(f.key)}">
        <h3><a href="${formUrl(st, f)}">${html(f.label)}</a>${f.court ? ' <span class="form-tag">Court</span>' : ''}</h3>
        <p>${html(f.explain)}</p>
        <dl>
          <div><dt>When</dt><dd>${html(f.when)}</dd></div>${law}
        </dl>${generic}${notes}
        <p class="form-src"><a href="${formUrl(st, f)}">The ${html(inline(f.label))} in full</a> · Read the law: ${readLaw(f)}</p>
      </article>`;
}

function groupsOf(st) {
  const groups = [];
  for (const f of st.forms) {
    const g = groups.find((x) => x.label === f.groupLabel);
    if (g) g.forms.push(f); else groups.push({ label: f.groupLabel, forms: [f] });
  }
  return groups;
}

function formsStatePage(st) {
  const url = stateUrl(st);
  const trail = [['/', 'Home'], ['/landlords/', 'Landlords'], ['/landlords/forms/', 'Legal forms'], [null, st.name]];
  const groups = groupsOf(st);
  const named = st.forms.slice(0, 3).map((f) => inline(f.label)).join(', ');
  const title = `${st.name} Eviction Notices and Landlord Forms | NOHM`;
  const desc = clip(`${st.name} eviction notices and landlord forms: ${named}, and more. When to use each and the law. Filled in from your lease in NOHM.`);
  const body = [
    textOpening({
      trail,
      h1: `${st.name} eviction notices and landlord forms.`,
      sub: `${st.forms.length} notices and forms for a rental in ${st.name}: what each is for, when you can use it, and the law behind it.`,
    }),
    `    <section class="sec wrap forms-jump" aria-label="${attr(st.name)} forms">
      <ul class="forms-index">
${groups.map((g) => `        <li><b>${html(g.label)}</b>${g.forms.map((f) => `<a href="#${formId(f.key)}">${html(f.label)}</a>`).join('')}</li>`).join('\n')}
      </ul>
    </section>`,
    ...groups.map((g) => `    <section class="sec wrap forms-group">
      <h2>${html(g.label)}.</h2>
${g.forms.map((f) => formCard(st, f)).join('\n')}
    </section>`),
    section('Filled in for you.', steps(FILLED)),
    fine,
    more('More for landlords.', [['/landlords/forms/', 'Other states', 'Eviction notices and forms by state'], ...FORM_TYPES.slice(0, 3).map((t) => [`/landlords/forms/${t.slug}/`, `${t.name} by state`, cap(placeCount(rowsOf(t)))]), ...LANDLORD.slice(0, 3).map((o) => [`/landlords/${o.slug}/`, ...LANDLORD_LABEL[o.slug]])]),
    finalAsk,
  ].join('\n\n');
  const ld = webPageLd({ url, title, desc, trail, extra: { about: { '@type': 'AdministrativeArea', name: st.name } } });
  return [url, page({ url, title, desc, ogImage: FORMS_OG[0], ogAlt: FORMS_OG[1], ld, body, scripts: [], styles: ['/landlords/forms/forms.css'] })];
}

function formPage(st, f) {
  const url = formUrl(st, f);
  const label = inline(f.label);
  const trail = [['/', 'Home'], ['/landlords/', 'Landlords'], ['/landlords/forms/', 'Legal forms'], [stateUrl(st), st.name], [null, f.label]];
  // Under ~65 characters where it can be: a long court form's numbers
  // (in brackets) stay on the page, not in the title.
  const full = `${st.name} ${titled(f.label)} | NOHM`;
  const title = full.length <= 65 ? full : `${st.name} ${titled(f.label.replace(/\s*\([^)]*\d[^)]*\)/g, ''))} | NOHM`;
  const law = f.citations.length ? ` The law: ${f.citations[0]}.` : '';
  const desc = clip(`${st.name} ${label}: ${inline(f.explain)} When: ${inline(f.when)}${law}`);
  const t = typeOf(st, f);
  const others = t ? rowsOf(t).filter((r) => r.st !== st) : [];
  const siblings = st.forms.filter((x) => x !== f);
  const facts = [['When', f.when], ...(f.citations.length ? [['The law', f.citations.join('; ')]] : []), ['Stage', f.groupLabel], ...(f.court ? [['Kind', 'Court paper']] : [])];
  const body = [
    textOpening({ trail, h1: `${st.name} ${label}`, sub: f.explain }),
    section('The facts.', specs(facts)),
    f.notes.length ? section('What to know.', `      <ul class="form-notes">
${f.notes.map((n) => `        <li>${html(n)}</li>`).join('\n')}
      </ul>${f.generic ? `\n      <p class="form-check">${html(GENERIC)}</p>` : ''}`) : '',
    section('Read the law.', `      <p class="form-src form-src--page">${readLaw(f)}</p>`),
    section('Filled in for you.', steps(FILLED)),
    others.length ? `    <section class="sec wrap">
      <h2>The ${html(t.the)} in other states.</h2>
      <ul class="forms-index forms-states">
        <li>${others.map((r) => `<a href="${formUrl(r.st, r.f)}">${html(r.st.name)}</a>`).join('')}</li>
      </ul>
      <p class="note"><a href="/landlords/forms/${t.slug}/">Compare the ${html(t.the)} in ${placeCount(rowsOf(t))}</a></p>
    </section>` : '',
    more(`More ${st.name} forms.`, [...siblings.map((x) => [formUrl(st, x), x.label, x.groupLabel]), [stateUrl(st), `All ${st.name} forms`, `${st.forms.length} notices and forms`]]),
    fine,
    finalAsk,
  ].filter(Boolean).join('\n\n');
  const ld = webPageLd({ url, title, desc, trail, extra: { about: { '@type': 'Thing', name: `${st.name} ${f.label}` }, ...(f.citations.length ? { citation: f.citations } : {}) } });
  return [url, page({ url, title, desc, ogImage: FORMS_OG[0], ogAlt: FORMS_OG[1], ld, body, scripts: [], styles: ['/landlords/forms/forms.css'] })];
}

function formTypePage(t) {
  const url = `/landlords/forms/${t.slug}/`;
  const trail = [['/', 'Home'], ['/landlords/', 'Landlords'], ['/landlords/forms/', 'Legal forms'], [null, `${t.name} by state`]];
  const rows = rowsOf(t);
  const desc = clip(`${t.lead} ${cap(placeCount(rows))}, side by side. Filled in from your lease in NOHM.`);
  const body = [
    textOpening({ trail, h1: t.h1, sub: `${t.lead} ${cap(placeCount(rows))}.` }),
    `    <section class="sec wrap">
      <table class="ftable">
        <thead><tr><th scope="col">State</th><th scope="col">The form</th><th scope="col">When you can use it</th></tr></thead>
        <tbody>
${rows.map(({ st, f }) => `          <tr><th scope="row"><a href="${formUrl(st, f)}">${html(st.name)}</a></th><td>${html(f.label)}</td><td>${html(f.when)}</td></tr>`).join('\n')}
        </tbody>
      </table>
    </section>`,
    section('Filled in for you.', steps(FILLED)),
    fine,
    more('Other forms by state.', [...FORM_TYPES.filter((o) => o !== t).map((o) => [`/landlords/forms/${o.slug}/`, `${o.name} by state`, placeCount(rowsOf(o))]), ['/landlords/forms/', 'Every form, by state', 'Pick your state']]),
    finalAsk,
  ].join('\n\n');
  const ld = webPageLd({ url, title: t.title, desc, trail });
  return [url, page({ url, title: t.title, desc, ogImage: FORMS_OG[0], ogAlt: FORMS_OG[1], ld, body, scripts: [], styles: ['/landlords/forms/forms.css'] })];
}

function formsIndexPage() {
  const url = '/landlords/forms/';
  const trail = [['/', 'Home'], ['/landlords/', 'Landlords'], [null, 'Legal forms']];
  const count = FORMS.reduce((n, s) => n + s.forms.length, 0);
  const title = 'Eviction Notices and Landlord Forms by State | NOHM';
  const desc = 'Late rent notices, lease violation notices, notices to end a tenancy, deposit itemizations and court forms for all 50 states and DC, with the law. Free in NOHM.';
  const body = [
    textOpening({
      trail,
      h1: 'Eviction notices and landlord forms, state by state.',
      sub: `${count} notices and forms for all 50 states and DC: what each is for, when you can use it, and the law behind it.`,
    }),
    `    <section class="sec wrap">
      <h2>Pick your state.</h2>
      <ul class="more">
${FORMS.map((s) => `        <li><a href="${stateUrl(s)}">${html(s.name)}<span>${s.forms.length} forms</span></a></li>`).join('\n')}
      </ul>
    </section>`,
    `    <section class="sec wrap">
      <h2>Or pick the form.</h2>
      <ul class="more">
${FORM_TYPES.map((t) => `        <li><a href="/landlords/forms/${t.slug}/">${html(t.name)}<span>${cap(placeCount(rowsOf(t)))}</span></a></li>`).join('\n')}
      </ul>
    </section>`,
    section('Filled in for you.', steps(FILLED)),
    fine,
    more('More for landlords.', LANDLORD.map((o) => [`/landlords/${o.slug}/`, ...LANDLORD_LABEL[o.slug]])),
    finalAsk,
  ].join('\n\n');
  const ld = webPageLd({ url, title, desc, trail });
  return [url, page({ url, title, desc, ogImage: FORMS_OG[0], ogAlt: FORMS_OG[1], ld, body, scripts: [], styles: ['/landlords/forms/forms.css'] })];
}

// The links each hub page carries to its topic pages, between markers.
const HUBS = {
  'services/index.html': ['Every service, up close.', SERVICES.map((s) => [`/services/${s.slug}/`, s.label, s.blurb])],
  'pros/index.html': ['Find your trade.', [...SERVICES.map((s) => [`/pros/${s.slug}/`, s.label, `${s.jobs[0].toUpperCase()}${s.jobs.slice(1)}`]), ['/pros/ready-now/', 'Ready Now', 'Same-day NOHM NOW jobs']]],
  'landlords/index.html': ['Go deeper.', [...LANDLORD.map((t) => [`/landlords/${t.slug}/`, ...LANDLORD_LABEL[t.slug]]), FORMS_LINK]],
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
  out.set(...formsIndexPage());
  for (const t of FORM_TYPES) out.set(...formTypePage(t));
  for (const st of FORMS) {
    out.set(...formsStatePage(st));
    for (const f of st.forms) out.set(...formPage(st, f));
  }
  const files = new Map([...out].map(([url, html]) => [path.join(ROOT, url, 'index.html'), html]));
  for (const [rel, h] of Object.entries(HUBS)) {
    const f = path.join(ROOT, rel);
    files.set(f, hub(fs.readFileSync(f, 'utf8'), h));
  }
  // The sitemap lists every topic page between its markers.
  const sm = path.join(ROOT, 'sitemap.xml');
  const urls = [...out.keys()].map((u) => `  <url><loc>${HOST}${u}</loc>${u.startsWith('/landlords/forms/') ? `<lastmod>${FORMS_UPDATED}</lastmod>` : ''}</url>`).join('\n');
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
