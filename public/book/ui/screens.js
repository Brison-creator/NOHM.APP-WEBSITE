// One function per step of /book. Each gets the app (`a`: draft, state,
// api, navigation) and returns the screen's element. Screens render
// what the server and lib/flow.js say; they decide nothing themselves.

import { h, field, button, money, clear } from '../../nohm/dom.js';
import { TIERS, LIMITS, feeFor, offeredTiers, bookableTrades, stepProblem, lateAfternoonPremium } from '../lib/flow.js';
import { issuesForTrade } from '../lib/issues.js';
import { WINDOWS, bookableDays, windowOpenOn, prettyPhone } from '../../nohm/format.js';
import { preparePhoto, splitToLimit, overLimitText } from '../lib/photos.js';
import { svg, head, footer, HOLD, premiumText } from './parts.js';
export { accountScreen } from '../../nohm/account.js';
export { homeScreen, cardScreen } from './home.js';
export { reviewScreen, nowScreen, doneScreen } from './send.js';

const TRADE_ICON = {
  PLUMBING: 'M12 3c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0C6 10.2 9 7 12 3z',
  HVAC: 'M12 2v20M4.2 7l15.6 10M4.2 17L19.8 7',
  ELECTRICAL: 'M13 2L5 13.5h6L10 22l8-11.5h-6L13 2z',
  APPLIANCE: 'M4 2.5h16v19H4zM12 9a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z',
  ROOFING: 'M3 11l9-7 9 7M5 10v10h14V10',
  // The rest are the /services card icons, as one path each.
  LOCKSMITH: 'M8 10.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM11.2 11.8L20 3M17 6l2.5 2.5M15 8l2 2',
  PRESSURE_WASHING: 'M3 10h9l3-3h3v6h-3l-3-3M18 10h3M7 10v4a2 2 0 0 0 2 2h1M19 14l2 3M17 15l1 4M21 12l2 1',
  HANDYMAN: 'M14.5 5.5l4 4-9.5 9.5-4-4zM13 4l2-2 7 7-2 2M5 15l-2.5 2.5 4 4L9 19',
  LANDSCAPING: 'M5 20c0-8.5 5-14 15-15-.5 9.5-6.5 14.5-15 15zM5 20l8-8M2 21h20',
  GUTTERS: 'M2 9l10-6 10 6M3 12h18v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 14zM17.5 15.5V21',
  GARAGE_DOOR: 'M3 21V9l9-6 9 6v12M6.5 21v-9h11v9M6.5 15h11M6.5 18h11',
  PEST_CONTROL: 'M12 8a4.5 6 0 1 0 0 12 4.5 6 0 0 0 0-12zM12 8v12M9.5 4.5L10.8 8M14.5 4.5L13.2 8M7.5 12H4M7.5 16.5l-3 2M16.5 12H20M16.5 16.5l3 2',
  PAINTING: 'M4.5 3h12A1.5 1.5 0 0 1 18 4.5v3A1.5 1.5 0 0 1 16.5 9h-12A1.5 1.5 0 0 1 3 7.5v-3A1.5 1.5 0 0 1 4.5 3zM18 6h3v6h-9v3M11.5 15h1a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V16a1 1 0 0 1 1-1z',
  FLOORING: 'M4.5 3h15A1.5 1.5 0 0 1 21 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-15A1.5 1.5 0 0 1 4.5 3zM3 9h18M3 15h18M9 3v6M15 9v6M8 15v6',
  HOUSE_CLEANING: 'M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8zM18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  TREE_SERVICE: 'M12 2l6 8h-3l4 6H5l4-6H6zM12 16v6',
};

// The same words as the /services cards.
const BLURB = {
  PLUMBING: 'Leaks, clogs, water heaters',
  HVAC: 'No heat, no AC',
  ELECTRICAL: 'Outages, outlets, breakers',
  APPLIANCE: 'Washers, dryers, fridges',
  ROOFING: 'Leaks, shingles, gutters',
  LOCKSMITH: 'Locked out, rekeys',
  PRESSURE_WASHING: 'Driveways, siding, decks',
  HANDYMAN: 'Small fixes, drywall patches',
  LANDSCAPING: 'Mowing, beds, yard cleanups',
  GUTTERS: 'Cleaning, repairs, guards',
  GARAGE_DOOR: 'Stuck doors, springs, openers',
  PEST_CONTROL: 'Ants, roaches, rodents',
  PAINTING: 'Interior, exterior, touch-ups',
  FLOORING: 'Installs, repairs, refinishing',
  HOUSE_CLEANING: 'Regular, deep, move-out',
  TREE_SERVICE: 'Trimming, removal, storm cleanup',
};

