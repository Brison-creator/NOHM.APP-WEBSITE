// The search page (/rentals): the ZIP box and Search, the filter row
// (Price, Beds, Pets, Filters), List / Map, the results as cards, and
// pages. Every choice lives in the address bar, so a search can be
// shared; ?zip=72701 fills the box and searches. Elements only.

import { h, clear } from '../../nohm/dom.js';
import {
  activeFilters, BED_STEPS, PETS, PRICE_STEPS, readSearch, searchPath, searchQueryString, SORTS, validZip, ZIP_PROBLEM, listingHref,
} from '../lib/search.js';
import { mapPoint, rentLine, factsLine, streetLine, placeLine } from '../lib/listing.js';
import { rentalCard } from './card.js';
import { showMap } from './map.js';
import { icon, ICONS } from './parts.js';

const EMPTY = 'No rentals listed in this ZIP yet.';

/** A pill-shaped select: [label] is what "any" reads as. */
function pill(name, label, options, value, onChange) {
  const sel = h('select', { name, 'aria-label': label, onChange: () => onChange(sel.value) }, [
    h('option', { value: '' }, label),
    ...options.map(([v, text]) => h('option', { value: String(v), selected: String(value ?? '') === String(v) }, text)),
  ]);
  return h('label.r-pill', { class: value !== null && value !== undefined && value !== '' ? 'on' : '' }, [sel]);
}

