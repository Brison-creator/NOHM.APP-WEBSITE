// nohm.app/go/landlords: the email form, for a landlord not ready to
// download. It goes to NOHM (POST /waitlist/landlord): the landlord is
// emailed the app's links and NOHM's inbox gets the lead. Rules in lead.js.

import { createSession } from '../../nohm/session.js';
import { createHttp } from '../../nohm/http.js';
import { createApi, apiBaseFor } from '../../nohm/api.js';
import { createWebConfig } from '../../nohm/web-config.js';
import { h, clear, field, button } from '../../nohm/dom.js';
import { humanCheck, TICK_FIRST } from '../../nohm/human.js';
import { addFormTrap } from '../../nohm/form-traps.js';
import { leadProblems, leadSource, leadBody, leadError } from './lead.js';

const config = window.NOHM_BOOK;
const root = document.getElementById('lead-form');
const apiBase = apiBaseFor(location.hostname, location.search, config.apiBase);
const session = createSession(window.localStorage, { deviceName: navigator.userAgent.slice(0, 80) });
const http = createHttp({ baseUrl: apiBase, session });
const webConfig = createWebConfig(createApi(http, session));
const source = leadSource(location.search);

function sent() {
  clear(root);
  root.append(
    h('p.lead-done', 'Sent. Check your inbox for the App Store and Google Play links.'),
    h('p.b-small', 'Questions? Call or text 888-230-NOHM.'),
  );
  // Counted in the site's access logs (tools/ads/report.py): no name or email in it.
  fetch(`/go/landlords/?lead=sent&src=${encodeURIComponent(source)}`, { method: 'HEAD', cache: 'no-store' }).catch(() => {});
}

function form() {
  const f = {
    name: field({ label: 'Your name', name: 'name', autocomplete: 'name', maxlength: 80 }),
    email: field({ label: 'Email', name: 'email', type: 'email', autocomplete: 'email', inputmode: 'email', maxlength: 254 }),
  };
  const err = h('p.b-err', { role: 'alert' });
  const hc = humanCheck(webConfig);
  const btn = button('Email me the links', { key: 'lead-send', submit: true });
  const submit = async (e) => {
    e && e.preventDefault();
    err.textContent = '';
    const values = { name: f.name.value, email: f.email.value };
    const problems = leadProblems(values);
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
      await http.post('/waitlist/landlord', { ...leadBody(values, source), humanToken: hc.token(), ...trap.fields() }, { auth: false });
      sent();
    } catch (ex) {
      // A throwaway email (the spam checks) is said under the email field.
      if (ex && ex.code === 'BAD_EMAIL') { f.email.setError(ex.message); f.email.input.focus(); }
      else err.textContent = leadError(ex);
      btn.busy(false);
      hc.reset();
    }
  };
  const formEl = h('form.b-form', { onSubmit: submit, novalidate: true }, [
    f.name.el,
    f.email.el,
    hc.el,
    err,
    btn,
    h('p.b-small', ['We’ll only email you about NOHM. ', h('a', { href: '/privacy' }, 'Privacy'), '.']),
  ]);
  // Timed from when the form is shown.
  const trap = addFormTrap(formEl);
  return formEl;
}

clear(root);
root.append(form());