// ── 1. Service ────────────────────────────────────────────────────

export function serviceScreen(a) {
  const trades = bookableTrades(a.state.trades);
  const grid = h('div.b-grid');
  const matches = h('div.b-matches');
  const q = h('input.b-search', { type: 'search', placeholder: 'What needs fixing? "no hot water", "AC not cooling"…', autocomplete: 'off', 'aria-label': 'What needs fixing' });

  const pickTrade = (t, issue) => {
    a.setDraft({ trade: { id: t.id, name: t.name, label: t.label }, issue: issue || null });
    a.go(issue ? 'details' : 'issue');
  };

  function drawGrid() {
    clear(grid);
    for (const t of trades) {
      grid.append(h('button.b-tile', { type: 'button', onClick: () => pickTrade(t), dataset: { trade: t.name } }, [svg(TRADE_ICON[t.name] || TRADE_ICON.HANDYMAN), h('b', t.label), h('span', BLURB[t.name] || t.description || '')]));
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
    for (const t of trades) {
      for (const i of issuesForTrade(t.name)) {
        const hay = `${t.label} ${i.title} ${i.description}`.toLowerCase();
        if (hay.includes(text)) hits.push({ t, i });
      }
      if (t.label.toLowerCase().includes(text)) hits.push({ t, i: null });
    }
    matches.hidden = false;
    if (!hits.length) {
      matches.append(h('p.b-small', 'Nothing by that name yet. Pick the closest service below and describe it in your own words.'));
      return;
    }
    for (const { t, i } of hits.slice(0, 6)) {
      matches.append(h('button.b-match', { type: 'button', onClick: () => pickTrade(t, i) }, [h('span.b-emoji', i ? i.emoji : '🔧'), h('span', [h('b', i ? i.title : t.label), h('small', i ? `${t.label} · ${i.description}` : BLURB[t.name] || '')])]));
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
    h('p.b-line', [h('b', 'Standard has no NOHM fee.'), ' A pro in a day or two. ', promo && promo.discounted && promo.promoLabel ? h('span', promo.promoLabel) : null]),
    a.state.user ? h('p.b-small', ['Signed in as ', h('b', a.state.user.email || prettyPhone(a.state.user.phone)), ' · ', h('button.b-inline', { type: 'button', onClick: () => a.signOut() }, 'Sign out')]) : null,
    h('p.b-small', ["Don't see your trade? ", h('a', { href: '/services' }, 'See every service'), ' and ', h('a', { href: 'mailto:admin@nohm.app?subject=Service request' }, 'tell us what you need'), '.']),
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
  const addLabel = ` Add photos (up to ${LIMITS.photos})`;
  const addText = document.createTextNode(addLabel);
  const addBtn = h('button.b-addphoto', { type: 'button', onClick: () => photoIn.click() }, [svg('M4 7h3l2-3h6l2 3h3v12H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'), addText]);
  let preparing = 0;
  // Each photo is shrunk here (long edge 2048 px, JPEG), so what's sent
  // is small; one that can't be used is named and the rest are kept.
  photoIn.addEventListener('change', async () => {
    const { take: picked, dropped } = splitToLimit(photoIn.files, photos.length);
    photoIn.value = '';
    let over = dropped;
    if (!picked.length) { if (over) a.toast(overLimitText(over)); return; }
    preparing++;
    addBtn.disabled = true;
    addText.textContent = ' Preparing photos…';
    const problems = [];
    for (const f of picked) {
      try {
        const ready = await preparePhoto(f);
        if (photos.length < LIMITS.photos) photos.push(ready);
        else over++; // another pick filled the last spots meanwhile
      } catch (ex) { problems.push(ex.message); }
    }
    if (--preparing === 0) { addBtn.disabled = false; addText.textContent = addLabel; }
    const notes = [overLimitText(over), ...problems].filter(Boolean);
    if (notes.length) a.toast(notes.join(' '));
    drawThumbs();
  });
  drawThumbs();

  const go = () => {
    if (preparing) return a.toast('One moment, the photos are still being prepared.');
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
  return h('section.b-screen', [head('When should the pro come?', `Pick a day from tomorrow on and an arrival window. Need a pro today? Go back and choose ${TIERS.EXPRESS.name}. The cancellation terms are on the last step.`), dayRow, winList, h('p.b-small', premium ? `Late afternoon adds a ${money(premium)} premium, held when your pro accepts.` : 'Late afternoon adds a premium, held when your pro accepts.'), err, footer(a, go)]);
}
