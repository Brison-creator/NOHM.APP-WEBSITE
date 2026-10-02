// One function per step of /book. Each gets the app (`a`: draft, state,
// api, navigation) and returns the screen's element. Screens render
// what the server and lib/flow.js say; they decide nothing themselves.

import { h, append, field, button, money, clear } from '../../nohm/dom.js';
import { TIERS, LIMITS, feeFor, offeredTiers, bookableTrades, pickerTrades, referralProblem, referralMailto, stepProblem, lateAfternoonPremium, cancellationTermsQuery } from '../lib/flow.js';
export { accountScreen } from '../../nohm/account.js';
import { issuesForTrade } from '../lib/issues.js';
import { WINDOWS, bookableDays, windowOpenOn, prettyPhone, scheduledDateIso } from '../../nohm/format.js';
import { mountCardForm } from './card.js';

// The trade glyphs, the same as the cards on /services. Each icon is a
// list of [tag, attributes]; built with createElementNS, never innerHTML.
const P = (d) => ['path', { d }];
const TRADE_ICON = {
  PLUMBING: [P('M12 3c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0C6 10.2 9 7 12 3z')],
  HVAC: [P('M12 2v20M4.2 7l15.6 10M4.2 17L19.8 7'), P('M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5')],
  ELECTRICAL: [P('M13 2L5 13.5h6L10 22l8-11.5h-6L13 2z')],
  APPLIANCE: [['rect', { x: 4, y: 2.5, width: 16, height: 19, rx: 2 }], ['circle', { cx: 12, cy: 13.5, r: 4.5 }], P('M7.5 6h.01M10.5 6h.01')],
  ROOFING: [P('M3 11l9-7 9 7M5 10v10h14V10')],
  LOCKSMITH: [['circle', { cx: 8, cy: 15, r: 4.5 }], P('M11.2 11.8L20 3M17 6l2.5 2.5M15 8l2 2')],
  PRESSURE_WASHING: [P('M3 10h9l3-3h3v6h-3l-3-3'), P('M18 10h3'), P('M7 10v4a2 2 0 0 0 2 2h1'), P('M19 14l2 3M17 15l1 4M21 12l2 1')],
  HANDYMAN: [P('M14.5 5.5l4 4-9.5 9.5-4-4z'), P('M13 4l2-2 7 7-2 2'), P('M5 15l-2.5 2.5 4 4L9 19')],
  LANDSCAPING: [P('M5 20c0-8.5 5-14 15-15-.5 9.5-6.5 14.5-15 15z'), P('M5 20l8-8'), P('M2 21h20')],
  GUTTERS: [P('M2 9l10-6 10 6'), P('M3 12h18v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 14z'), P('M17.5 15.5V21')],
  GARAGE_DOOR: [P('M3 21V9l9-6 9 6v12'), P('M6.5 21v-9h11v9M6.5 15h11M6.5 18h11')],
  PEST_CONTROL: [['ellipse', { cx: 12, cy: 14, rx: 4.5, ry: 6 }], P('M12 8v12M9.5 4.5L10.8 8M14.5 4.5L13.2 8M7.5 12H4M7.5 16.5l-3 2M16.5 12H20M16.5 16.5l3 2')],
  PAINTING: [['rect', { x: 3, y: 3, width: 15, height: 6, rx: 1.5 }], P('M18 6h3v6h-9v3'), ['rect', { x: 10.5, y: 15, width: 3, height: 6.5, rx: 1 }]],
  FLOORING: [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 1.5 }], P('M3 9h18M3 15h18M9 3v6M15 9v6M8 15v6')],
  HOUSE_CLEANING: [P('M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z'), P('M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z')],
  TREE_SERVICE: [P('M12 2l6 8h-3l4 6H5l4-6H6z'), P('M12 16v6')],
};
const SVG_NS = 'http://www.w3.org/2000/svg';
/** An icon from its shape list, or a single path string. */
const svg = (shapes) => {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of typeof shapes === 'string' ? [P(shapes)] : shapes) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    s.appendChild(el);
  }
  return s;
};

const BLURB = {
  PLUMBING: 'Leaks, clogs, water heaters',
  HVAC: 'No heat, no AC',
  ELECTRICAL: 'Outages, outlets, breakers',
  APPLIANCE: 'Washers, dryers, fridges',
  ROOFING: 'Leaks, shingles, gutters',
};

