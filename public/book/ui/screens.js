// One function per step of /book. Each gets the app (`a`: draft, state,
// api, navigation) and returns the screen's element. Screens render
// what the server and lib/flow.js say; they decide nothing themselves.

import { h, append, field, button, money, clear } from './dom.js';
import { TIERS, LIMITS, feeFor, bookableTrades, stepProblem, signupProblems, signupBody } from '../lib/flow.js';
import { issuesForTrade } from '../lib/issues.js';
import { WINDOWS, bookableDays, windowOpenOn, prettyPhone, toE164US } from '../lib/format.js';
import { mountCardForm } from './card.js';
import { mountGoogleButton } from './google.js';

const TRADE_ICON = {
  PLUMBING: 'M12 3c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0C6 10.2 9 7 12 3z',
  HVAC: 'M12 2v20M4.2 7l15.6 10M4.2 17L19.8 7',
  ELECTRICAL: 'M13 2L5 13.5h6L10 22l8-11.5h-6L13 2z',
  APPLIANCE: 'M4 2.5h16v19H4zM12 9a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z',
  ROOFING: 'M3 11l9-7 9 7M5 10v10h14V10',
};
const svg = (d) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  s.appendChild(p);
  return s;
};

const BLURB = {
  PLUMBING: 'Leaks, clogs, water heaters',
  HVAC: 'No heat, no AC',
  ELECTRICAL: 'Outages, outlets, breakers',
  APPLIANCE: 'Washers, dryers, fridges',
  ROOFING: 'Leaks, shingles, gutters',
};

function head(title, sub) {
  return h('header.b-head', [h('h1.b-h1', title), sub ? h('p.b-sub', sub) : null]);
}

