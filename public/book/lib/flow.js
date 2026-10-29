// The booking flow's rules: which step comes next, what a step needs
// before it can move on, and the exact bodies the NOHM server gets.
// Pure functions over a plain draft object, so tools/book tests them
// in Node and the screens stay thin.
//
// The server is the authority on everything that matters (access,
// price, card on file, one open request per trade); this file only
// keeps the person from sending something the server would refuse.

import { jobTitle } from './issues.js';
import { scheduledDateIso, windowByKey, bookableDays, windowOpenOn, isTimeZone } from '../../nohm/format.js';

/** The steps in order. "schedule" is Standard-only; "account" and "card" are skipped when already done. */
export const STEPS = ['service', 'issue', 'details', 'speed', 'schedule', 'account', 'home', 'card', 'review', 'done'];

export const TIERS = {
  STANDARD: { key: 'STANDARD', name: 'Standard', line: 'A pro in a day or two.', feeKey: null },
  EXPRESS: { key: 'EXPRESS', name: 'NOHM Express', line: 'Same day. Goes straight to the closest pro.', feeKey: 'EXPRESS_PRIORITY_FEE' },
  NOW: { key: 'NOW', name: 'NOHM NOW', line: 'A pro within 60 minutes of booking.', feeKey: 'NOHM_NOW_FEE' },
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
    useCredits: false, // Express only: the person opted to put their NOHM Credits toward the fee
    idempotencyKey: null, // set once per draft, reused on retry
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

// ── Step rules ────────────────────────────────────────────────────

/**
 * Whether a step is done enough to leave. Returns null when it is, or
 * the first thing to fix (a short message) when it isn't. `tz` is the
 * home's time zone (homeTimeZone): the schedule's days count there.
 */
export function stepProblem(step, draft, now = new Date(), tz = null) {
  switch (step) {
    case 'service':
      return draft.trade ? null : 'Pick a service.';
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
      if (!bookableDays(now, 7, tz).some((d) => d.iso === draft.day)) return 'Standard starts tomorrow. Pick another day.';
      if (!windowByKey(draft.window)) return 'Pick an arrival window.';
      if (!windowOpenOn(draft.day, draft.window, now, tz)) return 'That window has closed. Pick another.';
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
  const i = STEPS.indexOf(step);
  for (let j = i + 1; j < STEPS.length; j++) {
    const s = STEPS[j];
    if (s === 'schedule' && draft.tier !== 'STANDARD') continue;
    if (s === 'account' && ctx.signedIn) continue;
    if (s === 'home' && draft.propertyId) continue; // already chosen; Review's Edit reopens it
    if (s === 'card' && ctx.hasCard) continue;
    return s;
  }
  return 'done';
}

export function prevStep(step, draft, ctx) {
  if (step === 'now') return 'review';
  const i = STEPS.indexOf(step);
  for (let j = i - 1; j >= 0; j--) {
    const s = STEPS[j];
    if (s === 'schedule' && draft.tier !== 'STANDARD') continue;
    if (s === 'account' && ctx.signedIn) continue;
    if (s === 'card' && ctx.hasCard) continue;
    return s;
  }
  return null;
}

// ── The home's time zone ──────────────────────────────────────────

/**
 * Each of the person's homes and its time zone, as the server keeps it:
 * { [propertyId]: 'America/Chicago' | null }. GET /properties doesn't
 * carry the zone (yet); GET /auth/me lists the homes the person owns or
 * manages as stored, each with its `timezone` (property-timezone.ts).
 * A zone in the homes list itself wins, for a server that sends one there.
 */
export function homeZones(properties, me) {
  const user = (me && me.user) || me || {};
  const rows = [
    ...((user.homeownerProfile && user.homeownerProfile.properties) || []),
    ...((user.propertyManagerProfile && user.propertyManagerProfile.properties) || []),
    ...(properties || []),
  ];
  const out = {};
  for (const p of rows) if (p && p.id) out[p.id] = isTimeZone(p.timezone) ? p.timezone : out[p.id] || null;
  return out;
}

/**
 * The zone the draft's day and window count in: the chosen home's.
 * Before a home is chosen, the zone all the person's homes share, if
 * they share one. Null when the server hasn't said: the browser's own
 * zone stands in, and the review step checks the day again once the
 * home is known (app.js go).
 */
export function homeTimeZone(draft, zones) {
  const z = zones || {};
  if (draft && draft.propertyId) return isTimeZone(z[draft.propertyId]) ? z[draft.propertyId] : null;
  const all = [...new Set(Object.values(z))];
  return all.length === 1 && isTimeZone(all[0]) ? all[0] : null;
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
export function cancellationTermsQuery(draft, tz = null) {
  if (draft.tier === 'EXPRESS') return { isExpress: 'true' };
  if (draft.tier === 'NOW') return { priority: 'NOW' };
  return { scheduledDate: scheduledDateIso(draft.day, tz), scheduledTimeWindow: draft.window };
}

/**
 * POST /jobs body for a Standard or Express draft. Throws on a draft
 * that isn't ready. `tz` is the home's time zone: the day is midnight
 * there, with its offset.
 */
export function jobBody(draft, pricing, tz = null) {
  if (draft.tier === 'NOW') throw new Error('NOW jobs go through nowDispatchBody');
  for (const s of ['service', 'issue', 'details', 'speed', 'schedule', 'home']) {
    const p = stepProblem(s, draft, new Date(), tz);
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
    // Only the opt-in goes: how many credits apply is the server's call
    // when it holds the fee. Never sent unless the person ticked it.
    if (draft.useCredits === true) body.useCreditsForExpressFee = true;
  } else {
    body.scheduledDate = scheduledDateIso(draft.day, tz);
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
  // Already signed out by the http client, with the server's message on screen.
  if (err && err.accountStop) return { kind: 'stopped' };
  if (err && err.status === 401) return { kind: 'sign_in' };
  // A rental the booker manages is paid with the rental card, which is
  // set up in the app; the web card step would save the wrong one.
  if (code === 'PAYMENT_METHOD_REQUIRED' && err.body && err.body.forRentals) return { kind: 'rentals_card' };
  if (code === 'PAYMENT_METHOD_REQUIRED') return { kind: 'card' };
  if (code === 'PRICE_CHANGED') return { kind: 'price_changed', amountCents: err.body && err.body.amountCents };
  if (code === 'DUPLICATE_TRADE_REQUEST') return { kind: 'duplicate', existingJob: err.body && err.body.existingJob };
  // The day is today (or past) at the home: pick again, with the server's words.
  if (code === 'STANDARD_NOT_SAME_DAY') return { kind: 'schedule', message: err.message };
  // A NOW dispatch that loses the race (the pro was just taken) is a
  // plain 409 from the server: pick someone else, with its message.
  if (call === 'dispatch' && err && err.status === 409) return { kind: 'pick_again', message: err.message };
  if (code === 'PRO_UNAVAILABLE' || code === 'PRO_JUST_BOOKED') return { kind: 'pick_again', message: err.message };
  if (err && err.status === 409) return { kind: 'retry_same_key' };
  return { kind: 'show', message: (err && err.message) || 'Something went wrong. Try again.' };
}

// ── After sending: who has the request ───────────────────────────

/** A pro's names from an offer's contractor: { firstName, name } ("Ray", "Diaz Plumbing"). */
function proNames(c) {
  const u = (c && c.user) || {};
  const firstName = String(u.firstName || '').trim();
  const name = String((c && c.businessName) || '').trim() || `${firstName} ${String(u.lastName || '').trim()}`.trim();
  return { firstName: firstName || null, name: name || null };
}

/**
 * What the done screen says about who has the request, read from the
 * server's GET /jobs/:id/matched-contractors ({ job, offers }); the page
 * never decides who gets it. In order:
 * - 'no_pro': nobody can take it (NO_CONTRACTOR_AVAILABLE);
 * - 'preferred': the server offered it to the home's Preferred Pro first
 *   (the job's selected pro holds the PREFERRED offer,
 *   preferred-pro-offers.service.ts); nothing to pick;
 * - 'with_pro': it's already with one pro (picked earlier, or Express's
 *   closest pro); nothing to pick;
 * - 'pick': a Standard request waiting on the homeowner: the open offers;
 * - 'matching': no open offers yet.
 */
export function offerState(res) {
  const job = (res && res.job) || {};
  const offers = ((res && res.offers) || []).filter((o) => o && o.contractor);
  if (job.status === 'NO_CONTRACTOR_AVAILABLE') return { kind: 'no_pro' };
  if (job.status === 'AWAITING_ACCEPTANCE' && job.selectedContractorId) {
    const o = offers.find((x) => (x.contractorId || x.contractor.id) === job.selectedContractorId);
    return { kind: o && o.offerType === 'PREFERRED' ? 'preferred' : 'with_pro', ...proNames(o && o.contractor) };
  }
  // The app leaves out pros who passed or timed out (contractor_selection_screen.dart).
  const open = offers.filter((o) => o.response == null);
  return open.length ? { kind: 'pick', offers: open } : { kind: 'matching' };
}
