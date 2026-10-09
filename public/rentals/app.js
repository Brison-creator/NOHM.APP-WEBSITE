// /rentals: Rentals on nohm.app. The search (by ZIP) and each rental's
// page (?l=<slug>), against the NOHM server in public/book/config.js
// (?api= only on localhost, like /book). Shown only while the server
// says the search is on (GET /config/web → publicRentalsSearch); a
// server that's off, older or unreachable gets "Rentals are coming soon."

import { h, clear } from '../nohm/dom.js';
import { createHttp } from '../nohm/http.js';
import { apiBaseFor } from '../nohm/api.js';
import { normalizeWebConfig } from '../nohm/web-config.js';
import { rentalsOpen, route } from './lib/search.js';
import { searchView } from './ui/search-view.js';
import { listingView } from './ui/listing-view.js';

const root = document.getElementById('rentals');
const config = window.NOHM_BOOK || {};
// On localhost, a ?api= override lasts the tab's session, so links
// between the search and a listing keep using the stub
// (tools/rentals/stub-server.mjs). apiBaseFor ignores it anywhere else.
function devSearch() {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return location.search;
  try {
    const given = new URLSearchParams(location.search).get('api');
    if (given) sessionStorage.setItem('rentals:api', given);
    const kept = sessionStorage.getItem('rentals:api');
    return kept ? `?api=${encodeURIComponent(kept)}` : location.search;
  } catch {
    return location.search;
  }
}
const apiBase = apiBaseFor(location.hostname, devSearch(), config.apiBase);
// Public routes only: no account, no token.
const http = createHttp({ baseUrl: apiBase, session: { accessToken: null, refreshToken: null, clear() {} } });

const api = {
  webConfig: () => http.get('/config/web', { auth: false }),
  search: (path) => http.get(path, { auth: false }),
  listing: (slug) => http.get(`/listings/public/${encodeURIComponent(slug)}`, { auth: false }),
  inquire: (slug, body) => http.post(`/listings/public/${encodeURIComponent(slug)}/inquire`, body, { auth: false }),
};

const raw = api.webConfig().catch(() => null);
const webConfig = () => raw.then(normalizeWebConfig);

function comingSoon() {
  clear(root).append(
    h('section.r-hero.r-soon', [
      h('h1.r-h1', 'Rentals'),
      h('p.r-lede', 'Rentals are coming soon.'),
      h('p.r-note', 'Landlords on NOHM will list their homes here. Have an invite from your landlord?'),
      h('a.r-btn.sec.r-soon-btn', { href: '/join/renter' }, 'Accept your invite'),
    ]),
  );
}

async function start() {
  if (!rentalsOpen(await raw)) return comingSoon();
  const r = route(location.search);
  if (r.view === 'listing') return listingView(root, api, r.slug, webConfig);
  // Remember the search, so a listing's "Rentals" link goes back to it.
  const remember = () => {
    try {
      sessionStorage.setItem('rentals:lastSearch', location.search);
    } catch {
      /* storage off */
    }
  };
  return searchView(root, api, { onChange: remember });
}

start();