function footer(a, next, { label = 'Continue', disabled = false, back = true } = {}) {
  return h('div.b-foot', [back && a.canGoBack() ? button('Back', { kind: 'sec', onClick: () => a.back() }) : null, next ? button(label, { onClick: next, disabled, key: 'next' }) : null]);
}

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
      grid.append(h('button.b-tile', { type: 'button', onClick: () => pickTrade(t), dataset: { trade: t.name } }, [svg(TRADE_ICON[t.name] || TRADE_ICON.PLUMBING), h('b', t.label), h('span', BLURB[t.name] || t.description || '')]));
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

  const promo = a.state.pricing && feeFor('EXPRESS', a.state.pricing);
  return h('section.b-screen', [
    head("What's going on at home?", 'Pick a service. A local pro comes to you.'),
    h('div.b-searchwrap', [svg('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4'), q]),
    matches,
    grid,
    h('p.b-line', [h('b', 'Standard is free.'), ' No NOHM fee, a pro in a day or two. ', promo && promo.discounted ? h('span', ['Express and NOHM Now are half off at launch.']) : null]),
    a.state.user ? h('p.b-small', ['Signed in as ', h('b', a.state.user.email || prettyPhone(a.state.user.phone)), ' · ', h('a', { href: '#', onClick: (e) => { e.preventDefault(); a.signOut(); } }, 'Sign out')]) : null,
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
  for (const tier of Object.values(TIERS)) {
    const fee = feeFor(tier.key, pricing);
    const price = !tier.feeKey
      ? h('span.b-price', 'Free')
      : fee
        ? h('span.b-price', [fee.discounted ? h('s', money(fee.base)) : null, ' ', money(fee.current)])
        : h('span.b-price.b-muted', '…');
    const on = a.draft.tier === tier.key;
    list.append(h('button.b-choice.b-tier', { type: 'button', class: on ? 'on' : '', dataset: { tier: tier.key }, onClick: () => { a.setDraft({ tier: tier.key, day: tier.key === 'STANDARD' ? a.draft.day : null, window: tier.key === 'STANDARD' ? a.draft.window : null }); a.next(); } }, [h('span', [h('b', tier.name), h('small', tier.line)]), price]));
  }
  const promo = feeFor('EXPRESS', pricing);
  return h('section.b-screen', [
    head('How soon?', 'The fee is NOHM’s. The pro’s own price comes as an estimate you approve before work starts.'),
    list,
    promo && promo.discounted ? h('p.b-small', promo.promoLabel ? `${promo.promoLabel}: half off until the launch target is reached.` : 'Launch prices, until 1,000 homeowners join.') : null,
    h('p.b-small', 'Express and NOHM Now hold the fee on your card when a pro sets out; nothing is charged if nobody can come.'),
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
      winList.append(h('button.b-choice', { type: 'button', class: on ? 'on' : '', disabled: !open, dataset: { window: w.key }, onClick: () => { win = w.key; drawWindows(); err.textContent = ''; } }, [h('span', [h('b', w.name), h('small', open ? w.range : `${w.range} · passed`)]), w.premiumCents ? h('span.b-price', `+${money(w.premiumCents)}`) : null]));
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
  return h('section.b-screen', [head('When should the pro come?', 'Pick a day and an arrival window. Free to cancel up to 24 hours before.'), dayRow, winList, h('p.b-small', 'Late afternoon adds a $20 premium, held when your pro accepts.'), err, footer(a, go)]);
}

// ── 6. Account ────────────────────────────────────────────────────

export function accountScreen(a) {
  const wrap = h('section.b-screen');
  let mode = a.state.accountMode || 'signup';
  const err = h('p.b-err', { role: 'alert' });

  function tabs() {
    return h('div.b-tabs', [
      h('button.b-tab', { type: 'button', class: mode === 'signup' ? 'on' : '', onClick: () => { mode = 'signup'; draw(); } }, 'New to NOHM'),
      h('button.b-tab', { type: 'button', class: mode === 'signin' ? 'on' : '', onClick: () => { mode = 'signin'; draw(); } }, 'Sign in'),
    ]);
  }

  function googleRow() {
    if (!a.config.googleClientId) return null;
    const host = h('div.b-google');
    mountGoogleButton({ host, clientId: a.config.googleClientId, onToken: (idToken) => a.run(() => a.account.google(idToken), err) }).catch(() => (host.hidden = true));
    return h('div', [host, h('p.b-or', 'or')]);
  }

  function signupForm() {
    const f = {
      firstName: field({ label: 'First name', name: 'firstName', autocomplete: 'given-name' }),
      lastName: field({ label: 'Last name', name: 'lastName', autocomplete: 'family-name' }),
      email: field({ label: 'Email', name: 'email', type: 'email', autocomplete: 'email', inputmode: 'email' }),
      phone: field({ label: 'Mobile number', name: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', hint: 'We text a code to this number. Your pro reaches you here.' }),
      password: field({ label: 'Password', name: 'password', type: 'password', autocomplete: 'new-password', hint: 'At least 8 characters.' }),
    };
    const btn = button('Text me a code', { key: 'signup' });
    const submit = async (e) => {
      e && e.preventDefault();
      const values = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.value]));
      const problems = signupProblems(values);
      Object.entries(f).forEach(([k, v]) => v.setError(problems[k]));
      if (Object.keys(problems).length) return;
      const body = signupBody(values);
      btn.busy(true, 'Sending…');
      try {
        const exists = await a.api.auth.checkExists(body.email);
        if (exists && exists.exists) { f.email.setError('That email already has a NOHM account. Sign in instead.'); return; }
        await a.api.auth.emailSignupSendOtp(body);
        a.state.pendingSignup = body;
        mode = 'signup-code';
        draw();
      } catch (ex) {
        err.textContent = ex.status === 409 ? 'That email or phone already has a NOHM account. Sign in instead.' : ex.message;
      } finally {
        btn.busy(false);
      }
    };
    btn.addEventListener('click', submit);
    return h('form.b-form', { onSubmit: submit, novalidate: true }, [h('div.b-two', [f.firstName.el, f.lastName.el]), f.email.el, f.phone.el, f.password.el, btn, h('p.b-small', ['By continuing you agree to NOHM’s ', h('a', { href: '/terms' }, 'Terms'), ' and ', h('a', { href: '/privacy' }, 'Privacy Policy'), '. Message and data rates may apply; see ', h('a', { href: '/sms' }, 'SMS terms'), '.'])]);
  }

  function codeForm({ phone, onCode, onResend }) {
    const code = field({ label: `Code we texted ${prettyPhone(phone)}`, name: 'code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6 });
    const btn = button('Verify', { key: 'verify' });
    const submit = async (e) => {
      e && e.preventDefault();
      if (!/^\d{4,6}$/.test(code.value.trim())) return code.setError('The code from the text.');
      btn.busy(true, 'Checking…');
      try { await onCode(code.value.trim()); } catch (ex) { code.setError(ex.message); } finally { btn.busy(false); }
    };
    btn.addEventListener('click', submit);
    setTimeout(() => code.input.focus(), 0);
    return h('form.b-form', { onSubmit: submit, novalidate: true }, [code.el, btn, onResend ? h('button.b-link', { type: 'button', onClick: () => a.run(onResend, err, 'Sent another code.') }, 'Send a new code') : null, h('button.b-link', { type: 'button', onClick: () => { mode = 'signup'; draw(); } }, 'Change my details')]);
  }

  function signinForm() {
    const email = field({ label: 'Email', name: 'email', type: 'email', autocomplete: 'email', inputmode: 'email' });
    const pw = field({ label: 'Password', name: 'password', type: 'password', autocomplete: 'current-password' });
    const btn = button('Sign in', { key: 'signin' });
    const submit = async (e) => {
      e && e.preventDefault();
      if (!email.value.trim()) return email.setError('Your email');
      if (!pw.value) return pw.setError('Your password');
      btn.busy(true, 'Signing in…');
      try {
        const res = await a.api.auth.loginEmailPassword(email.value.trim().toLowerCase(), pw.value);
        if (res.status === 'otp_required') {
          a.state.pendingLogin = { email: email.value.trim().toLowerCase(), maskedPhone: res.maskedPhone };
          mode = 'signin-code';
          draw();
          return;
        }
        await a.account.signedIn(res);
      } catch (ex) {
        err.textContent = ex.status === 401 || ex.status === 400 ? 'That email and password don’t match.' : ex.message;
      } finally {
        btn.busy(false);
      }
    };
    btn.addEventListener('click', submit);
    const phoneBtn = h('button.b-link', { type: 'button', onClick: () => { mode = 'signin-phone'; draw(); } }, 'Sign in with a text code instead');
    return h('form.b-form', { onSubmit: submit, novalidate: true }, [email.el, pw.el, btn, phoneBtn]);
  }

  function phoneSigninForm() {
    const phone = field({ label: 'Mobile number', name: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel' });
    const btn = button('Text me a code', { key: 'phone' });
    const submit = async (e) => {
      e && e.preventDefault();
      const e164 = toE164US(phone.value);
      if (!e164) return phone.setError('A US mobile number');
      btn.busy(true, 'Sending…');
      try {
        await a.api.auth.loginSendOtp(e164);
        a.state.pendingLogin = { phone: e164 };
        mode = 'signin-phone-code';
        draw();
      } catch (ex) { err.textContent = ex.message; } finally { btn.busy(false); }
    };
    btn.addEventListener('click', submit);
    return h('form.b-form', { onSubmit: submit, novalidate: true }, [phone.el, btn, h('button.b-link', { type: 'button', onClick: () => { mode = 'signin'; draw(); } }, 'Use my password instead')]);
  }

  function draw() {
    clear(wrap);
    err.textContent = '';
    a.state.accountMode = mode;
    const title = mode.startsWith('signin') ? 'Welcome back' : 'Create your NOHM account';
    const sub = mode.startsWith('signin') ? 'Your request is saved. Sign in to send it.' : 'Takes a minute. Your request is saved while you do.';
    const body = [];
    if (mode === 'signup') body.push(googleRow(), signupForm());
    else if (mode === 'signup-code') body.push(codeForm({ phone: a.state.pendingSignup.phone, onCode: async (code) => a.account.signedIn(await a.api.auth.emailSignupVerify(a.state.pendingSignup, code)), onResend: () => a.api.auth.emailSignupSendOtp(a.state.pendingSignup) }));
    else if (mode === 'google-phone') {
      const phone = field({ label: 'Mobile number', name: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', hint: 'One more step: we text a code so your pro can reach you.' });
      const btn = button('Text me a code', { key: 'gphone' });
      btn.addEventListener('click', () => {
        const e164 = toE164US(phone.value);
        if (!e164) return phone.setError('A US mobile number');
        a.run(async () => { await a.api.auth.socialSignupSendOtp(e164); a.state.pendingGoogle.phone = e164; mode = 'google-code'; draw(); }, err);
      });
      body.push(h('form.b-form', { onSubmit: (e) => e.preventDefault() }, [h('p.b-line', `Hi ${a.state.pendingGoogle.firstName || ''}, Google checked out.`), phone.el, btn]));
    } else if (mode === 'google-code') body.push(codeForm({ phone: a.state.pendingGoogle.phone, onCode: async (code) => a.account.signedIn(await a.api.auth.googleSignupWithPhone(a.state.pendingGoogle.idToken, a.state.pendingGoogle.phone, code)), onResend: () => a.api.auth.socialSignupSendOtp(a.state.pendingGoogle.phone) }));
    else if (mode === 'signin') body.push(googleRow(), signinForm());
    else if (mode === 'signin-code') body.push(h('p.b-line', `New browser. We texted a code to ${a.state.pendingLogin.maskedPhone || 'your phone'}.`), codeForm({ phone: a.state.pendingLogin.maskedPhone || '', onCode: async (code) => a.account.signedIn(await a.api.auth.loginVerifyDeviceOtp(a.state.pendingLogin.email, code)) }));
    else if (mode === 'signin-phone') body.push(phoneSigninForm());
    else if (mode === 'signin-phone-code') body.push(codeForm({ phone: a.state.pendingLogin.phone, onCode: async (code) => a.account.signedIn(await a.api.auth.loginVerifyOtp(a.state.pendingLogin.phone, code)), onResend: () => a.api.auth.loginSendOtp(a.state.pendingLogin.phone) }));
    append(wrap, [head(title, sub), mode === 'signup' || mode === 'signin' ? tabs() : null, ...body, err, footer(a, null)]);
  }
  draw();
  return wrap;
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
        if (check.isMultiFamily) {
          mode = 'in-app';
          a.state.homeNote = 'Looks like an apartment or multi-unit building. Picking your unit happens in the app.';
          return draw();
        }
        const shell = await a.api.properties.shell({ googlePlaceId: d.placeId, formattedAddress: d.formattedAddress, latitude: d.latitude, longitude: d.longitude });
        const home = await a.api.properties.confirmSingle(shell.id);
        a.state.property = home;
        a.state.properties = [...(a.state.properties || []), home];
        a.setDraft({ propertyId: home.id });
        mode = 'added';
        draw();
      }, err);
    }
    return h('div', [h('div.b-searchwrap', [svg('M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10zM12 8.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'), q]), results, h('p.b-small', 'Your home gets a Home Identification Number: one record for every repair, pro and part, for as long as the house stands.')]);
  }

  function draw() {
    clear(wrap);
    err.textContent = '';
    if (mode === 'pick') append(wrap, [head('Which home?', 'The pro is coming to:'), pickList(), err, footer(a, null)]);
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
  mountCardForm({ host, publishableKey: a.config.stripePublishableKey, api: a.api, name: a.state.user ? `${a.state.user.firstName || ''} ${a.state.user.lastName || ''}`.trim() : undefined })
    .then((f) => {
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
    head('A card on file', a.draft.tier === 'STANDARD' ? 'Nothing is charged now. It’s how you approve the pro’s estimate later, with no cash at the door.' : `Nothing is charged now. The ${money(fee ? fee.current : 0)} fee is held when a pro sets out.`),
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
  a.api.jobs.cancellationTerms(d.tier === 'STANDARD' ? { scheduledDate: d.day, scheduledTimeWindow: d.window } : d.tier === 'EXPRESS' ? { isExpress: 'true' } : { priority: 'NOW' }).then((t) => (terms.textContent = (t && t.disclosure) || '')).catch(() => (terms.textContent = ''));

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
      h('div.b-row.b-total', [h('span', 'NOHM fee'), h('span', [fee && fee.discounted ? h('s', money(fee.base)) : null, ' ', fee ? (fee.current ? money(fee.current) : 'Free') : '…'])]),
      win && win.premiumCents ? h('div.b-row', [h('span.b-muted', 'Late afternoon premium'), h('span', `+${money(win.premiumCents)}`)]) : null,
    ]),
    h('p.b-small', d.tier === 'STANDARD' ? 'No NOHM fee. Your pro’s estimate comes to you for approval before any work starts.' : 'The fee is held when a pro sets out and released if nobody can come.'),
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
      if (polls < 40) setTimeout(load, 15000);
    } catch (ex) { err.textContent = ex.message; }
  }
  async function dispatch(p) {
    stopped = true;
    await a.dispatchNow(p.availabilityId, err);
    stopped = false;
  }
  load();
  append(wrap, [head('Who’s ready now', `${a.draft.trade.label} · ${money(feeFor('NOW', a.state.pricing).current)} NOHM Now fee`), note, list, err, footer(a, null)]);
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

  const what = d.tier === 'NOW'
    ? 'Your pro has the job and is getting ready to leave. Track them, chat, and get your door PIN in the app.'
    : d.tier === 'EXPRESS'
      ? 'The closest pro has 90 seconds to accept; if they pass, the next one gets it. Watch it happen in the app.'
      : 'Here are the pros who can take it. Pick one and the job is theirs to accept.';

  async function loadOffers() {
    if (d.tier !== 'STANDARD') return;
    try {
      const j = await a.api.jobs.get(job.id);
      if (j.status === 'NO_CONTRACTOR_AVAILABLE') {
        status.textContent = 'No pro can take this one yet. We keep looking and text you the moment one can.';
        return;
      }
      const r = await a.api.jobs.matchedContractors(job.id);
      const offers = (r && r.offers) || [];
      if (!offers.length) {
        if (++tries < 10) { status.textContent = 'Finding pros near you…'; return setTimeout(loadOffers, 2000); }
        status.textContent = 'Still matching. We text you when a pro is ready; you can also pick one in the app.';
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
      status.textContent = `${name} has your request and a short window to accept. We text you either way; the app shows it live.`;
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
    h('p.b-small', ['We text ', a.state.user ? prettyPhone(a.state.user.phone) : 'you', ' at every step. ', h('a', { href: '/book', onClick: (e) => { e.preventDefault(); a.restart(); } }, 'Book something else')]),
  );
  return wrap;
}