export function searchView(root, api, { onChange = () => {} } = {}) {
  let state = readSearch(location.search);
  let view = new URLSearchParams(location.search).get('view') === 'map' ? 'map' : 'list';
  let last = null; // the last answer, for switching List / Map without asking again
  let seq = 0;

  const zip = h('input', { id: 'r-zip', name: 'zip', value: state.zip || '', inputMode: 'numeric', autocomplete: 'postal-code', maxLength: 5, placeholder: 'ZIP code', 'aria-describedby': 'r-zip-err' });
  const zipErr = h('p.r-err', { id: 'r-zip-err', role: 'alert' });
  const form = h('form.r-searchbar', { role: 'search', noValidate: true, onSubmit: (e) => { e.preventDefault(); submit(); } }, [
    h('label.r-zip', { htmlFor: 'r-zip' }, [h('span.r-sr', 'ZIP code'), icon(ICONS.pin, 18), zip]),
    h('button.r-btn.r-search-btn', { type: 'submit' }, 'Search'),
  ]);
  const filters = h('div.r-filters', { role: 'group', 'aria-label': 'Filters' });
  const more = h('div.r-more', { hidden: true, id: 'r-more' });
  const status = h('p.r-status', { role: 'status', 'aria-live': 'polite' });
  const results = h('div.r-results');
  const pager = h('nav.r-pager', { 'aria-label': 'Pages' });

  clear(root).append(
    h('section.r-hero', [h('h1.r-h1', 'Rentals'), h('p.r-lede', 'Homes for rent from landlords on NOHM. Apply in minutes.')]),
    h('div.r-searchwrap', [form, zipErr, filters, more]),
    status,
    results,
    pager,
  );

  function go(next, { push = true } = {}) {
    state = { ...state, ...next };
    const qs = searchQueryString(state) + (view === 'map' ? `${searchQueryString(state) ? '&' : '?'}view=map` : '');
    history[push ? 'pushState' : 'replaceState'](null, '', `/rentals/${qs}`);
    onChange();
    drawFilters();
    run();
  }

  function submit() {
    const z = validZip(zip.value);
    zipErr.textContent = z ? '' : ZIP_PROBLEM;
    zip.toggleAttribute('aria-invalid', !z);
    if (!z) return zip.focus();
    go({ zip: z, page: 1 });
  }

  function drawFilters() {
    const n = activeFilters(state);
    clear(filters).append(
      pill('maxRent', 'Price', PRICE_STEPS.map((p) => [p, `Up to $${p.toLocaleString('en-US')}`]), state.maxRent, (v) => go({ maxRent: v ? Number(v) : null, page: 1 })),
      pill('beds', 'Beds', BED_STEPS.map((b) => [b, b === 0 ? 'Studio +' : `${b}+ beds`]), state.minBeds, (v) => go({ minBeds: v === '' ? null : Number(v), page: 1 })),
      pill('pets', 'Pets', Object.entries(PETS), state.pets, (v) => go({ pets: v || null, page: 1 })),
      h('button.r-pill.r-pill-btn', { type: 'button', 'aria-expanded': String(!more.hidden), 'aria-controls': 'r-more', onClick: () => { more.hidden = !more.hidden; drawFilters(); } }, [icon(ICONS.sliders, 16), h('span', n ? `Filters (${n})` : 'Filters')]),
      h('div.r-toggle', { role: 'group', 'aria-label': 'Show as' }, [
        h('button', { type: 'button', 'aria-pressed': String(view === 'list'), onClick: () => setView('list') }, [icon(ICONS.list, 16), h('span', 'List')]),
        h('button', { type: 'button', 'aria-pressed': String(view === 'map'), onClick: () => setView('map') }, [icon(ICONS.map, 16), h('span', 'Map')]),
      ]),
    );
    clear(more).append(
      h('label.r-field', [h('span.r-label', 'Sort by'), h('select', { name: 'sort', onChange: (e) => go({ sort: e.target.value === 'newest' ? null : e.target.value, page: 1 }) }, Object.entries(SORTS).map(([v, t]) => h('option', { value: v, selected: (state.sort || 'newest') === v }, t)))]),
      h('button.r-link', { type: 'button', disabled: !n, onClick: () => go({ minBeds: null, maxRent: null, pets: null, sort: null, page: 1 }) }, 'Clear filters'),
    );
  }

  function setView(v) {
    view = v;
    go({}, { push: false });
  }

  async function run() {
    const path = searchPath(state);
    clear(results);
    clear(pager);
    if (!path) {
      status.textContent = 'Enter a ZIP code to see rentals listed on NOHM.';
      return;
    }
    const mine = ++seq;
    status.textContent = 'Searching…';
    results.append(h('div.r-grid.r-loading', { 'aria-hidden': 'true' }, [0, 1, 2].map(() => h('div.r-card.r-skel'))));
    let res;
    try {
      res = await api.search(path);
    } catch (e) {
      if (mine !== seq) return;
      clear(results);
      status.textContent = '';
      results.append(h('div.r-empty', [
        h('p.r-empty-title', e && e.status === 429 ? 'Too many searches from here.' : 'Can’t reach NOHM right now.'),
        h('p.r-note', e && e.status === 429 ? 'Wait a minute, then try again.' : 'Check your connection and try again.'),
        h('button.r-btn.r-retry', { type: 'button', onClick: run }, 'Try again'),
      ]));
      return;
    }
    if (mine !== seq) return;
    last = res;
    draw();
  }

  function draw() {
    const res = last;
    clear(results);
    clear(pager);
    const list = Array.isArray(res && res.listings) ? res.listings : [];
    const page = Number(res && res.page) || 1;
    const more = Boolean(res && res.hasMore);
    if (!list.length) {
      status.textContent = '';
      results.append(h('div.r-empty', [h('p.r-empty-title', page > 1 ? 'No more rentals here.' : EMPTY), h('p.r-note', 'Try another ZIP code, or fewer filters.')]));
      if (page > 1) pager.append(h('button.r-btn.sec', { type: 'button', onClick: () => go({ page: 1 }) }, 'Back to the first page'));
      return;
    }
    // The server says whether more follow, not how many (one read, no count).
    const n = list.length;
    status.textContent = page > 1
      ? `Rentals in ${state.zip}, page ${page}`
      : `${n}${more ? '+' : ''} ${n === 1 && !more ? 'rental' : 'rentals'} in ${state.zip}`;
    if (view === 'map') drawMap(list);
    else results.append(h('div.r-grid', list.map((l) => rentalCard(l))));
    if (page > 1 || more) {
      pager.append(
        h('button.r-btn.sec', { type: 'button', disabled: page <= 1, onClick: () => { go({ page: page - 1 }); window.scrollTo({ top: 0 }); } }, 'Previous'),
        h('span.r-pageno', `Page ${page}`),
        h('button.r-btn.sec', { type: 'button', disabled: !more, onClick: () => { go({ page: page + 1 }); window.scrollTo({ top: 0 }); } }, 'Next'),
      );
    }
  }

  function drawMap(list) {
    const on = list.filter((l) => mapPoint(l));
    const host = h('div.r-mapbox');
    results.append(host);
    const missing = list.length - on.length;
    if (missing) {
      results.append(h('p.r-note', `${missing} of these ${missing === 1 ? 'has' : 'have'} no map location yet. Switch to List to see ${missing === 1 ? 'it' : 'them'}.`));
    }
    showMap(host, on.map((l) => ({
      at: mapPoint(l),
      label: rentLine(l),
      popup: h('a.r-pop', { href: listingHref(l.slug) }, [
        l.photos && l.photos[0] ? h('img', { src: l.photos[0], alt: '' }) : null,
        h('b', rentLine(l)),
        h('span', factsLine(l)),
        h('span', [streetLine(l), placeLine(l)].filter(Boolean).join(', ')),
      ]),
    })));
  }

  window.addEventListener('popstate', () => {
    state = readSearch(location.search);
    view = new URLSearchParams(location.search).get('view') === 'map' ? 'map' : 'list';
    zip.value = state.zip || '';
    onChange();
    drawFilters();
    run();
  });

  onChange();
  drawFilters();
  run();
  if (!state.zip) zip.focus({ preventScroll: true });
}
