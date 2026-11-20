// Example homes on /rentals (owner, 2026-11-20: "I want it to be alive ...
// make it look busy"). A search with no rental listed, and the page before
// any search, shows these instead of an empty page, so a renter and a
// landlord both see how a rental looks on NOHM.
//
// They are not rentals, and the page never lets one pass for a rental:
//   - every card and every page says "Example", in words;
//   - none has an address, a ZIP, a date it is available or a map point;
//   - none can be applied for or messaged (no Apply, no Contact form, and
//     the server is never asked about one);
//   - none is indexed, and a real rental in the ZIP replaces them all.
// The photos are stock (public/img/rental-examples/CREDITS.txt), not homes
// on NOHM. Pure rules: no DOM, no network.

/** Every example's slug starts with this; the server never makes one that does. */
export const EXAMPLE_PREFIX = 'example-';

/** Said on every example card and page. */
export const EXAMPLE_TAG = 'Example';
export const EXAMPLE_NAME = 'Example home';
/** Over the cards when a ZIP has no rental listed. */
export const exampleIntro = (zip) =>
  zip
    ? `No rentals listed in ${zip} yet. These are example homes, to show how a rental looks on NOHM.`
    : 'Enter a ZIP code to see rentals listed on NOHM. These are example homes, to show how a rental looks here.';
/** On an example's own page. */
export const EXAMPLE_NOTICE = 'This is an example home, not a real rental. It shows how a rental looks on NOHM.';
export const EXAMPLE_NO_CONTACT = 'An example home has no landlord to message and can’t be applied for.';
export const EXAMPLE_NO_ADDRESS = 'An example home has no address.';
/** Where a landlord goes from an example. */
export const LIST_YOURS = { href: '/landlords/', text: 'List your rental on NOHM' };

const photos = (name, origin) => [1, 2, 3].map((i) => `${origin}/img/rental-examples/${name}-${i}.jpg`);

// The server's public listing shape (lib/listing.js reads it), with
// `example: true`, no place and no date.
const HOMES = [
  { key: 'brick-house', rentCents: 165000, beds: 3, baths: 2, sqft: 1620, homeType: 'HOUSE', pets: 'CATS_AND_DOGS', leaseMonths: 12,
    description: 'Example: a three-bedroom brick house with a fenced back yard, an open kitchen and a two-car garage. A landlord writes this part in their own words.' },
  { key: 'garage-house', rentCents: 215000, beds: 4, baths: 3, sqft: 2340, homeType: 'HOUSE', pets: 'DOGS', leaseMonths: 12,
    description: 'Example: a four-bedroom house with a big living room, the main bedroom downstairs and a two-car garage. A landlord writes this part in their own words.' },
  { key: 'ranch', rentCents: 149500, beds: 3, baths: 2, sqft: 1480, homeType: 'HOUSE', pets: 'ASK', leaseMonths: 12,
    description: 'Example: a one-story three-bedroom home on a quiet street, with a covered patio and lawn care included. A landlord writes this part in their own words.' },
  { key: 'bungalow', rentCents: 115000, beds: 2, baths: 1, sqft: 960, homeType: 'HOUSE', pets: 'CATS', leaseMonths: 12,
    description: 'Example: a two-bedroom bungalow with a front porch, wood floors and a washer and dryer. A landlord writes this part in their own words.' },
  { key: 'cottage', rentCents: 105000, beds: 2, baths: 1, sqft: 880, homeType: 'HOUSE', pets: 'NONE', leaseMonths: 6,
    description: 'Example: a small two-bedroom cottage with a fenced front yard and lots of light. A landlord writes this part in their own words.' },
  { key: 'apartment', rentCents: 89500, beds: 1, baths: 1, sqft: 720, homeType: 'CONDO', pets: 'CATS', leaseMonths: 12,
    description: 'Example: a one-bedroom apartment with an open kitchen, tall windows and parking. A landlord writes this part in their own words.' },
];

/** The example homes, their photos on [origin] (this site). */
export function examples(origin = 'https://nohm.app') {
  return HOMES.map((e) => ({
    slug: `${EXAMPLE_PREFIX}${e.key}`,
    example: true,
    url: null,
    street: EXAMPLE_NAME,
    unit: null,
    city: null,
    state: null,
    zipCode: null,
    latitude: null,
    longitude: null,
    availableOn: null,
    rentCents: e.rentCents,
    depositCents: e.rentCents,
    beds: e.beds,
    baths: e.baths,
    sqft: e.sqft,
    homeType: e.homeType,
    pets: e.pets,
    leaseMonths: e.leaseMonths,
    description: e.description,
    photos: photos(e.key, origin),
  }));
}

/** Whether a slug, or a listing, is an example home. */
export function isExample(x) {
  if (x && typeof x === 'object') return x.example === true;
  return typeof x === 'string' && x.startsWith(EXAMPLE_PREFIX);
}

/** The example home at [slug], or null. */
export function exampleFor(slug, origin) {
  return isExample(slug) ? examples(origin).find((e) => e.slug === slug) || null : null;
}

const PETS_OK = { cats: ['CATS', 'CATS_AND_DOGS'], dogs: ['DOGS', 'CATS_AND_DOGS'] };

/** The examples a search's own filters leave ({ minBeds, maxRent, pets, sort }). */
export function examplesFor(search = {}, origin) {
  let list = examples(origin);
  if (search.minBeds !== null && search.minBeds !== undefined) list = list.filter((e) => e.beds >= search.minBeds);
  if (search.maxRent) list = list.filter((e) => e.rentCents <= search.maxRent * 100);
  if (search.pets && PETS_OK[search.pets]) list = list.filter((e) => PETS_OK[search.pets].includes(e.pets));
  if (search.sort === 'rent') list = [...list].sort((a, b) => a.rentCents - b.rentCents);
  if (search.sort === 'rent_desc') list = [...list].sort((a, b) => b.rentCents - a.rentCents);
  return list;
}

/**
 * Whether examples stand in for a search's answer: only for its first
 * page, and only when the server listed no rental there (or there was
 * no ZIP to ask about). One real rental, and no example shows.
 */
export function showExamples(res, search = {}) {
  if (!search.zip) return true;
  const listed = Array.isArray(res && res.listings) ? res.listings.length : 0;
  return listed === 0 && (Number(res && res.page) || 1) === 1;
}
