// The search on /rentals, as pure rules: the ZIP, the filters in the
// address bar (so a search can be shared), the server path for them, and
// whether the server has the search switched on. No DOM, no network:
// tools/rentals tests them in Node.
//
// The server searches by ZIP only (GET /listings/public?zip=…): NOHM has
// no ZIP or city geography to search "near" or "City, ST" cleanly.

/** Five digits, nothing else. */
export function validZip(input) {
  const zip = String(input == null ? '' : input).trim();
  return /^\d{5}$/.test(zip) ? zip : null;
}

/** Said under the ZIP box when what was typed isn't one. */
export const ZIP_PROBLEM = 'Enter a 5-digit ZIP code.';

/** Price choices (whole dollars a month), as the Price pill offers them. */
export const PRICE_STEPS = [750, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 4000, 5000];
/** Bedroom choices: at least this many (0 is studios and up). */
export const BED_STEPS = [0, 1, 2, 3, 4];
export const PETS = { cats: 'Cats OK', dogs: 'Dogs OK' };
export const SORTS = { newest: 'Newest', rent: 'Price: low to high', rent_desc: 'Price: high to low' };
/** The most the server returns at once. */
export const PAGE_SIZE = 24;

const int = (v, lo, hi) => {
  if (v === null || v === undefined || v === '' || !/^\d+$/.test(String(v))) return null;
  const n = Number(v);
  return n >= lo && n <= hi ? n : null;
};

/**
 * The search a URL asks for: { zip, minBeds, maxRent, pets, sort, page }.
 * Anything unreadable is dropped (never sent), and zip is null when the
 * URL has no good one.
 */
export function readSearch(search) {
  const p = new URLSearchParams(search || '');
  const pets = p.get('pets');
  const sort = p.get('sort');
  return {
    zip: validZip(p.get('zip')),
    minBeds: int(p.get('beds'), 0, 20),
    maxRent: int(p.get('maxRent'), 1, 50000),
    pets: Object.hasOwn(PETS, pets || '') ? pets : null,
    sort: Object.hasOwn(SORTS, sort || '') && sort !== 'newest' ? sort : null,
    page: int(p.get('page'), 1, 200) || 1,
  };
}

/** The address bar for a search ("?zip=72701&beds=2"), defaults left out. */
export function searchQueryString(s) {
  const p = new URLSearchParams();
  if (s.zip) p.set('zip', s.zip);
  if (s.minBeds !== null && s.minBeds !== undefined) p.set('beds', String(s.minBeds));
  if (s.maxRent) p.set('maxRent', String(s.maxRent));
  if (s.pets) p.set('pets', s.pets);
  if (s.sort && s.sort !== 'newest') p.set('sort', s.sort);
  if (s.page && s.page > 1) p.set('page', String(s.page));
  const q = p.toString();
  return q ? `?${q}` : '';
}

/** The server path for a search (null without a ZIP: nothing to ask). */
export function searchPath(s) {
  if (!validZip(s.zip)) return null;
  const p = new URLSearchParams({ zip: s.zip, pageSize: String(PAGE_SIZE) });
  if (s.minBeds !== null && s.minBeds !== undefined) p.set('minBeds', String(s.minBeds));
  if (s.maxRent) p.set('maxRent', String(s.maxRent));
  if (s.pets) p.set('pets', s.pets);
  if (s.sort) p.set('sort', s.sort);
  if (s.page && s.page > 1) p.set('page', String(s.page));
  return `/listings/public?${p}`;
}

/** How many filters are on (for the Filters button's count). */
export function activeFilters(s) {
  return [s.minBeds !== null && s.minBeds !== undefined, Boolean(s.maxRent), Boolean(s.pets), Boolean(s.sort)].filter(Boolean).length;
}

/**
 * Whether the server has Rentals on nohm.app switched on, from its
 * GET /config/web answer. Only an explicit true: a server that doesn't
 * say (older, unreachable, an error) means "coming soon".
 */
export function rentalsOpen(webConfig) {
  return Boolean(webConfig && typeof webConfig === 'object' && webConfig.publicRentalsSearch === true);
}

/** Which page this is: one listing (?l=<slug>) or the search. */
export function route(search) {
  const slug = new URLSearchParams(search || '').get('l');
  return slug && /^[a-z0-9-]{3,80}$/.test(slug) ? { view: 'listing', slug } : { view: 'search' };
}

/** The site's own page for a listing (shared, and opened from a card). */
export function listingHref(slug, hash = '') {
  return `/rentals/?l=${encodeURIComponent(slug)}${hash}`;
}
