// What a rental shows on /rentals, as pure rules over the server's
// public listing (GET /listings/public and /listings/public/:slug): the
// price and facts lines, the address, highlights, grouped features,
// costs, and the contact form's body. Only what the listing has: nothing
// is guessed, estimated or filled in. No DOM, no network.

/** "$1,550" from cents (cents shown only when there are some). */
export function dollars(cents) {
  const n = Math.round(Number(cents) || 0) / 100;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** "$1,550/mo". */
export const rentLine = (l) => `${dollars(l.rentCents)}/mo`;

const plural = (n, one, many) => `${Number(n).toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** "4 Beds · 2 Baths · 1,720 Sqft" ("Studio" for 0 beds); only what's known. */
export function factsLine(l) {
  const parts = [];
  if (l.beds === 0) parts.push('Studio');
  else if (l.beds !== null && l.beds !== undefined) parts.push(plural(l.beds, 'Bed', 'Beds'));
  if (l.baths !== null && l.baths !== undefined) parts.push(plural(l.baths, 'Bath', 'Baths'));
  if (l.sqft) parts.push(`${Number(l.sqft).toLocaleString('en-US')} Sqft`);
  return parts.join(' · ');
}

/** The street and unit (the listing page's heading), or null. */
export function streetLine(l) {
  const s = [l.street, l.unit].filter(Boolean).join(' ').trim();
  return s || null;
}

/** "Fayetteville, AR 72701": the listing's own place (its data, not a coverage claim). */
export function placeLine(l) {
  return `${[l.city, l.state].filter(Boolean).join(', ')} ${l.zipCode || ''}`.trim();
}

/** The address in one line, for the share sheet and the map. */
export function fullAddress(l) {
  return [streetLine(l), placeLine(l)].filter(Boolean).join(', ');
}

/** "Available now" or "Available Nov 1" (the listing's date, as the listing page says it). */
export function availableLine(l, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(l.availableOn || '')) return null;
  const d = new Date(`${l.availableOn}T12:00:00Z`);
  if (d.getTime() <= now.getTime()) return 'Available now';
  return `Available ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}

export const PET_WORDS = {
  NONE: 'No pets',
  CATS: 'Cats OK',
  DOGS: 'Dogs OK',
  CATS_AND_DOGS: 'Cats and dogs OK',
  ASK: 'Pets: ask the landlord',
};

export const HOME_WORDS = { HOUSE: 'House', CONDO: 'Apartment or condo', TOWNHOUSE: 'Townhouse' };

/** Chips for Highlights: from the listing's own facts only. */
export function highlights(l, now = new Date()) {
  return [
    l.homeType && HOME_WORDS[l.homeType],
    l.pets && PET_WORDS[l.pets],
    l.leaseMonths ? `${l.leaseMonths}-month lease` : null,
    l.sqft ? `${Number(l.sqft).toLocaleString('en-US')} sq ft` : null,
    availableLine(l, now),
  ].filter(Boolean);
}

/**
 * Amenities & Features, grouped. NOHM listings carry the home, the
 * lease and the pet policy (no amenity list yet), so those are the
 * groups; an empty group is left out.
 */
export function featureGroups(l, now = new Date()) {
  const groups = [
    {
      title: 'The home',
      items: [
        l.homeType && HOME_WORDS[l.homeType],
        l.beds === 0 ? 'Studio' : l.beds != null ? plural(l.beds, 'bedroom', 'bedrooms') : null,
        l.baths != null ? plural(l.baths, 'bathroom', 'bathrooms') : null,
        l.sqft ? `${Number(l.sqft).toLocaleString('en-US')} square feet` : null,
      ],
    },
    {
      title: 'Lease',
      items: [l.leaseMonths ? `${l.leaseMonths}-month lease` : null, availableLine(l, now)],
    },
    { title: 'Pets', items: [l.pets && PET_WORDS[l.pets]] },
  ];
  return groups.map((g) => ({ ...g, items: g.items.filter(Boolean) })).filter((g) => g.items.length);
}

/** Said for anything a listing doesn't state. */
export const CONTACT_FOR_DETAILS = 'Contact for details';

/**
 * Costs & Fees: [{ label, value, note? }]. Rent, the deposit (if the
 * listing has one), the application fee as the server quotes it (none
 * when the landlord asks no application), and "Contact for details"
 * for anything else. Never an estimate.
 */
export function costRows(l) {
  const rows = [{ label: 'Monthly rent', value: dollars(l.rentCents) }];
  rows.push({ label: 'Security deposit', value: l.depositCents != null ? dollars(l.depositCents) : CONTACT_FOR_DETAILS });
  if (l.asksApplication === false) rows.push({ label: 'Application', value: 'No application', note: 'The landlord invites you to your lease on NOHM.' });
  else if (typeof l.applicationFeeCents === 'number') rows.push({ label: 'Application fee', value: l.applicationFeeCents === 0 ? 'No fee' : dollars(l.applicationFeeCents), note: 'Paid when you apply on NOHM, for the background check.' });
  else rows.push({ label: 'Application fee', value: CONTACT_FOR_DETAILS });
  rows.push({ label: 'Other fees', value: CONTACT_FOR_DETAILS });
  return rows;
}