// Express and NOHM NOW hold the fee when the request is sent; the server
// releases it if no pro can come. Said the same way on every screen.
const HOLD = 'The fee is held on your card when you send the request, and released if no pro can come.';

/** "+$20" for Late Afternoon when the server publishes it, else nothing. */
function premiumText(a) {
  const cents = lateAfternoonPremium(a.state.pricing);
  return cents ? `+${money(cents)}` : null;
}

function head(title, sub) {
  return h('header.b-head', [h('h1.b-h1', title), sub ? h('p.b-sub', sub) : null]);
}

function footer(a, next, { label = 'Continue', disabled = false, back = true } = {}) {
  return h('div.b-foot', [back && a.canGoBack() ? button('Back', { kind: 'sec', onClick: () => a.back() }) : null, next ? button(label, { onClick: next, disabled, key: 'next' }) : null]);
}

// ── 1. Service ────────────────────────────────────────────────────

export function serviceScreen(a) {
  const trades = bookableTrades(a.state.trades);
  const tiles = pickerTrades(a.state.trades);
  const grid = h('div.b-grid');
  const matches = h('div.b-matches');
  const ask = h('p.b-ask', { hidden: true, role: 'status' });
  const q = h('input.b-search', { type: 'search', placeholder: 'What needs fixing? "no hot water", "AC not cooling"…', autocomplete: 'off', 'aria-label': 'What needs fixing' });

  const pickTrade = (t, issue) => {
    a.setDraft({ trade: { id: t.id, name: t.name, label: t.label }, issue: issue || null });
    a.go(issue ? 'details' : 'issue');
  };

  // A trade the server doesn't book online yet: say so and point to
  // the same "tell us what you need" email as the services page.
  const askFor = (t) => {
    clear(ask);
    ask.hidden = false;
    ask.append(h('b', `${t.label} isn’t bookable online yet.`), ' ', h('a', { href: `mailto:admin@nohm.app?subject=${encodeURIComponent(`Service request: ${t.label}`)}` }, 'Tell us what you need'), ' and we’ll line up a local pro.');
    ask.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const choose = (t, issue) => (t.bookable ? pickTrade(t, issue) : askFor(t));

  function drawGrid() {
    clear(grid);
    for (const t of tiles) {
      const tile = h('button.b-tile', { type: 'button', class: t.bookable ? '' : 'ask', onClick: () => choose(t), dataset: t.bookable ? { trade: t.name } : { ask: t.name } }, [
        svg(TRADE_ICON[t.name] || TRADE_ICON.HANDYMAN),
        h('b', t.label),
        h('span', t.blurb || BLURB[t.name] || t.description || ''),
        t.bookable ? null : h('small', 'By request'),
      ]);
      grid.append(tile);
    }
  }

  function search() {
    const text = q.value.trim().toLowerCase();
    clear(matches);
    if (text.length < 2) {
      matches.hidden = true;
      return;
    }
    const hits = [];
    for (const t of tiles) {
      if (t.bookable) {
        for (const i of issuesForTrade(t.name)) {
          const hay = `${t.label} ${i.title} ${i.description}`.toLowerCase();
          if (hay.includes(text)) hits.push({ t, i });
        }
      }
      if (`${t.label} ${t.blurb || ''}`.toLowerCase().includes(text)) hits.push({ t, i: null });
    }
    matches.hidden = false;
    if (!hits.length) {
      matches.append(h('p.b-small', 'Nothing by that name yet. Pick the closest service below and describe it in your own words.'));
      return;
    }
    for (const { t, i } of hits.slice(0, 6)) {
      matches.append(h('button.b-match', { type: 'button', onClick: () => choose(t, i) }, [h('span.b-emoji', i ? i.emoji : '🔧'), h('span', [h('b', i ? i.title : t.label), h('small', i ? `${t.label} · ${i.description}` : t.blurb || BLURB[t.name] || '')])]));
    }
  }
  q.addEventListener('input', search);
  drawGrid();
  if (!trades.length) {
    return h('section.b-screen', [head('Online booking isn’t open yet.', 'The NOHM app has every service. Get it, and we’ll see you there.'), h('a.b-btn', { href: a.storeUrl() }, 'Get NOHM'), h('p.b-small', [h('a', { href: '/services' }, 'See every service')])]);
  }

  const promo = a.state.pricing && feeFor('EXPRESS', a.state.pricing);
  return h('section.b-screen', [
    head("What's going on at home?", 'Pick a service. A local pro comes to you.'),
    h('div.b-searchwrap', [svg('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4'), q]),
    matches,
    grid,
    ask,
    h('p.b-line', [h('b', 'Standard has no NOHM fee.'), ' A pro in a day or two. ', promo && promo.discounted && promo.promoLabel ? h('span', promo.promoLabel) : null]),
    a.state.user ? h('p.b-small', ['Signed in as ', h('b', a.state.user.email || prettyPhone(a.state.user.phone)), ' · ', h('button.b-inline', { type: 'button', onClick: () => a.signOut() }, 'Sign out')]) : null,
    h('p.b-small', ["Don't see your trade? ", h('a', { href: '/services' }, 'See every service'), ' and ', h('a', { href: 'mailto:admin@nohm.app?subject=Service request' }, 'tell us what you need'), '.']),
    referralBlock(a),
  ]);
}

/**
 * "Know a great contractor?" A short form; sending opens the person's
 * mail app with the note addressed to NOHM (the site has no form
 * endpoint). Validation lives in lib/flow.js.
 */
function referralBlock(a) {
  const name = field({ label: 'Their name', name: 'ref-name', autocomplete: 'off', maxlength: 80 });
  const phone = field({ label: 'Phone', type: 'tel', name: 'ref-phone', inputmode: 'tel', autocomplete: 'off', maxlength: 20 });
  const email = field({ label: 'Email', type: 'email', name: 'ref-email', inputmode: 'email', autocomplete: 'off', maxlength: 120 });
  const by = field({ label: 'Who can we say referred them?', name: 'ref-by', autocomplete: 'off', maxlength: 80, placeholder: 'Your name' });
  const fields = { name, phone, email, by };
  const send = button('Send', { submit: true, key: 'refer' });

  const form = h('form.b-form.b-refer-form', { novalidate: true, onSubmit: (e) => {
    e.preventDefault();
    const f = { name: name.value, phone: phone.value, email: email.value, referredBy: by.value };
    for (const x of Object.values(fields)) x.setError('');
    const p = referralProblem(f);
    if (p) {
      const at = !f.name.trim() ? name : f.email.trim() && /email/i.test(p) ? email : phone;
      at.setError(p);
      at.input.focus();
      return;
    }
    window.location.href = referralMailto(f);
    a.toast('Thanks. Your mail app has the note ready to send.');
  } }, [name.el, h('div.b-two', [phone.el, email.el]), by.el, send]);

  return h('section.b-refer', [
    h('h2.b-h2', 'Know a great contractor?'),
    h('p.b-sub', 'Someone who’d be a good fit for NOHM? Tell us who, and we’ll reach out.'),
    form,
  ]);
}

// ── 2. Issue ──────────────────────────────────────────────────────

export function issueScreen(a) {
  const t = a.draft.trade;
  const list = h('div.b-list');
  for (const i of issuesForTrade(t.name)) {
    const on = a.draft.issue && a.draft.issue.title === i.title;
    list.append(h('button.b-choice', { type: 'button', class: on ? 'on' : '', onClick: () => { a.setDraft({ issue: { title: i.title, description: i.description } }); a.next(); } }, [h('span.b-emoji', i.emoji), h('span', [h('b', i.title), h('small', i.description)]), h('span.b-chev', '›')]));
  }
  return h('section.b-screen', [head(`${t.label}: what's wrong?`, 'Closest match is fine. You describe it next.'), list, footer(a, null)]);
}

// ── 3. Details ────────────────────────────────────────────────────

export function detailsScreen(a) {
  const desc = field({ label: 'Tell the pro what you see', type: 'textarea', name: 'description', value: a.draft.description, placeholder: 'Where it is, when it started, anything that helps them bring the right parts.', maxlength: LIMITS.description });
  desc.input.rows = 4;
  const photoIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif', multiple: true, id: 'f-photos', hidden: true });
  const thumbs = h('div.b-thumbs');
  let photos = [...(a.draft.photos || [])];
  function drawThumbs() {
    clear(thumbs);
    photos.forEach((f, idx) => {
      const img = h('img', { alt: f.name });
      img.src = URL.createObjectURL(f);
      img.onload = () => URL.revokeObjectURL(img.src);
      thumbs.append(h('span.b-thumb', [img, h('button', { type: 'button', 'aria-label': `Remove ${f.name}`, onClick: () => { photos.splice(idx, 1); drawThumbs(); } }, '×')]));
    });
    addBtn.hidden = photos.length >= LIMITS.photos;
  }
  const addBtn = h('button.b-addphoto', { type: 'button', onClick: () => photoIn.click() }, [svg('M4 7h3l2-3h6l2 3h3v12H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'), ` Add photos (up to ${LIMITS.photos})`]);
  photoIn.addEventListener('change', () => {
    for (const f of photoIn.files) {
      if (photos.length >= LIMITS.photos) break;
      if (f.size > LIMITS.photoBytes) { a.toast(`${f.name} is over 10 MB.`); continue; }
      photos.push(f);
    }
    photoIn.value = '';
    drawThumbs();
  });
  drawThumbs();

  const go = () => {
    a.setDraft({ description: desc.value, photos });
    const p = stepProblem('details', a.draft);
    if (p) return desc.setError(p);
    a.next();
  };
  return h('section.b-screen', [head(`${a.draft.trade.label} · ${a.draft.issue.title}`, 'A sentence or two is plenty. Photos help a lot.'), desc.el, photoIn, thumbs, addBtn, footer(a, go)]);
}

// ── 4. Speed ──────────────────────────────────────────────────────

export function speedScreen(a) {
  const list = h('div.b-list');
  const pricing = a.state.pricing;
  for (const tier of offeredTiers(pricing)) {
    const fee = feeFor(tier.key, pricing);
    const price = !tier.feeKey
      ? h('span.b-price', 'No NOHM fee')
      : fee
        ? h('span.b-price', [fee.discounted ? h('s', money(fee.base)) : null, ' ', money(fee.current)])
        : h('span.b-price.b-muted', '…');
    const on = a.draft.tier === tier.key;
    list.append(h('button.b-choice.b-tier', { type: 'button', class: on ? 'on' : '', disabled: Boolean(tier.feeKey) && !fee, dataset: { tier: tier.key }, onClick: () => {
      a.setDraft({ tier: tier.key, day: tier.key === 'STANDARD' ? a.draft.day : null, window: tier.key === 'STANDARD' ? a.draft.window : null });
      // NOW needs a fuller note than Standard did; say so now, not at the end.
      const p = stepProblem('details', a.draft);
      if (p) { a.notice = p; return a.go('details'); }
      a.next();
    } }, [h('span', [h('b', tier.name), h('small', tier.line)]), price]));
  }
  const promo = feeFor('EXPRESS', pricing);
  return h('section.b-screen', [
    head('How soon?', 'The fee is NOHM’s. The pro’s own price comes as an estimate you approve before work starts.'),
    list,
    promo && promo.discounted && (promo.promoLabel || promo.promoDescription) ? h('p.b-small', [promo.promoLabel, promo.promoLabel && promo.promoDescription ? ': ' : '', promo.promoDescription].filter(Boolean).join('')) : null,
    h('p.b-small', `${TIERS.EXPRESS.name} and ${TIERS.NOW.name}: ${HOLD.charAt(0).toLowerCase()}${HOLD.slice(1)}`),
    footer(a, null),
  ]);
}

// ── 5. Schedule (Standard) ────────────────────────────────────────

export function scheduleScreen(a) {
  const days = bookableDays();
  const dayRow = h('div.b-chips');
  const winList = h('div.b-list');
  const err = h('p.b-err');
  let { day, window: win } = a.draft;
  if (!day) day = days[0].iso;

  function drawWindows() {
    clear(winList);
    for (const w of WINDOWS) {
      const open = windowOpenOn(day, w.key);
      const on = win === w.key && open;
      winList.append(h('button.b-choice', { type: 'button', class: on ? 'on' : '', disabled: !open, dataset: { window: w.key }, onClick: () => { win = w.key; drawWindows(); err.textContent = ''; } }, [h('span', [h('b', w.name), h('small', open ? w.range : `${w.range} · passed`)]), w.premium && premiumText(a) ? h('span.b-price', premiumText(a)) : null]));
    }
  }
  function drawDays() {
    clear(dayRow);
    for (const d of days) dayRow.append(h('button.b-chip', { type: 'button', class: d.iso === day ? 'on' : '', dataset: { day: d.iso }, onClick: () => { day = d.iso; if (win && !windowOpenOn(day, win)) win = null; drawDays(); drawWindows(); } }, d.label));
  }
  drawDays();
  drawWindows();
  const go = () => {
    a.setDraft({ day, window: win });
    const p = stepProblem('schedule', a.draft);
    if (p) return (err.textContent = p);
    a.next();
  };
  const premium = lateAfternoonPremium(a.state.pricing);
  return h('section.b-screen', [head('When should the pro come?', 'Pick a day and an arrival window. The cancellation terms are on the last step.'), dayRow, winList, h('p.b-small', premium ? `Late afternoon adds a ${money(premium)} premium, held when your pro accepts.` : 'Late afternoon adds a premium, held when your pro accepts.'), err, footer(a, go)]);
}

// ── 7. Home ───────────────────────────────────────────────────────

export function homeScreen(a) {
  const wrap = h('section.b-screen');
  const err = h('p.b-err', { role: 'alert' });
  let mode = a.state.properties && a.state.properties.length ? 'pick' : 'add';

  function pickList() {
    const list = h('div.b-list');
    for (const p of a.state.properties) {
      list.append(h('button.b-choice', { type: 'button', class: a.draft.propertyId === p.id ? 'on' : '', dataset: { property: p.id }, onClick: () => { a.setDraft({ propertyId: p.id }); a.state.property = p; a.next(); } }, [h('span', [h('b', p.formattedAddress), h('small', p.hin ? `HIN ${p.hin}` : 'Home record pending')]), h('span.b-chev', '›')]));
    }
    return h('div', [list, h('button.b-link', { type: 'button', onClick: () => { mode = 'add'; draw(); } }, '+ Add another home')]);
  }

  function addForm() {
    const q = h('input.b-search', { type: 'text', placeholder: 'Street address', autocomplete: 'off', 'aria-label': 'Street address', id: 'f-address' });
    const results = h('div.b-matches');
    let timer = null;
    let seq = 0;
    q.addEventListener('input', () => {
      clearTimeout(timer);
      const text = q.value.trim();
      if (text.length < 4) { results.hidden = true; return; }
      timer = setTimeout(async () => {
        const mine = ++seq;
        try {
          const r = await a.api.places.autocomplete(text);
          if (mine !== seq) return;
          clear(results);
          results.hidden = false;
          for (const p of (r && r.predictions) || []) {
            results.append(h('button.b-match', { type: 'button', onClick: () => choose(p) }, [h('span.b-emoji', '📍'), h('span', [h('b', p.mainText || p.description), h('small', p.secondaryText || '')])]));
          }
          if (!results.children.length) results.append(h('p.b-small', 'No match. Try the street number and name.'));
        } catch (ex) { err.textContent = ex.message; }
      }, 300);
    });

    async function choose(p) {
      q.value = p.description || p.mainText;
      results.hidden = true;
      await a.run(async () => {
        const d = await a.api.places.details(p.placeId);
        const check = await a.api.properties.checkType({ googlePlaceId: d.placeId, formattedAddress: d.formattedAddress, latitude: d.latitude, longitude: d.longitude });
        if (check.existingProperty && check.ownedBySelf && check.existingPropertyId) {
          a.setDraft({ propertyId: check.existingPropertyId });
          a.state.property = { id: check.existingPropertyId, formattedAddress: d.formattedAddress, hin: check.existingHin || null };
          return a.next();
        }
        if (check.existingProperty) {
          mode = 'in-app';
          a.state.homeNote = check.claimable ? 'This home already has a NOHM record waiting to be claimed. Claiming it takes a quick verification that lives in the app.' : 'This home is on NOHM under another account. Sorting that out happens in the app.';
          return draw();
        }
        // What kind of home it is is the person's answer: the server's
        // isMultiFamily is only a hint from the address.
        a.state.pendingPlace = { d, multiHint: Boolean(check.isMultiFamily) };
        mode = 'type';
        draw();
      }, err);
    }
    return h('div', [h('div.b-searchwrap', [svg('M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10zM12 8.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'), q]), results, h('p.b-small', 'Your home gets a Home Identification Number: one record for every repair, pro and part, for as long as the house stands.')]);
  }

  function typeQuestion() {
    const { d, multiHint } = a.state.pendingPlace;
    const single = async () => a.run(async () => {
      const shell = await a.api.properties.shell({ googlePlaceId: d.placeId, formattedAddress: d.formattedAddress, latitude: d.latitude, longitude: d.longitude });
      const home = await a.api.properties.confirm(shell.id, 'SINGLE');
      a.state.property = home;
      a.state.properties = [...(a.state.properties || []), home];
      a.setDraft({ propertyId: home.id });
      a.state.pendingPlace = null;
      mode = 'added';
      draw();
    }, err);
    const multi = () => {
      mode = 'in-app';
      a.state.homeNote = 'Homes with more than one unit (apartments, condos, duplexes) are set up in the app, where you pick your unit.';
      draw();
    };
    return h('div', [
      h('div.b-card', [h('b', d.formattedAddress), multiHint ? h('p.b-small', 'This address may have more than one unit.') : null]),
      h('div.b-list', [
        h('button.b-choice', { type: 'button', dataset: { structure: 'SINGLE' }, onClick: single }, [h('span', [h('b', 'A house'), h('small', 'One home at this address')]), h('span.b-chev', '›')]),
        h('button.b-choice', { type: 'button', dataset: { structure: 'MULTI' }, onClick: multi }, [h('span', [h('b', 'An apartment, condo or duplex'), h('small', 'More than one unit at this address')]), h('span.b-chev', '›')]),
      ]),
    ]);
  }

  function draw() {
    clear(wrap);
    err.textContent = '';
    if (mode === 'type') append(wrap, [head('What kind of home is it?', 'So your home record is set up right.'), typeQuestion(), err, h('button.b-link', { type: 'button', onClick: () => { mode = 'add'; draw(); } }, 'Use a different address'), footer(a, null)]);
    else if (mode === 'pick') append(wrap, [head('Which home?', 'The pro is coming to:'), pickList(), err, footer(a, null)]);
    else if (mode === 'add') append(wrap, [head('Where is the pro coming?', 'Start typing the street address.'), addForm(), err, footer(a, null, { back: true }), a.state.properties && a.state.properties.length ? h('button.b-link', { type: 'button', onClick: () => { mode = 'pick'; draw(); } }, 'Choose a home I already added') : null]);
    else if (mode === 'added') {
      const p = a.state.property;
      append(wrap, [head('Your home is on NOHM.', p.hin ? `HIN ${p.hin}` : ''), h('div.b-card', [h('b', p.formattedAddress), h('p', 'Every repair from here on lands in this home’s record.')]), footer(a, () => a.next())]);
    } else if (mode === 'in-app') {
      append(wrap, [head('Finish this one in the app', a.state.homeNote), h('a.b-btn', { href: a.storeUrl() }, 'Get NOHM'), h('button.b-link', { type: 'button', onClick: () => { mode = 'add'; draw(); } }, 'Try a different address'), footer(a, null)]);
    }
  }
  draw();
  return wrap;
}

// ── 8. Card ───────────────────────────────────────────────────────

export function cardScreen(a) {
  const host = h('div.b-cardhost');
  const err = h('p.b-err', { role: 'alert' });
  const btn = button('Save card', { disabled: true, key: 'savecard' });
  let form = null;
  let gone = false;
  a.onLeave(() => { gone = true; if (form) form.destroy(); });
  mountCardForm({ host, publishableKey: a.config.stripePublishableKey, api: a.api, name: a.state.user ? `${a.state.user.firstName || ''} ${a.state.user.lastName || ''}`.trim() : undefined })
    .then((f) => {
      if (gone) return f.destroy();
      form = f;
      f.onChange(({ complete, error }) => { btn.disabled = !complete; err.textContent = error || ''; });
    })
    .catch((ex) => (err.textContent = ex.message));
  btn.addEventListener('click', async () => {
    if (!form) return;
    btn.busy(true, 'Saving…');
    try {
      const r = await form.confirm();
      a.state.hasCard = true;
      a.state.card = r;
      a.next();
    } catch (ex) { err.textContent = ex.message; } finally { btn.busy(false); }
  });
  const fee = feeFor(a.draft.tier, a.state.pricing);
  return h('section.b-screen', [
    head('A card on file', a.draft.tier === 'STANDARD' ? 'Nothing is charged now. It’s how you approve the pro’s estimate later, with no cash at the door.' : `Nothing is charged now.${fee ? ` The ${money(fee.current)} fee is held on your card when you send the request, and released if no pro can come.` : ''}`),
    h('div.b-card.white', [host]),
    err,
    h('p.b-small', 'Handled by Stripe. NOHM never sees your card number.'),
    h('div.b-foot', [a.canGoBack() ? button('Back', { kind: 'sec', onClick: () => a.back() }) : null, btn]),
  ]);
}

// ── 9. Review ─────────────────────────────────────────────────────

export function reviewScreen(a) {
  const d = a.draft;
  const tier = TIERS[d.tier];
  const fee = feeFor(d.tier, a.state.pricing);
  const win = WINDOWS.find((w) => w.key === d.window);
  const day = bookableDays().find((x) => x.iso === d.day);
  const terms = h('p.b-small', '…');
  a.api.jobs.cancellationTerms(cancellationTermsQuery(d)).then((t) => (terms.textContent = (t && t.disclosure) || '')).catch(() => (terms.textContent = ''));

  const row = (label, value, step) => h('div.b-row', [h('span.b-muted', label), h('span', value), step ? h('button.b-edit', { type: 'button', onClick: () => a.go(step) }, 'Edit') : null]);
  const btn = button(d.tier === 'NOW' ? 'See who’s ready now' : d.tier === 'EXPRESS' ? 'Send to the closest pro' : 'Send my request', { key: 'confirm' });
  const err = h('p.b-err', { role: 'alert' });
  btn.addEventListener('click', () => a.submit(btn, err));

  return h('section.b-screen', [
    head('Ready to send?', 'Nothing goes out until you tap the button.'),
    h('div.b-card', [
      row('Service', `${d.trade.label} · ${d.issue.title}`, 'service'),
      row('Note', d.description, 'details'),
      d.photos && d.photos.length ? row('Photos', `${d.photos.length}`, 'details') : null,
      row('Speed', tier.name, 'speed'),
      d.tier === 'STANDARD' ? row('When', `${day ? day.label : d.day}, ${win ? `${win.name.toLowerCase()} ${win.range}` : ''}`, 'schedule') : null,
      row('Home', a.state.property ? a.state.property.formattedAddress : '', 'home'),
      row('Card', a.state.card ? `${a.state.card.brand || 'Card'} •••• ${a.state.card.last4}` : 'On file'),
      h('div.b-row.b-total', [h('span', 'NOHM fee'), h('span', [fee && fee.discounted ? h('s', money(fee.base)) : null, ' ', fee ? (fee.current ? money(fee.current) : 'None') : '…'])]),
      win && win.premium ? h('div.b-row', [h('span.b-muted', 'Late afternoon premium'), h('span', premiumText(a) || 'Applies')]) : null,
    ]),
    h('p.b-small', d.tier === 'STANDARD' ? 'No NOHM fee. Your pro’s estimate comes to you for approval before any work starts.' : HOLD),
    terms,
    err,
    h('div.b-foot', [a.canGoBack() ? button('Back', { kind: 'sec', onClick: () => a.back() }) : null, btn]),
    h('p.b-small', ['By sending, you agree to the ', h('a', { href: '/terms' }, 'Terms'), ' and ', h('a', { href: '/privacy' }, 'Privacy Policy'), '.']),
  ]);
}

// ── 9b. NOW: pick a live pro ──────────────────────────────────────

export function nowScreen(a) {
  const wrap = h('section.b-screen');
  const err = h('p.b-err', { role: 'alert' });
  const list = h('div.b-list');
  const note = h('p.b-small');
  let polls = 0;
  let stopped = false;

  async function load() {
    if (stopped) return;
    try {
      const r = await a.api.now.live(a.draft.trade.id, a.draft.propertyId);
      clear(list);
      if (!r || r.kind !== 'PROS' || !r.pros.length) {
        if (polls === 0) await a.api.now.demand(a.draft.trade.id, a.draft.propertyId).catch(() => {});
        note.textContent = 'No pro is live for this trade right now. We’ve pinged nearby pros; this list refreshes on its own. Express gets you the closest pro today without waiting here.';
        list.append(button('Switch to NOHM Express', { kind: 'sec', onClick: () => { a.setDraft({ tier: 'EXPRESS' }); a.go('review'); } }));
      } else {
        note.textContent = 'Live now and ready to leave. Pick one and they get the job.';
        for (const p of r.pros) {
          list.append(h('button.b-choice', { type: 'button', dataset: { avail: p.availabilityId }, onClick: () => dispatch(p) }, [
            p.photoUrl ? h('img.b-avatar', { src: p.photoUrl, alt: '' }) : h('span.b-avatar'),
            h('span', [h('b', p.contractorName), h('small', [p.averageRating ? `★ ${Number(p.averageRating).toFixed(1)} · ` : '', `${p.completedJobs || 0} jobs`, p.etaMinutes ? ` · ~${p.etaMinutes} min away` : '', p.hasNohmProBadge ? ' · NOHM Pro' : ''])]),
            h('span.b-chev', '›'),
          ]));
        }
      }
      polls++;
      if (polls < 40 && !stopped) timer = setTimeout(load, 15000);
    } catch (ex) { err.textContent = ex.message; }
  }
  async function dispatch(p) {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    list.querySelectorAll('button').forEach((b) => (b.disabled = true));
    const ok = await a.dispatchNow(p.availabilityId, err);
    if (!ok) {
      // The pro was taken or the server said no: show who's live now.
      stopped = false;
      load();
    }
  }
  let timer = null;
  a.onLeave(() => { stopped = true; clearTimeout(timer); });
  const nowFee = feeFor('NOW', a.state.pricing);
  load();
  append(wrap, [head('Who’s ready now', `${a.draft.trade.label}${nowFee ? ` · ${money(nowFee.current)} ${TIERS.NOW.name} fee` : ''}`), note, list, err, footer(a, null)]);
  return wrap;
}

// ── 10. Done ──────────────────────────────────────────────────────

export function doneScreen(a) {
  const job = a.state.job || {};
  const d = a.draft;
  const wrap = h('section.b-screen');
  const status = h('p.b-line');
  const pros = h('div.b-list');
  const err = h('p.b-err', { role: 'alert' });
  let tries = 0;
  let left = false;
  let pollTimer = null;
  a.onLeave(() => { left = true; clearTimeout(pollTimer); });

  const what = d.tier === 'NOW'
    ? 'Your pro has the job and is getting ready to leave. Track them, chat, and get your door PIN in the app.'
    : d.tier === 'EXPRESS'
      ? 'The closest pro gets it first; if they pass, the next closest does. Watch it happen in the app.'
      : 'Here are the pros who can take it. Pick one and the job is theirs to accept.';

  async function loadOffers() {
    if (d.tier !== 'STANDARD') return;
    try {
      const j = await a.api.jobs.get(job.id);
      if (j.status === 'NO_CONTRACTOR_AVAILABLE') {
        status.textContent = 'No pro can take this one right now. You can send it again from the app.';
        return;
      }
      const r = await a.api.jobs.matchedContractors(job.id);
      const offers = (r && r.offers) || [];
      if (!offers.length) {
        if (++tries < 10 && !left) { status.textContent = 'Finding pros near you…'; pollTimer = setTimeout(loadOffers, 2000); return; }
        status.textContent = 'Still matching. Pick a pro in the app as soon as they show up.';
        return;
      }
      status.textContent = what;
      clear(pros);
      for (const o of offers) {
        const c = o.contractor || {};
        const name = c.businessName || `${(c.user && c.user.firstName) || ''} ${(c.user && c.user.lastName) || ''}`.trim();
        pros.append(h('button.b-choice', { type: 'button', dataset: { contractor: c.id }, onClick: () => pick(c.id, name) }, [
          c.profilePhotoUrl ? h('img.b-avatar', { src: c.profilePhotoUrl, alt: '' }) : h('span.b-avatar'),
          h('span', [h('b', name), h('small', [c.averageRating ? `★ ${Number(c.averageRating).toFixed(1)} · ` : '', `${c.completedJobsCount || 0} jobs`, c.yearsExperience ? ` · ${c.yearsExperience} yrs` : '', c.hasNohmProBadge ? ' · NOHM Pro' : ''])]),
          h('span.b-chev', '›'),
        ]));
      }
    } catch (ex) { err.textContent = ex.message; }
  }
  async function pick(contractorId, name) {
    await a.run(async () => {
      await a.api.jobs.selectContractor(job.id, contractorId);
      clear(pros);
      status.textContent = `${name} has your request and a short window to accept. The app shows it live.`;
    }, err);
  }
  if (d.tier === 'STANDARD') loadOffers();
  else status.textContent = what;

  wrap.append(
    head(d.tier === 'NOW' ? 'A pro is on the way.' : 'Request sent.', job.jobNumber ? `Job ${job.jobNumber}` : ''),
    h('div.b-card', [h('b', `${d.trade.label} · ${d.issue.title}`), h('p', a.state.property ? a.state.property.formattedAddress : ''), a.state.property && a.state.property.hin ? h('p.b-small', `HIN ${a.state.property.hin}`) : null]),
    status,
    pros,
    err,
    h('div.b-card.blue', [h('b', 'Everything else lives in the app.'), h('p', 'Live tracking, chat with your pro, the door PIN, the estimate to approve, and this home’s record.'), h('a.b-btn', { href: a.storeUrl() }, 'Get NOHM')]),
    h('p.b-small', [h('button.b-inline', { type: 'button', onClick: () => a.restart() }, 'Book something else')]),
  );
  return wrap;
}
