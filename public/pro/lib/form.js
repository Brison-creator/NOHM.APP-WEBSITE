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

/** The trade a link names (?trade=handyman, ?trade=house-cleaning): its slug, or ''. */
export function tradeSlugFrom(search) {
  const s = new URLSearchParams(search || '').get('trade') || '';
  return /^[a-z]+(-[a-z]+)*$/.test(s) && s.length <= 30 ? s : '';
}

/** That trade in GET /trades (HANDYMAN for handyman), or undefined. */
export function tradeFor(slug, trades) {
  if (!slug) return undefined;
  const name = slug.toUpperCase().replace(/-/g, '_');
  return (trades || []).find((t) => t.name === name);
}

// Who a trade's link speaks to, in the headline ("Handymen: stop paying for leads.").
const CROWDS = {
  hvac: 'HVAC pros', plumbing: 'Plumbers', electrical: 'Electricians', roofing: 'Roofers',
  appliance: 'Appliance pros', 'make-ready': 'Make-ready pros', locksmith: 'Locksmiths',
  'pressure-washing': 'Pressure washers', handyman: 'Handymen', landscaping: 'Lawn pros',
  gutters: 'Gutter pros', 'garage-door': 'Garage door pros', 'pest-control': 'Pest control pros',
  painting: 'Painters', flooring: 'Flooring pros', 'house-cleaning': 'House cleaners',
  'tree-service': 'Tree pros', 'windows-doors': 'Window and door pros', siding: 'Siding pros',
  fencing: 'Fence pros', 'decks-patios': 'Deck and patio pros', concrete: 'Concrete pros',
  remodeling: 'Remodelers', insulation: 'Insulation pros', foundation: 'Foundation pros',
};

/** "Handymen" for handyman; '' for a trade the page doesn't know. */
export function tradeCrowd(slug) {
  return Object.prototype.hasOwnProperty.call(CROWDS, slug) ? CROWDS[slug] : '';
}

// Trades with their own photo in img/services (the /services pages').
const PHOTOS = new Set([
  'appliance', 'electrical', 'flooring', 'garage-door', 'gutters', 'handyman', 'house-cleaning', 'hvac',
  'landscaping', 'locksmith', 'painting', 'pest-control', 'plumbing', 'pressure-washing', 'tree-service',
]);

/** The trade's own hero photo (/img/services/handyman.jpg); '' when it has none. */
export function tradePhoto(slug) {
  return PHOTOS.has(slug) ? `/img/services/${slug}.jpg` : '';
}

// Trades with a full hero of their own (-960.webp, -1600.webp, -1600.jpg), as on /pro/handyman/.
const HEROES = { handyman: '/img/pro-handyman-hero' };

/** The trade's own hero image set ('/img/pro-handyman-hero'); '' when it has none. */
export function tradeHero(slug) {
  return Object.prototype.hasOwnProperty.call(HEROES, slug) ? HEROES[slug] : '';
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
