// /book steps 7 and 8: the home the pro comes to (pick one, or add one:
// address → check → shell → confirm, which issues the HIN), and the card
// on file (Stripe, with the key the server publishes).

import { h, append, button, money, clear } from '../../nohm/dom.js';
import { homeId } from '../../nohm/format.js';
import { feeFor } from '../lib/flow.js';
import { mountCardForm } from './card.js';
import { CARD_UNAVAILABLE } from '../../nohm/web-config.js';
import { svg, head, footer } from './parts.js';

// ── 7. Home ───────────────────────────────────────────────────────

export function homeScreen(a) {
  const wrap = h('section.b-screen');
  const err = h('p.b-err', { role: 'alert' });
  let mode = a.state.properties && a.state.properties.length ? 'pick' : 'add';

  function pickList() {
    const list = h('div.b-list');
    for (const p of a.state.properties) {
      list.append(h('button.b-choice', { type: 'button', class: a.draft.propertyId === p.id ? 'on' : '', dataset: { property: p.id }, onClick: () => { a.setDraft({ propertyId: p.id }); a.state.property = p; a.next(); } }, [h('span', [h('b', p.formattedAddress), h('small', p.hin ? `Home ID ${homeId(p.hin)}` : 'Home record pending')]), h('span.b-chev', '›')]));
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
      append(wrap, [head('Your home is on NOHM.', p.hin ? `Home ID ${homeId(p.hin)}` : ''), h('div.b-card', [h('b', p.formattedAddress), h('p', 'Every repair from here on lands in this home’s record.')]), footer(a, () => a.next())]);
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
  // The key is the server's (GET /config/web); without it there is no card form.
  a.webConfig()
    .then((cfg) => {
      if (!cfg.stripePublishableKey) throw new Error(CARD_UNAVAILABLE);
      if (gone) return null;
      return mountCardForm({ host, publishableKey: cfg.stripePublishableKey, api: a.api, name: a.state.user ? `${a.state.user.firstName || ''} ${a.state.user.lastName || ''}`.trim() : undefined });
    })
    .then((f) => {
      if (!f) return;
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
