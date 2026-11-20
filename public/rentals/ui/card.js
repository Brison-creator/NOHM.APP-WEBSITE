// One rental in the results: its photos, "$1,550/mo", the facts, the
// address, Share, and Apply (the listing's apply page on the NOHM
// server) beside Message (its page here, at Contact). Elements and
// textContent only.

import { h } from '../../nohm/dom.js';
import { factsLine, placeLine, rentLine, safeUrl, streetLine, availableLine } from '../lib/listing.js';
import { listingHref } from '../lib/search.js';
import { EXAMPLE_TAG, isExample } from '../lib/examples.js';
import { carousel, shareButton } from './parts.js';

/** The card for [l], a listing from GET /listings/public. */
export function rentalCard(l, { origin = location.origin } = {}) {
  const page = listingHref(l.slug);
  const street = streetLine(l);
  const place = placeLine(l);
  const name = street || place;
  const apply = safeUrl(l.url);
  // An example home (lib/examples.js): said so on the photo, and nothing
  // to apply for, message or share.
  if (isExample(l)) {
    return h('article.r-card.r-card--example', { dataset: { slug: l.slug, example: 'true' } }, [
      h('div.r-card-photos', [carousel(l.photos, name), h('span.r-example-tag', EXAMPLE_TAG)]),
      h('div.r-card-body', [
        h('div.r-card-top', [h('p.r-rent', rentLine(l))]),
        factsLine(l) ? h('p.r-facts', factsLine(l)) : null,
        h('h2.r-card-title', [h('a.r-card-link.r-addr', { href: page }, [h('span.r-street', name)])]),
        h('div.r-card-actions', [h('a.r-btn.sec', { href: page, 'aria-label': `See this example home, ${rentLine(l)}` }, 'See this example')]),
      ]),
    ]);
  }
  // The photos are their own element (their arrows are buttons, never
  // inside a link); the card's link is the address, its title.
  return h('article.r-card', { dataset: { slug: l.slug } }, [
    h('div.r-card-photos', [carousel(l.photos, name)]),
    h('div.r-card-body', [
      h('div.r-card-top', [
        h('p.r-rent', rentLine(l)),
        shareButton(`${origin}${page}`, name),
      ]),
      factsLine(l) ? h('p.r-facts', factsLine(l)) : null,
      h('h2.r-card-title', [
        h('a.r-card-link.r-addr', { href: page }, [street ? h('span.r-street', street) : null, h('span.r-place', place)]),
      ]),
      availableLine(l) ? h('p.r-avail', availableLine(l)) : null,
      h('div.r-card-actions', [
        apply ? h('a.r-btn.sec', { href: apply, 'aria-label': `Apply for ${name}` }, 'Apply') : null,
        h('a.r-btn', { href: `${page}#contact`, 'aria-label': `Message the landlord of ${name}` }, 'Message'),
      ]),
    ]),
  ]);
}
