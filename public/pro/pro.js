// nohm.app/pro: the supply-house flyer's sign-up. The short form goes to
// NOHM (POST /recruit/interest: a lead to call back and an email to the
// founder), then the pro is sent on to the full sign-up at /join with
// what they typed filled in (nohm/pro-prefill.js). Rules in lib/form.js.

import { createSession } from '../nohm/session.js';
import { createHttp } from '../nohm/http.js';
import { createApi, apiBaseFor } from '../nohm/api.js';
import { createWebConfig } from '../nohm/web-config.js';
import { h, clear, field, button } from '../nohm/dom.js';
import { humanCheck, TICK_FIRST } from '../nohm/human.js';
import { addFormTrap } from '../nohm/form-traps.js';
import { savePrefill } from '../nohm/pro-prefill.js';
import { interestProblems, interestBody, interestError, sourceFrom } from './lib/form.js';

const config = window.NOHM_BOOK;
const root = document.getElementById('pro-form');
const apiBase = apiBaseFor(location.hostname, location.search, config.apiBase);
const session = createSession(window.localStorage, { deviceName: navigator.userAgent.slice(0, 80) });
const http = createHttp({ baseUrl: apiBase, session });
const api = createApi(http, session);
const webConfig = createWebConfig(api);
const source = sourceFrom(location.search);

/** On to the full sign-up (a local test server's ?api= goes along). */
function joinUrl() {
  const next = new URLSearchParams({ from: 'pro' });
  const local = new URLSearchParams(location.search).get('api');
  if (local && apiBase === local) next.set('api', local);
  return `/join/?${next}`;
}

function tradeSelect(trades) {
  const sel = h('select', { name: 'tradeId', id: 'f-tradeId' }, [h('option', { value: '' }, 'Pick one'), ...trades.map((t) => h('option', { value: t.id }, t.label))]);
  const err = h('span.b-err', { id: 'e-tradeId', role: 'alert' });
  const el = h('label.b-field', { htmlFor: 'f-tradeId' }, [h('span.b-label', 'Your main trade'), sel, err]);
  return { el, input: sel, get value() { return sel.value; }, setError(m) { err.textContent = m || ''; el.classList.toggle('bad', Boolean(m)); } };
}

function form(trades) {
  const f = {
    firstName: field({ label: 'First name', name: 'firstName', autocomplete: 'given-name', maxlength: 60 }),
    lastName: field({ label: 'Last name', name: 'lastName', autocomplete: 'family-name', maxlength: 60 }),
    phone: field({ label: 'Mobile number', name: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel' }),
    email: field({ label: 'Email (optional)', name: 'email', type: 'email', autocomplete: 'email', inputmode: 'email' }),
    tradeId: tradeSelect(trades),
    zip: field({ label: 'Your ZIP', name: 'zip', inputmode: 'numeric', autocomplete: 'postal-code', maxlength: 5 }),
    businessName: field({ label: 'Business name (optional)', name: 'businessName', autocomplete: 'organization', maxlength: 40 }),
  };
  const err = h('p.b-err', { role: 'alert' });
  const hc = humanCheck(webConfig);
  const btn = button('Apply', { key: 'pro-continue', submit: true });
  const submit = async (e) => {
    e && e.preventDefault();
    err.textContent = '';
    const values = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.value]));
    const problems = interestProblems(values);
    Object.entries(f).forEach(([k, v]) => v.setError(problems[k]));
    if (Object.keys(problems).length) {
      const first = Object.keys(f).find((k) => problems[k]);
      if (first) f[first].input.focus();
      return;
    }
    if (hc.needed() && !hc.token()) { err.textContent = TICK_FIRST; return; }
    btn.busy(true, 'Sending…');
    try {
      // `formTrap`: the spam checks' decoy and time on screen (nohm/form-traps.js).
      await http.post('/recruit/interest', { ...interestBody(values, source), humanToken: hc.token(), ...trap.fields() }, { auth: false });
      savePrefill(window.sessionStorage, values);
      location.assign(joinUrl());
    } catch (ex) {
      // A throwaway email (the spam checks) is said under the email field.
      if (ex && ex.code === 'BAD_EMAIL' && values.email) { f.email.setError(ex.message); f.email.input.focus(); }
      else err.textContent = interestError(ex);
      btn.busy(false);
      hc.reset();
    }
  };
  const formEl = h('form.b-form', { onSubmit: submit, novalidate: true }, [
    h('div.b-two', [f.firstName.el, f.lastName.el]),
    f.phone.el,
    f.email.el,
    f.tradeId.el,
    h('div.b-two', [f.zip.el, f.businessName.el]),
    hc.el,
    err,
    btn,
    h('p.b-small', ['By continuing you agree that NOHM can call, text or email you about joining. Msg & data rates may apply. Tell us to stop anytime and we will. ', h('a', { href: '/terms' }, 'Terms'), ' · ', h('a', { href: '/privacy' }, 'Privacy'), '.']),
  ]);
  // Timed from when the form is shown (boot() puts it on the page right away).
  const trap = addFormTrap(formEl);
  return formEl;
}

async function boot() {
  try {
    const trades = (await api.trades()).filter((t) => t.isActive !== false);
    clear(root);
    root.append(form(trades));
  } catch {
    clear(root);
    root.append(
      h('p.b-sub', 'The form didn’t load. Sign up right here instead, or call or text 501-618-0026.'),
      h('a.b-btn', { href: joinUrl() }, 'Sign up'),
    );
  }
}

boot();
