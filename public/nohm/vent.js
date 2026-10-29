// "Vent to us" (owner, 2026-10-29: "Put a vent to us what frustrates you
// about being a landlord we will help you solve it just a text box no email
// collection 1 box submit that's it"): the rules, without a browser. One
// box, sent signed out to the server's POST /feedback/vent as
// { text, page, formTrap } and nothing else (any other field is refused).
// The server keeps nothing about the sender; the words go to the founder.
// The form is nohm/vent-form.js; tests in tools/landlords/vent.test.mjs.

import { formTrapField } from './form-traps.js';

/** The server's limits (backend feedback/vent/landlord-vent.dto.ts). */
export const VENT_MIN = 3;
export const VENT_MAX = 4000;
const PAGE = /^[a-z0-9/_-]{1,120}$/;

export const VENT_TOO_SHORT = 'Tell us a little more.';
export const VENT_TOO_LONG = 'Keep it under 4,000 characters.';
export const VENT_BUSY = 'That’s a lot at once. Try again in a little while.';
export const VENT_THANKS = 'Thank you. The founder reads every one.';
const VENT_FAILED = 'That didn’t go through. Try again in a little while.';

/** What's wrong with the words before sending, in the server's own words; '' when they can go. */
export function ventProblem(text) {
  const t = String(text == null ? '' : text).trim();
  if (t.length < VENT_MIN) return VENT_TOO_SHORT;
  if (t.length > VENT_MAX) return VENT_TOO_LONG;
  return '';
}

/**
 * The request body: the words, the page it came from and the traps.
 * Nothing else ever rides along: no name, email, phone or id.
 */
export function ventBody(text, page, trap) {
  const body = { text: String(text == null ? '' : text).trim() };
  if (PAGE.test(page || '')) body.page = page;
  return { ...body, ...formTrapField(trap) };
}

/** Said when the server says no: its first message on a 400, the limit on a 429. */
export function ventError(ex) {
  if (ex && ex.status === 429) return VENT_BUSY;
  if (ex && ex.status === 400) {
    const m = ex.body && ex.body.message;
    const first = Array.isArray(m) ? m[0] : m;
    return typeof first === 'string' && first ? first : VENT_TOO_SHORT;
  }
  // Offline: the http client's "Can't reach NOHM right now..." line.
  if (ex && ex.status === 0 && ex.message) return ex.message;
  return VENT_FAILED;
}
