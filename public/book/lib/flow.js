// The booking flow's rules: which step comes next, what a step needs
// before it can move on, and the exact bodies the NOHM server gets.
// Pure functions over a plain draft object, so tools/book tests them
// in Node and the screens stay thin.
//
// The server is the authority on everything that matters (access,
// price, card on file, one open request per trade); this file only
// keeps the person from sending something the server would refuse.

import { jobTitle } from './issues.js';
import { scheduledDateIso, windowByKey, bookableDays, windowOpenOn } from '../../nohm/format.js';

/** The steps in order. "schedule" is Standard-only; "account" and "card" are skipped when already done. */
export const STEPS = ['service', 'issue', 'details', 'speed', 'schedule', 'account', 'home', 'card', 'review', 'done'];

/**
 * A "by request" service (a trade NOHM doesn't dispatch online yet): the
 * person says what they need and when; a person at NOHM lines up a local
 * pro and texts them. No card, no speed, no schedule: nothing is promised
 * until a real pro has agreed to a time.
 */
export const REQUEST_STEPS = ['service', 'request', 'account', 'home', 'request-review', 'request-done'];
export const REQUEST_WHEN = { ASAP: 'As soon as possible', THIS_WEEK: 'This week', FLEXIBLE: 'I’m flexible' };
export const REQUEST_LIMITS = { min: 10, max: 2000 };

export const TIERS = {
  STANDARD: { key: 'STANDARD', name: 'Standard', line: 'A pro in a day or two.', feeKey: null },
  EXPRESS: { key: 'EXPRESS', name: 'NOHM Express', line: 'Same day. Goes straight to the closest pro.', feeKey: 'EXPRESS_PRIORITY_FEE' },
  NOW: { key: 'NOW', name: 'NOHM NOW', line: 'A pro within 60 minutes of accepting.', feeKey: 'NOHM_NOW_FEE' },
};

export const LIMITS = { title: 200, description: 2000, issueSummaryMin: 10, issueSummaryMax: 500, photos: 5, photoBytes: 10 * 1024 * 1024 };

export function emptyDraft() {
  return {
    trade: null, // { id, name, label } from GET /trades
    issue: null, // { title, description } from issues.js
    description: '',
    photos: [], // File objects; never persisted
    tier: 'STANDARD',
    day: null, // 'YYYY-MM-DD'
    window: null, // WINDOWS key
    propertyId: null,
    idempotencyKey: null, // set once per draft, reused on retry
    kind: 'job', // 'job' (booked online) or 'request' (a person at NOHM finds the pro)
    requestText: '',
    requestWhen: null, // REQUEST_WHEN key
  };
}

/** What a draft looks like in storage (sessionStorage): everything but the files. */
export function persistableDraft(draft) {
  const { photos, ...rest } = draft;
  return { ...rest, photoCount: photos ? photos.length : 0 };
}

export function restoreDraft(saved) {
  const d = emptyDraft();
  if (!saved || typeof saved !== 'object') return d;
  for (const k of Object.keys(d)) if (k !== 'photos' && saved[k] !== undefined) d[k] = saved[k];
  return d;
}

/** The server trade for a website slug ("plumbing", "hvac"), or null. */
export function tradeForSlug(slug, trades) {
  if (!slug) return null;
  const name = String(slug).trim().toUpperCase().replace(/-/g, '_');
  return (trades || []).find((t) => t.name === name && t.bookable !== false) || null;
}

/** Only trades a homeowner can book, in the server's order. */
export function bookableTrades(trades) {
  return (trades || []).filter((t) => t.isActive !== false && t.bookable !== false);
}

/**
 * Every trade the site offers, in the order of /services (the same 15
 * as the homepage and /homeowners; CLAUDE.md says change all of them
 * together). `name` is the server's trade name for the ones it has.
 */
