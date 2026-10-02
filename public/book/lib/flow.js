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

export const TIERS = {
  STANDARD: { key: 'STANDARD', name: 'Standard', line: 'A pro in a day or two.', feeKey: null },
  EXPRESS: { key: 'EXPRESS', name: 'NOHM Express', line: 'Same day. Goes straight to the closest pro.', feeKey: 'EXPRESS_PRIORITY_FEE' },
  NOW: { key: 'NOW', name: 'NOHM Now', line: 'A pro within 60 minutes of accepting.', feeKey: 'NOHM_NOW_FEE' },
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
  };
}

/** What a draft looks like in sessionStorage: everything but the files. */
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
 * the first thing to fix (a short message) when it isn't.
 */
export function stepProblem(step, draft, now = new Date()) {
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
  };
}

// ── Server bodies ─────────────────────────────────────────────────

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
    body.scheduledDate = scheduledDateIso(draft.day, draft.window);
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
 * app handles the same way (request_service_screen.dart).
 */
export function bookingErrorAction(err, call = 'job') {
  const code = err && err.code;
  if (err && err.status === 401) return { kind: 'sign_in' };
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