/** The Contact form's message, written for them. */
export function defaultMessage(l) {
  return `Hello, I'd like more information about ${streetLine(l) || fullAddress(l)}.`;
}

/**
 * The texting note shown under the phone when they ask for an
 * application: word for word the listing page's Apply note (server
 * listing-page.ts, registered with the carriers: docs/TWILIO-TOLL-FREE.md).
 */
export const APPLY_TEXT_NOTE = 'By applying you agree to get texts from NOHM about this application. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.';

/** Under the form: how the message travels. */
export const PRIVACY_NOTE = 'Your message and how to reach you go to the landlord through NOHM. NOHM never shows the landlord’s personal number.';

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const isPhone = (s) => {
  let d = String(s).replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(d);
};

/**
 * The form's problems by field ({} when it can be sent). Asking for an
 * application needs a mobile number (the link comes by text); otherwise
 * an email or a phone.
 */
export function contactProblems(f) {
  const p = {};
  const t = (v) => String(v || '').trim();
  if (!t(f.firstName)) p.firstName = 'Enter your first name.';
  if (!t(f.lastName)) p.lastName = 'Enter your last name.';
  if (t(f.email) && !isEmail(t(f.email))) p.email = 'Enter a valid email.';
  if (t(f.phone) && !isPhone(t(f.phone))) p.phone = 'Enter a US mobile number.';
  if (f.requestApplication && !t(f.phone)) p.phone = 'Enter your mobile number: the application link comes by text.';
  if (!t(f.email) && !t(f.phone) && !p.phone) p.email = 'Enter your email or mobile number.';
  if (t(f.moveIn) && !/^\d{4}-\d{2}-\d{2}$/.test(t(f.moveIn))) p.moveIn = 'Pick a date.';
  if (t(f.message).length > 2000) p.message = 'Keep it under 2,000 characters.';
  return p;
}

/** The body for POST /listings/public/:slug/inquire (only the fields it takes). */
export function contactBody(f, humanToken) {
  const t = (v) => String(v || '').trim();
  return {
    firstName: t(f.firstName).slice(0, 60),
    lastName: t(f.lastName).slice(0, 60),
    ...(t(f.email) ? { email: t(f.email) } : {}),
    ...(t(f.phone) ? { phone: t(f.phone) } : {}),
    ...(t(f.moveIn) ? { moveIn: t(f.moveIn) } : {}),
    ...(t(f.message) ? { message: t(f.message).slice(0, 2000) } : {}),
    requestApplication: Boolean(f.requestApplication),
    ...(humanToken ? { humanToken } : {}),
  };
}

/**
 * What the server's answer means for the person:
 *   { token }             their new application: continue at its page
 *   { applicationTexted } they had one: the link went to their phone
 *   { sent }              the landlord has the message
 */
export function contactOutcome(res, listingUrl) {
  if (res && typeof res.token === 'string' && /^[A-Za-z0-9_-]+$/.test(res.token)) {
    return { kind: 'apply', title: 'Your application is ready.', text: 'Continue to it now. We also texted you the link.', href: applicationUrl(listingUrl, res.token) };
  }
  if (res && res.applicationTexted) return { kind: 'texted', title: 'Check your texts.', text: 'You already started an application for this rental. We texted you the link.' };
  return { kind: 'sent', title: 'Message sent.', text: 'The landlord gets it through NOHM and will reply to you.' };
}

/** The application page on the server that serves the listing page (l/:slug → rental-application/:token). */
export function applicationUrl(listingUrl, token) {
  const m = /^(https?:\/\/[^/]+(?:\/[^/]+)*?)\/l\/[^/]+$/.exec(String(listingUrl || ''));
  return m ? `${m[1]}/rental-application/${encodeURIComponent(token)}` : null;
}

/** Only links the server's listing could carry: https (http on localhost for tests). */
export function safeUrl(u) {
  try {
    const url = new URL(String(u));
    if (url.protocol === 'https:') return url.href;
    if (url.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(url.hostname)) return url.href;
  } catch {
    /* not a URL */
  }
  return null;
}

/** A map point only when the listing has one that's on Earth. */
export function mapPoint(l) {
  const lat = Number(l.latitude);
  const lng = Number(l.longitude);
  if (l.latitude == null || l.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
}

/**
 * What the visitor reads when Contact fails, from the server's answer
 * (an ApiError: status, code, message).
 */
export function contactError(x) {
  const status = x && x.status;
  const said = x && typeof x.message === 'string' && x.message ? x.message : null;
  if (status === 429) return 'Too many messages from here. Try again in an hour.';
  if (status === 404) return 'This rental is no longer listed.';
  // The application didn't start (the landlord still has the message), or
  // applying here needs the human check: the server says which.
  if (status === 409 || status === 403 || status === 400) return said || 'Please check the form and try again.';
  return 'Can’t reach NOHM right now. Try again.';
}

/**
 * The page's head for one rental: its own address on the site as the
 * canonical and share link, its title, and indexed only while it's live
 * (a gone listing, or an error, is noindex).
 */
export function listingHead(slug, title, live, origin = 'https://nohm.app') {
  const url = `${origin}/rentals/?l=${encodeURIComponent(slug)}`;
  return { canonical: url, ogUrl: url, title, robots: live ? 'index,follow' : 'noindex,follow' };
}