export const SITE_TRADES = [
  { name: 'PLUMBING', label: 'Plumbing', blurb: 'Leaks, clogs, water heaters' },
  { name: 'HVAC', label: 'HVAC', blurb: 'No heat, no AC' },
  { name: 'ELECTRICAL', label: 'Electrical', blurb: 'Outages, outlets, breakers' },
  { name: 'APPLIANCE', label: 'Appliance', blurb: 'Washers, dryers, fridges' },
  { name: 'LOCKSMITH', label: 'Locksmith', blurb: 'Locked out, rekeys' },
  { name: 'PRESSURE_WASHING', label: 'Pressure Washing', blurb: 'Driveways, siding, decks' },
  { name: 'HANDYMAN', label: 'Handyman', blurb: 'Small fixes, drywall patches' },
  { name: 'LANDSCAPING', label: 'Landscaping & Lawn Care', blurb: 'Mowing, beds, yard cleanups' },
  { name: 'GUTTERS', label: 'Gutter Service', blurb: 'Cleaning, repairs, guards' },
  { name: 'GARAGE_DOOR', label: 'Garage Door Service', blurb: 'Stuck doors, springs, openers' },
  { name: 'PEST_CONTROL', label: 'Pest Control', blurb: 'Ants, roaches, rodents' },
  { name: 'PAINTING', label: 'Painting', blurb: 'Interior, exterior, touch-ups' },
  { name: 'FLOORING', label: 'Flooring', blurb: 'Installs, repairs, refinishing' },
  { name: 'HOUSE_CLEANING', label: 'House Cleaning', blurb: 'Regular, deep, move-out' },
  { name: 'TREE_SERVICE', label: 'Tree Service', blurb: 'Trimming, removal, storm cleanup' },
];

/**
 * The tiles on the service screen: the server's bookable trades first,
 * in its order (those book online), then every site trade the server
 * doesn't offer yet, marked `bookable: false` (those go to "tell us
 * what you need"). A server trade that isn't bookable stays hidden.
 */
export function pickerTrades(serverTrades) {
  const online = bookableTrades(serverTrades).map((t) => ({ ...t, bookable: true }));
  const have = new Set(online.map((t) => t.name));
  const byRequest = SITE_TRADES.filter((t) => !have.has(t.name)).map((t) => ({ ...t, id: null, bookable: false }));
  return [...online, ...byRequest];
}

// ── Contractor referral ───────────────────────────────────────────
// "Know a great contractor?" on the service screen. The site has no
// form endpoint, so the note goes to admin@nohm.app as an email the
// person sends from their own mail app.

export const REFERRAL_TO = 'admin@nohm.app';

/** The first thing to fix on the referral form, or null when it can be sent. */
export function referralProblem(f) {
  const name = (f.name || '').trim();
  const phone = (f.phone || '').trim();
  const email = (f.email || '').trim();
  if (!name) return "The contractor's name, please.";
  if (!phone && !email) return 'A phone number or an email so we can reach them.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "That email doesn't look right.";
  if (phone && phone.replace(/\D/g, '').length < 10) return "That phone number doesn't look right.";
  return null;
}

