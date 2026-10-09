// One rental's page on nohm.app (/rentals/?l=<slug>): photos, the price
// and facts, a sticky tab bar (Overview, Highlights, Contact, About,
// Costs & Fees, Amenities, Location), the Contact form (an inquiry to
// the landlord through NOHM, or a request for the application), and on
// phones a bar pinned to the bottom with Request to Apply and Send
// Message. Everything shown is the listing's own public data from the
// server (GET /listings/public/:slug). Elements and textContent only.

import { h, clear } from '../../nohm/dom.js';
import { humanCheck, TICK_FIRST } from '../../nohm/human.js';
import {
  APPLY_TEXT_NOTE, availableLine, contactBody, contactError, contactOutcome, contactProblems, costRows, defaultMessage, factsLine,
  featureGroups, fullAddress, highlights, listingHead, mapPoint, placeLine, PRIVACY_NOTE, rentLine, safeUrl, streetLine,
} from '../lib/listing.js';
import { showMap } from './map.js';
import { carousel, icon, ICONS, shareButton } from './parts.js';

const TABS = [
  ['overview', 'Overview'],
  ['highlights', 'Highlights'],
  ['contact', 'Contact'],
  ['about', 'About'],
  ['costs', 'Costs & Fees'],
  ['amenities', 'Amenities'],
  ['location', 'Location'],
];

/** "Back to rentals": the search they came from, when there is one. */
function backHref() {
  try {
    const q = sessionStorage.getItem('rentals:lastSearch');
    if (q && /^\?[\w=&%.-]*$/.test(q)) return `/rentals/${q}`;
  } catch {
    /* storage off */
  }
  return '/rentals/';
}

/** The head's canonical, share tags and robots for this rental (listingHead). */
function setHead(head) {
  const tag = (sel, make) => document.head.querySelector(sel) || document.head.appendChild(make());
  const meta = (attr, name) => tag(`meta[${attr}="${name}"]`, () => {
    const m = document.createElement('meta');
    m.setAttribute(attr, name);
    return m;
  });
  tag('link[rel="canonical"]', () => {
    const c = document.createElement('link');
    c.rel = 'canonical';
    return c;
  }).href = head.canonical;
  meta('property', 'og:url').setAttribute('content', head.ogUrl);
  meta('property', 'og:title').setAttribute('content', head.title);
  meta('name', 'robots').setAttribute('content', head.robots);
  document.title = head.title;
}

function section(id, title, children) {
  return h('section.r-sec', { id, 'aria-labelledby': `${id}-h` }, [h('h2.r-h2', { id: `${id}-h` }, title), ...children]);
}

