// nohm.app/pro's short form (the supply-house flyer's QR code): the rules,
// without a browser. Name, mobile and trade are the must-haves, then the
// ZIP; email and business name help. The server (POST /recruit/interest)
// checks the same again.

import { phoneSignupProblems } from '../../nohm/signup.js';
import { toE164US } from '../../nohm/format.js';

/** Problems per field, in the words shown under it; {} when it can go. */
export function interestProblems(f) {
  const e = phoneSignupProblems(f);
  if (!f.tradeId) e.tradeId = 'Pick your main trade';
  if (!/^\d{5}$/.test((f.zip || '').trim())) e.zip = 'Your 5-digit ZIP';
  if ((f.businessName || '').trim().length > 40) e.businessName = 'Up to 40 characters';
  return e;
}

/** Where they came from (?from=flyer): a short slug, or the page's own. */
export function sourceFrom(search) {
  const s = new URLSearchParams(search || '').get('from') || '';
  return /^[a-z0-9-]{1,30}$/.test(s) ? s : 'pro-page';
}

/** POST /recruit/interest, less the human check's token. */
export function interestBody(f, source) {
  const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const body = {
    firstName: t(f.firstName),
    lastName: t(f.lastName),
    phone: toE164US(f.phone),
    tradeId: f.tradeId,
    zip: t(f.zip),
    source,
  };
  if (t(f.email)) body.email = t(f.email);
  if (t(f.businessName)) body.businessName = t(f.businessName);
  return body;
}

/** Said when the server says no. */
export function interestError(ex) {
  if (ex && ex.status === 429) return 'Too many tries from here. Wait a bit, or call or text 501-618-0026.';
  return (ex && ex.message) || 'That didn’t go through. Try again, or call or text 501-618-0026.';
}