/** The mailto: link that carries the referral. */
export function referralMailto(f) {
  const line = (k, v) => `${k}: ${(v || '').trim() || '—'}`;
  const body = [
    line('Contractor', f.name),
    line('Phone', f.phone),
    line('Email', f.email),
    line('Referred by', f.referredBy),
  ].join('\n');
  const subject = `Contractor referral: ${(f.name || '').trim()}`;
  return `mailto:${REFERRAL_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ── Step rules ────────────────────────────────────────────────────

/**
 * Whether a step is done enough to leave. Returns null when it is, or
 * the first thing to fix (a short message) when it isn't.
 */
export function stepProblem(step, draft, now = new Date()) {
  switch (step) {
    case 'service':
      return draft.trade ? null : 'Pick a service.';
    case 'request': {
      const text = (draft.requestText || '').trim();
      if (text.length < REQUEST_LIMITS.min) return 'A sentence or two so we can find the right pro.';
      if (text.length > REQUEST_LIMITS.max) return `Keep it under ${REQUEST_LIMITS.max} characters.`;
      if (!REQUEST_WHEN[draft.requestWhen]) return 'Pick when you need it.';
      return null;
    }
    case 'issue':
      return draft.issue ? null : "Pick what's going on.";
    case 'details': {
      const text = (draft.description || '').trim();
      if (!text) return 'Tell the pro what you see.';
      if (draft.tier === 'NOW' && text.length < LIMITS.issueSummaryMin) return 'A few more words so the pro knows what to bring.';
      if (text.length > LIMITS.description) return `Keep it under ${LIMITS.description} characters.`;
      if ((draft.photos || []).length > LIMITS.photos) return `Up to ${LIMITS.photos} photos.`;
      return null;
    }
    case 'speed':
      return TIERS[draft.tier] ? null : 'Pick how soon.';
    case 'schedule':
      if (draft.tier !== 'STANDARD') return null;
      if (!draft.day) return 'Pick a day.';
      if (!bookableDays(now).some((d) => d.iso === draft.day)) return 'That day has passed. Pick another.';
      if (!windowByKey(draft.window)) return 'Pick an arrival window.';
      if (!windowOpenOn(draft.day, draft.window, now)) return 'That window has closed. Pick another.';
      return null;
    case 'home':
      return draft.propertyId ? null : 'Add the home the pro is coming to.';
    default:
      return null;
  }
}

/**
 * The step after `step`, given what's already true about the person:
 * ctx = { signedIn, hasCard }. Standard skips nothing; Express and
 * NOW skip the schedule.
 */
export function nextStep(step, draft, ctx) {
  const steps = draft.kind === 'request' ? REQUEST_STEPS : STEPS;
  const i = steps.indexOf(step);
  for (let j = i + 1; j < steps.length; j++) {
    const s = steps[j];
    if (s === 'schedule' && draft.tier !== 'STANDARD') continue;
    if (s === 'account' && ctx.signedIn) continue;
    if (s === 'home' && draft.propertyId) continue; // already chosen; Review's Edit reopens it
    if (s === 'card' && ctx.hasCard) continue;
    return s;
  }
  return steps[steps.length - 1];
}

export function prevStep(step, draft, ctx) {
  if (step === 'now') return 'review';
  const steps = draft.kind === 'request' ? REQUEST_STEPS : STEPS;
  const i = steps.indexOf(step);
  for (let j = i - 1; j >= 0; j--) {
    const s = steps[j];
    if (s === 'schedule' && draft.tier !== 'STANDARD') continue;
    if (s === 'account' && ctx.signedIn) continue;
    if (s === 'card' && ctx.hasCard) continue;
    return s;
  }
  return null;
}

// ── Money ─────────────────────────────────────────────────────────

/**
 * The fee for a tier from GET /config/pricing's map. `current` is what
 * the person pays now and what goes back as shownFeeCents; `base` is
 * the regular price, shown struck through while a promo is live.
 */
export function feeFor(tierKey, pricing) {
  const tier = TIERS[tierKey];
  if (!tier || !tier.feeKey) return { current: 0, base: 0, discounted: false };
  const row = pricing && pricing[tier.feeKey];
  if (!row) return null; // pricing not loaded: don't guess a price
  const current = Number(row.currentAmountCents);
  const base = Number(row.baseAmountCents);
  return {
    current,
    base,
    discounted: Boolean(row.hasLiveDiscount) && base > current,
    promoLabel: row.promoLabel || null,
    promoDescription: row.promoDescription || null,
  };
}

/**
 * The Late Afternoon premium in cents, from GET /config/pricing, or null
 * when the server doesn't publish it (then no amount is shown, never a
 * guessed one).
 */
export function lateAfternoonPremium(pricing) {
  const row = pricing && pricing.LATE_AFTERNOON_FEE;
  return row && Number.isFinite(Number(row.currentAmountCents)) ? Number(row.currentAmountCents) : null;
}

/**
 * The tiers to offer: a paid tier only when the server publishes its
 * price (a server without NOHM NOW has no NOHM_NOW_FEE), so nobody picks
 * a tier that can only fail at the end. Before pricing loads, all show.
 */
export function offeredTiers(pricing) {
  return Object.values(TIERS).filter((t) => !t.feeKey || !pricing || pricing[t.feeKey]);
}

// ── Server bodies ─────────────────────────────────────────────────

/**
 * GET /jobs/cancellation-terms query for the draft: the same date the
 * booking sends, so the terms shown are the ones it's booked under.
 */
export function cancellationTermsQuery(draft) {
  if (draft.tier === 'EXPRESS') return { isExpress: 'true' };
  if (draft.tier === 'NOW') return { priority: 'NOW' };
  return { scheduledDate: scheduledDateIso(draft.day), scheduledTimeWindow: draft.window };
}

/** POST /jobs body for a Standard or Express draft. Throws on a draft that isn't ready. */
export function jobBody(draft, pricing) {
  if (draft.tier === 'NOW') throw new Error('NOW jobs go through nowDispatchBody');
  for (const s of ['service', 'issue', 'details', 'speed', 'schedule', 'home']) {
    const p = stepProblem(s, draft);
    if (p) throw new Error(p);
  }
  if (!draft.idempotencyKey) throw new Error('idempotencyKey missing');
  const body = {
    propertyId: draft.propertyId,
    title: jobTitle(draft.trade.label, draft.issue.title).slice(0, LIMITS.title),
    description: draft.description.trim(),
    tradeId: draft.trade.id,
    idempotencyKey: draft.idempotencyKey,
  };
  if (draft.tier === 'EXPRESS') {
    const fee = feeFor('EXPRESS', pricing);
    if (!fee) throw new Error('Price not loaded');
    body.isExpress = true;
    body.shownFeeCents = fee.current;
  } else {
    body.scheduledDate = scheduledDateIso(draft.day);
    body.scheduledTimeWindow = draft.window;
  }
  return body;
}

/** POST /now/dispatch body once a live pro is picked. */
export function nowDispatchBody(draft, availabilityId, pricing) {
  for (const s of ['service', 'issue', 'details', 'home']) {
    const p = stepProblem(s, draft);
    if (p) throw new Error(p);
  }
  const fee = feeFor('NOW', pricing);
  if (!fee) throw new Error('Price not loaded');
  if (!availabilityId) throw new Error('Pick a pro');
  return {
    availabilityId,
    propertyId: draft.propertyId,
    tradeId: draft.trade.id,
    issueSummary: draft.description.trim().slice(0, LIMITS.issueSummaryMax),
    shownFeeCents: fee.current,
  };
}

// ── Server errors the flow reacts to ─────────────────────────────

/**
 * What to do about a failed job/dispatch call. Each branch is one the
 * app handles the same way (request_service_screen.dart). A 409 on a job
 * means "retry with the same key"; the app does that once, then retires
 * the key (app.js handleBookingError).
 */
export function bookingErrorAction(err, call = 'job') {
  const code = err && err.code;
  if (err && err.status === 401) return { kind: 'sign_in' };
  // A rental the booker manages is paid with the rental card, which is
  // set up in the app; the web card step would save the wrong one.
  if (code === 'PAYMENT_METHOD_REQUIRED' && err.body && err.body.forRentals) return { kind: 'rentals_card' };
  if (code === 'PAYMENT_METHOD_REQUIRED') return { kind: 'card' };
  if (code === 'PRICE_CHANGED') return { kind: 'price_changed', amountCents: err.body && err.body.amountCents };
  if (code === 'DUPLICATE_TRADE_REQUEST') return { kind: 'duplicate', existingJob: err.body && err.body.existingJob };
  // A NOW dispatch that loses the race (the pro was just taken) is a
  // plain 409 from the server: pick someone else, with its message.
  if (call === 'dispatch' && err && err.status === 409) return { kind: 'pick_again', message: err.message };
  if (code === 'PRO_UNAVAILABLE' || code === 'PRO_JUST_BOOKED') return { kind: 'pick_again', message: err.message };
  if (err && err.status === 409) return { kind: 'retry_same_key' };
  return { kind: 'show', message: (err && err.message) || 'Something went wrong. Try again.' };
}

/** The body for POST /service-requests: what the person needs, when, and which home. */
export function serviceRequestBody(draft) {
  if (draft.kind !== 'request') throw new Error('Not a request');
  for (const s of ['service', 'request', 'home']) {
    const p = stepProblem(s, draft);
    if (p) throw new Error(p);
  }
  return {
    trade: draft.trade.name,
    tradeLabel: draft.trade.label,
    description: draft.requestText.trim(),
    preferredWhen: draft.requestWhen,
    propertyId: draft.propertyId,
    source: 'WEB',
  };
}