export async function listingView(root, api, slug, webConfig) {
  clear(root).append(h('p.r-status', { role: 'status' }, 'Loading…'));
  let l;
  try {
    l = await api.listing(slug);
  } catch (e) {
    // Not live (or not reachable): never indexed as this page.
    setHead(listingHead(slug, 'Rentals | NOHM', false, location.origin));
    clear(root).append(
      h('div.r-empty.r-gone', [
        h('h1.r-h1', e && e.status === 404 ? 'This rental is no longer listed.' : 'Can’t reach NOHM right now.'),
        h('p.r-note', e && e.status === 404 ? 'It may have just been rented.' : 'Check your connection and try again.'),
        h('a.r-btn', { href: backHref() }, 'Find a rental'),
      ]),
    );
    return;
  }
  const street = streetLine(l);
  const place = placeLine(l);
  const name = street || place;
  const here = `${location.origin}/rentals/?l=${encodeURIComponent(l.slug)}`;
  const applyUrl = safeUrl(l.url);
  setHead(listingHead(l.slug, `${name} · ${rentLine(l)} | NOHM Rentals`, true, location.origin));

  // ── Overview ──────────────────────────────────────────────
  const overview = h('section.r-overview', { id: 'overview', 'aria-label': 'Overview' }, [
    h('div.r-ov-main', [
      h('p.r-rent.r-rent-big', rentLine(l)),
      factsLine(l) ? h('p.r-facts', factsLine(l)) : null,
      h('h1.r-addr-h', [street ? h('span.r-street', street) : null, h('span.r-place', place)]),
      availableLine(l) ? h('p.r-avail', availableLine(l)) : null,
    ]),
    h('div.r-ov-actions', [
      shareButton(here, name),
      applyUrl ? h('a.r-btn.sec', { href: applyUrl }, 'Request to Apply') : null,
      h('a.r-btn', { href: '#contact' }, 'Send Message'),
    ]),
  ]);

  // ── Tabs ──────────────────────────────────────────────────
  const tabs = h('nav.r-tabs', { 'aria-label': 'On this page' }, [
    h('div.r-tabs-in', TABS.map(([id, label]) => h('a', { href: `#${id}`, dataset: { tab: id } }, label))),
  ]);

  // ── Highlights ────────────────────────────────────────────
  const chips = highlights(l);
  const highlightsSec = section('highlights', 'Highlights', [
    chips.length ? h('ul.r-chips', chips.map((c) => h('li', c))) : h('p.r-note', 'Contact for details.'),
  ]);

  // ── Contact ───────────────────────────────────────────────
  const contactSec = section('contact', 'Contact', [contactForm(l, api, webConfig)]);

  // ── About ─────────────────────────────────────────────────
  const desc = String(l.description || '').trim();
  const aboutText = h('p.r-about', desc || 'The landlord hasn’t written about this rental yet. Contact for details.');
  const aboutKids = [aboutText];
  if (desc.length > 420) {
    aboutText.classList.add('clamped');
    const more = h('button.r-link', { type: 'button', 'aria-expanded': 'false', onClick: () => {
      const open = aboutText.classList.toggle('clamped') === false;
      more.textContent = open ? 'View less' : 'View more';
      more.setAttribute('aria-expanded', String(open));
    } }, 'View more');
    aboutKids.push(more);
  }
  const aboutSec = section('about', 'About', aboutKids);

  // ── Costs & Fees ──────────────────────────────────────────
  const costsSec = section('costs', 'Costs & Fees', [
    h('dl.r-costs', costRows(l).flatMap((r) => [h('dt', r.label), h('dd', [h('span', r.value), r.note ? h('small', r.note) : null])])),
  ]);

  // ── Amenities & Features ──────────────────────────────────
  const groups = featureGroups(l);
  const amenitiesSec = section('amenities', 'Amenities & Features', [
    groups.length
      ? h('div.r-groups', groups.map((g) => h('div.r-group', [h('h3.r-h3', g.title), h('ul', g.items.map((i) => h('li', i)))])))
      : h('p.r-note', 'Contact for details.'),
  ]);

  // ── Location ──────────────────────────────────────────────
  const point = mapPoint(l);
  const mapHost = h('div.r-mapbox.r-mapbox-one');
  const locationSec = section('location', 'Location', [
    h('p.r-loc', [icon(ICONS.pin, 18), h('span', fullAddress(l))]),
    point ? mapHost : null,
  ]);

  // ── Phone bar ─────────────────────────────────────────────
  const dock = h('div.r-dock', [
    applyUrl ? h('a.r-btn.sec', { href: applyUrl }, 'Request to Apply') : null,
    h('a.r-btn', { href: '#contact' }, 'Send Message'),
  ]);

  clear(root).append(
    h('a.r-back', { href: backHref() }, [icon(ICONS.back, 16), h('span', 'Rentals')]),
    h('div.r-gallery', [carousel(l.photos, name, { eager: true })]),
    overview,
    tabs,
    h('div.r-sections', [highlightsSec, contactSec, aboutSec, costsSec, amenitiesSec, locationSec]),
    h('p.r-eho', 'Equal Housing Opportunity. This rental is offered without regard to race, color, religion, sex, disability, familial status, national origin, or any other status protected by law.'),
    dock,
  );
  document.body.classList.add('r-has-dock');

  if (point) {
    // Drawn once the section is near, so a visitor who never scrolls loads no tiles.
    const io = new IntersectionObserver((seen) => {
      if (!seen.some((s) => s.isIntersecting)) return;
      io.disconnect();
      showMap(mapHost, [{ at: point, label: name }], { zoom: 16 });
    }, { rootMargin: '400px' });
    io.observe(mapHost);
  }

  // The tab for the section in view.
  const links = [...tabs.querySelectorAll('a')];
  const ids = TABS.map(([id]) => id);
  const mark = () => {
    let current = ids[0];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top < 140) current = id;
    }
    for (const a of links) {
      if (a.dataset.tab === current) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    }
  };
  window.addEventListener('scroll', () => window.requestAnimationFrame(mark), { passive: true });
  mark();
  if (location.hash && document.getElementById(location.hash.slice(1))) {
    document.getElementById(location.hash.slice(1)).scrollIntoView();
  }
}

