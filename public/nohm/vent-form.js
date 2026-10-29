// "Vent to us" on /go/landlords and /for/landlords: one box and Submit,
// sent to the server's POST /feedback/vent. Every element marked
// data-vent="<page>" (go/landlords, for/landlords) becomes the form.
//
// Signed out on purpose: no token or session goes with it, even for
// someone signed in on /book, and nothing about the sender is asked or
// sent. The words are never counted or logged by the page (track.js only
// counts that the part was seen). Elements and textContent only, never
// innerHTML. Rules in vent.js.

import { createHttp } from './http.js';
import { apiBaseFor } from './api.js';
import { h, clear } from './dom.js';
import { addFormTrap } from './form-traps.js';
import { ventProblem, ventBody, ventError, VENT_MAX, VENT_THANKS } from './vent.js';

const config = window.NOHM_BOOK || {};
const apiBase = apiBaseFor(location.hostname, location.search, config.apiBase);
const NO_SESSION = { accessToken: null, refreshToken: null, clear() {}, setTokens() {} };
const http = createHttp({ baseUrl: apiBase, session: NO_SESSION });

function mount(root) {
  const page = root.getAttribute('data-vent');
  const id = `vent-${page.replace(/[^a-z0-9]+/g, '-')}`;
  const box = h('textarea.vent-text', {
    id,
    rows: 5,
    maxLength: VENT_MAX,
    placeholder: 'Type it here.',
    'aria-label': 'What frustrates you about being a landlord?',
    'aria-describedby': `${id}-err`,
  });
  const err = h('p.vent-err', { id: `${id}-err`, role: 'alert' });
  const btn = h('button.btn', { type: 'submit' }, 'Submit');
  let sending = false;

  const send = async (e) => {
    e.preventDefault();
    if (sending) return;
    err.textContent = '';
    const problem = ventProblem(box.value);
    if (problem) {
      err.textContent = problem;
      box.focus();
      return;
    }
    sending = true;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await http.post('/feedback/vent', ventBody(box.value, page, trap.fields()), { auth: false });
      clear(root);
      root.append(h('p.vent-done', { role: 'status' }, VENT_THANKS));
    } catch (ex) {
      err.textContent = ventError(ex);
      btn.disabled = false;
      btn.textContent = 'Submit';
      sending = false;
    }
  };

  box.addEventListener('input', () => {
    if (err.textContent) err.textContent = '';
  });
  const form = h('form.vent-form', { onSubmit: send, novalidate: true }, [box, err, btn]);
  // The spam checks' decoy and clock (nohm/form-traps.js), timed from now.
  const trap = addFormTrap(form);
  clear(root);
  root.append(form);
}

document.querySelectorAll('[data-vent]').forEach(mount);