/** The Contact form: to the landlord through NOHM (POST /listings/public/:slug/inquire). */
function contactForm(l, api, webConfig) {
  const f = {};
  const err = {};
  const field = (name, label, attrs = {}, tag = 'input') => {
    const input = h(tag, { id: `c-${name}`, name, ...attrs });
    err[name] = h('span.r-err', { id: `c-${name}-err`, role: 'alert' });
    input.setAttribute('aria-describedby', `c-${name}-err`);
    f[name] = input;
    return h('label.r-field', { htmlFor: `c-${name}` }, [h('span.r-label', label), input, err[name]]);
  };
  const today = new Date();
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yes = h('input', { type: 'radio', name: 'requestApplication', value: 'yes' });
  const no = h('input', { type: 'radio', name: 'requestApplication', value: 'no', checked: true });
  const textNote = h('p.r-fine.r-consent', { hidden: true }, APPLY_TEXT_NOTE);
  const human = humanCheck(webConfig);
  const formErr = h('p.r-err.r-form-err', { role: 'alert' });
  const send = h('button.r-btn', { type: 'submit' }, 'Send Message');
  const done = h('div.r-done', { hidden: true, role: 'status' });

  const choice = h('fieldset.r-choice', [
    h('legend.r-label', 'Request an application'),
    h('label', [yes, h('span', 'Yes')]),
    h('label', [no, h('span', 'Not now')]),
  ]);
  const applyElsewhere = h('p.r-fine', { hidden: true }, 'To apply, tap Request to Apply.');
  // Applying from this form needs the "I'm human" check; a server without
  // it takes questions only, so the choice isn't offered.
  webConfig().then((cfg) => {
    if (cfg.turnstileSiteKey) return;
    no.checked = true;
    choice.hidden = true;
    applyElsewhere.hidden = false;
    onChoice();
  });
  const onChoice = () => {
    textNote.hidden = !yes.checked;
    send.textContent = yes.checked ? 'Send and Apply' : 'Send Message';
  };
  yes.addEventListener('change', onChoice);
  no.addEventListener('change', onChoice);

  const form = h('form.r-contact', { noValidate: true, onSubmit: submit }, [
    h('div.r-row', [
      field('firstName', 'First name', { autocomplete: 'given-name', maxLength: 60, required: true }),
      field('lastName', 'Last name', { autocomplete: 'family-name', maxLength: 60, required: true }),
    ]),
    h('div.r-row', [
      field('email', 'Email', { type: 'email', autocomplete: 'email', maxLength: 200 }),
      field('phone', 'Phone', { type: 'tel', autocomplete: 'tel', inputMode: 'tel', maxLength: 20 }),
    ]),
    field('moveIn', 'Move-in date', { type: 'date', min: ymd(today) }),
    field('message', 'Message', { rows: 4, maxLength: 2000, value: defaultMessage(l) }, 'textarea'),
    choice,
    applyElsewhere,
    textNote,
    human.el,
    formErr,
    send,
    h('p.r-fine', PRIVACY_NOTE),
  ]);

  async function submit(e) {
    e.preventDefault();
    const values = {
      firstName: f.firstName.value,
      lastName: f.lastName.value,
      email: f.email.value,
      phone: f.phone.value,
      moveIn: f.moveIn.value,
      message: f.message.value,
      requestApplication: yes.checked,
    };
    const problems = contactProblems(values);
    for (const [k, el] of Object.entries(err)) {
      el.textContent = problems[k] || '';
      f[k].toggleAttribute('aria-invalid', Boolean(problems[k]));
    }
    formErr.textContent = '';
    const first = Object.keys(problems)[0];
    if (first) return f[first].focus();
    if (human.needed() && !human.token()) {
      formErr.textContent = TICK_FIRST;
      return;
    }
    send.disabled = true;
    send.textContent = 'Sending…';
    try {
      const res = await api.inquire(l.slug, contactBody(values, human.token()));
      const out = contactOutcome(res, l.url);
      form.hidden = true;
      clear(done).append(
        h('p.r-done-title', out.title),
        h('p.r-note', out.text),
        out.href ? h('a.r-btn', { href: out.href }, 'Continue your application') : null,
      );
      done.hidden = false;
      done.focus?.();
    } catch (x) {
      formErr.textContent = contactError(x);
      onChoice();
      send.disabled = false;
    } finally {
      human.reset();
    }
  }

  return h('div.r-contact-wrap', [form, done]);
}
