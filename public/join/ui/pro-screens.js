// One function per step of /join (pros). Each gets the app `a` and
// returns the screen. The server's dashboard is the truth about where
// the person is; these screens show it and send the next thing.

import { h, append, field, button, clear } from '../../nohm/dom.js';
import { RADII, DOC_TYPES, docTypesFor, profileProblems, profileBody, profileFormFrom, submitBlockers, docsMissing, statusCopy, attestationProblem } from '../lib/pro-flow.js';
import { prettyPhone } from '../../nohm/format.js';

const LOCAL_STUB = /^(localhost|127\.0\.0\.1)$/;

function head(title, sub) {
  return h('header.b-head', [h('h1.b-h1', title), sub ? h('p.b-sub', sub) : null]);
}
function foot(a, next, { label = 'Continue', disabled = false, skip } = {}) {
  return h('div.b-foot', [a.canGoBack() ? button('Back', { kind: 'sec', onClick: () => a.back() }) : skip ? button(skip.label, { kind: 'sec', onClick: skip.onClick }) : null, next ? button(label, { onClick: next, disabled, key: 'next' }) : null]);
}

/** Step dots across the top of every screen after the account. */
export function stepsBar(current) {
  const names = [['profile', 'Profile'], ['documents', 'Documents'], ['payouts', 'Payouts'], ['agreement', 'Agreement'], ['review', 'Submit']];
  const idx = names.findIndex(([k]) => k === current);
  return h('ol.b-steps', names.map(([k, label], i) => h('li', { class: i < idx ? 'done' : i === idx ? 'now' : '' }, label)));
}

// ── Profile + trades ──────────────────────────────────────────────

export function profileScreen(a) {
  const f0 = profileFormFrom(a.state.dashboard, a.state.user);
  const trades = a.state.trades;
  const tradeSelect = (name, label, value, allowNone) => {
    const sel = h('select', { name, id: `f-${name}` }, [allowNone ? h('option', { value: '' }, 'None') : h('option', { value: '' }, 'Pick one'), ...trades.map((t) => h('option', { value: t.id, selected: t.id === value }, t.label + (t.licenseRequired ? ' (license required)' : '')))]);
    const err = h('span.b-err', { id: `e-${name}` });
    const el = h('label.b-field', { htmlFor: `f-${name}` }, [h('span.b-label', label), sel, err]);
    return { el, input: sel, get value() { return sel.value; }, setError(m) { err.textContent = m || ''; el.classList.toggle('bad', Boolean(m)); } };
  };
  const radius = (() => {
    let val = Number(f0.serviceRadius) || 20;
    const chips = h('div.b-chips');
    const err = h('span.b-err');
    const draw = () => { clear(chips); for (const r of RADII) chips.append(h('button.b-chip', { type: 'button', class: r === val ? 'on' : '', dataset: { radius: r }, onClick: () => { val = r; draw(); } }, `${r} miles`)); };
    draw();
    return { el: h('div.b-field', [h('span.b-label', 'How far you’ll drive from that ZIP'), chips, err]), get value() { return val; }, setError(m) { err.textContent = m || ''; } };
  })();

  const f = {
    firstName: field({ label: 'First name', name: 'firstName', value: f0.firstName, autocomplete: 'given-name' }),
    lastName: field({ label: 'Last name', name: 'lastName', value: f0.lastName, autocomplete: 'family-name' }),
    businessName: field({ label: 'Business name', name: 'businessName', value: f0.businessName, maxlength: 40, hint: 'What homeowners see. Your own name is fine if you work solo.' }),
    primaryTradeId: tradeSelect('primaryTradeId', 'Your main trade', f0.primaryTradeId, false),
    secondaryTradeId: tradeSelect('secondaryTradeId', 'A second trade (optional)', f0.secondaryTradeId, true),
    baseZip: field({ label: 'Home base ZIP', name: 'baseZip', value: f0.baseZip, inputmode: 'numeric', maxlength: 5, autocomplete: 'postal-code' }),
    serviceRadius: radius,
    yearsExperience: field({ label: 'Years in the trade', name: 'yearsExperience', value: String(f0.yearsExperience), inputmode: 'numeric', maxlength: 2 }),
    licenseNumber: field({ label: 'License number (if your trade needs one)', name: 'licenseNumber', value: f0.licenseNumber, maxlength: 50 }),
    serviceCallFeeRange: field({ label: 'Service call fee', name: 'serviceCallFeeRange', value: f0.serviceCallFeeRange, placeholder: '$89', maxlength: 20, hint: 'What you charge to come out, before any work.' }),
    hourlyRateRange: field({ label: 'Hourly rate', name: 'hourlyRateRange', value: f0.hourlyRateRange, placeholder: '$95', maxlength: 20 }),
    bio: field({ label: 'About you (optional)', name: 'bio', type: 'textarea', value: f0.bio, maxlength: 500, placeholder: 'What you do best, how long you’ve done it, what homeowners can expect.' }),
  };
  f.bio.input.rows = 3;
  const err = h('p.b-err', { role: 'alert' });
  const btn = button('Save and continue', { key: 'next', submit: true });
  const submit = async (e) => {
    e && e.preventDefault();
    const values = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.value]));
    const problems = profileProblems(values);
    Object.entries(f).forEach(([k, v]) => v.setError(problems[k]));
    if (Object.keys(problems).length) { err.textContent = 'A few fields need a look.'; return; }
    btn.busy(true, 'Saving…');
    try {
      await a.api.contractors.updateProfile(profileBody(values));
      await a.refresh();
      a.go('documents');
    } catch (ex) { err.textContent = ex.message; } finally { btn.busy(false); }
  };
  return h('section.b-screen', [
    stepsBar('profile'),
    head('Your profile', 'What homeowners see when you take their job.'),
    h('form.b-form', { onSubmit: submit, novalidate: true }, [h('div.b-two', [f.firstName.el, f.lastName.el]), f.businessName.el, f.primaryTradeId.el, f.secondaryTradeId.el, h('div.b-two', [f.baseZip.el, f.yearsExperience.el]), f.serviceRadius.el, f.licenseNumber.el, h('div.b-two', [f.serviceCallFeeRange.el, f.hourlyRateRange.el]), f.bio.el, err, h('div.b-foot', [a.canGoBack() ? button('Back', { kind: 'sec', onClick: () => a.back() }) : null, btn])]),
  ]);
}

// ── Documents ─────────────────────────────────────────────────────

export function documentsScreen(a) {
  const dash = a.state.dashboard || {};
  const docs = (dash.documents || []).reduce((m, d) => ((m[d.docType] = d), m), {});
  const list = h('div.b-list');
  const err = h('p.b-err', { role: 'alert' });
  const locked = dash.applicationStatus === 'PENDING_DOC_REVIEW' || dash.applicationStatus === 'PENDING_BG_CHECK';

  for (const type of docTypesFor(dash.tradeLicenseRequired)) {
    const meta = DOC_TYPES[type];
    const have = docs[type];
    const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/heic,image/heif,application/pdf', hidden: true, id: `f-doc-${type}` });
    const state = h('small', have ? (have.reviewStatus === 'REJECTED' ? `Rejected${have.rejectionNotes ? `: ${have.rejectionNotes}` : ''}. Upload a new one.` : have.reviewStatus === 'APPROVED' ? 'Approved' : 'Uploaded, waiting for review') : meta.line);
    const row = h('div.b-choice.b-doc', { class: have && have.reviewStatus !== 'REJECTED' ? 'on' : '', dataset: { doc: type } }, [
      h('span', [h('b', [meta.label, meta.required ? '' : h('span.b-muted', ' · optional')]), state]),
      locked ? null : h('button.b-btn.sec.b-mini', { type: 'button', onClick: () => input.click(), dataset: { upload: type } }, have ? 'Replace' : 'Upload'),
      input,
    ]);
    input.addEventListener('change', async () => {
      const file = input.files[0];
      input.value = '';
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) return (err.textContent = `${file.name} is over 10 MB.`);
      state.textContent = 'Uploading…';
      try {
        await a.api.contractors.uploadDocument(type, file);
        await a.refresh();
        a.rerender();
      } catch (ex) { err.textContent = ex.message; state.textContent = meta.line; }
    });
    list.append(row);
  }
  const missing = docsMissing(dash.checklist, dash.tradeLicenseRequired).filter((t) => DOC_TYPES[t].required);
  return h('section.b-screen', [
    stepsBar('documents'),
    head('Your documents', 'A headshot and driver’s license are needed before you can take jobs. The rest can wait, but they speed up review.'),
    list,
    err,
    h('p.b-small', 'JPEG, PNG, HEIC or PDF, up to 10 MB. Reviewed by NOHM, never shown to homeowners (except the headshot).'),
    foot(a, () => a.go('payouts'), { label: missing.length ? 'Continue, upload later' : 'Continue' }),
  ]);
}

// ── Payouts (Stripe Connect) ──────────────────────────────────────

export function payoutsScreen(a) {
  const dash = a.state.dashboard || {};
  const err = h('p.b-err', { role: 'alert' });
  const status = h('p.b-line');
  const btn = button('Set up payouts with Stripe', { key: 'stripe' });
  let polling = null;

  async function check() {
    try {
      const s = await a.api.stripeConnect.status();
      if (s.stripeComplete) {
        clearInterval(polling);
        await a.refresh();
        a.go('agreement');
        return true;
      }
      if (s.hasAccount) { status.textContent = 'Stripe still needs something: open it again to finish.'; btn.busy(false); btn.textContent = 'Finish Stripe setup'; }
    } catch (ex) { err.textContent = ex.message; }
    return false;
  }
  btn.addEventListener('click', async () => {
    // Open the tab inside the tap (iOS Safari and popup blockers refuse a
    // window.open that comes after an await), then send it to Stripe once
    // the server returns the link. If it was blocked anyway, the link is
    // shown to tap instead.
    const tab = window.open('', '_blank');
    btn.busy(true, 'Opening Stripe…');
    try {
      const s = await a.api.stripeConnect.status().catch(() => ({ hasAccount: false }));
      const link = s.hasAccount ? await a.api.stripeConnect.refresh() : await a.api.stripeConnect.create();
      const url = new URL(link.url);
      if (!/\.stripe\.com$/.test(url.hostname) && !LOCAL_STUB.test(url.hostname)) throw new Error('That link didn’t come from Stripe.');
      if (tab) {
        tab.opener = null;
        tab.location.href = url.href;
        status.textContent = 'Stripe opened in a new tab. Finish there; this page updates on its own.';
      } else {
        clear(status);
        append(status, ['Your browser blocked the new tab. ', h('a', { href: url.href, target: '_blank', rel: 'noopener' }, 'Open Stripe'), ' and finish there; this page updates on its own.']);
      }
      clearInterval(polling);
      polling = setInterval(check, 5000);
      btn.busy(false);
      btn.textContent = 'Reopen Stripe';
    } catch (ex) { if (tab) tab.close(); err.textContent = ex.message; btn.busy(false); }
  });
  if (dash.checklist && dash.checklist.stripeConnect) status.textContent = 'Payouts are set up.';
  else check();
  const onLeave = () => clearInterval(polling);
  a.onLeave(onLeave);

  return h('section.b-screen', [
    stepsBar('payouts'),
    head('Get paid', 'NOHM pays you through Stripe: the homeowner pays NOHM, Stripe deposits to your bank. Takes about five minutes and your ID.'),
    h('div.b-card', [h('b', 'Stripe handles the identity check'), h('p', 'Stripe asks for what it needs to pay you: your details and a bank account. NOHM never sees the numbers.')]),
    status,
    err,
    h('div.b-foot', [a.canGoBack() ? button('Back', { kind: 'sec', onClick: () => a.back() }) : null, dash.checklist && dash.checklist.stripeConnect ? button('Continue', { onClick: () => a.go('agreement'), key: 'next' }) : btn]),
  ]);
}

// ── Agreement ─────────────────────────────────────────────────────

export function agreementScreen(a) {
  const dash = a.state.dashboard || {};
  const user = dash.user || a.state.user || {};
  const name = field({ label: 'Type your full name to sign', name: 'attestedName', autocomplete: 'name', placeholder: `${user.firstName || ''} ${user.lastName || ''}`.trim() });
  const err = h('p.b-err', { role: 'alert' });
  const btn = button('I agree', { key: 'agree' });
  const already = dash.checklist && dash.checklist.attestation;
  btn.addEventListener('click', async () => {
    const p = attestationProblem(name.value);
    if (p) return name.setError(p);
    btn.busy(true, 'Signing…');
    try {
      await a.api.contractors.attestation(name.value.trim());
      await a.refresh();
      a.go('review');
    } catch (ex) { err.textContent = ex.status === 403 ? 'Already signed.' : ex.message; } finally { btn.busy(false); }
  });
  return h('section.b-screen', [
    stepsBar('agreement'),
    head('The NOHM Standard', 'How every NOHM pro works. Read it, then sign with your name.'),
    h('div.b-card.b-standard', [
      h('b', 'The NOHM Standard'),
      h('ul', ['Shows up on time', 'Communicates clearly', 'Price before work', 'Your OK for extras', 'Respects your home', 'Professional work', 'Documents the job', 'Payment in NOHM', 'Makes it right'].map((t) => h('li', t))),
      h('p', 'Same company or someone new, the standard never changes. Pros earn their spot; they can\u2019t buy it. Meeting the Standard keeps you in good standing.'),
      h('p', 'NOHM steps in on no-shows, unsafe conduct and unapproved charges.'),
    ]),
    h('p.b-small', ['The full terms: ', h('a', { href: '/terms' }, 'Terms of Service'), ' · ', h('a', { href: '/step-in' }, 'When NOHM steps in'), '.']),
    already ? h('p.b-line', `Signed${dash.profile && dash.profile.attestedAt ? ` on ${new Date(dash.profile.attestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}.`) : name.el,
    err,
    h('div.b-foot', [a.canGoBack() ? button('Back', { kind: 'sec', onClick: () => a.back() }) : null, already ? button('Continue', { onClick: () => a.go('review'), key: 'next' }) : btn]),
  ]);
}

// ── Review and submit ─────────────────────────────────────────────

export function reviewScreen(a) {
  const dash = a.state.dashboard || {};
  const p = dash.profile || {};
  const blockers = submitBlockers(dash.checklist);
  const missingDocs = docsMissing(dash.checklist, dash.tradeLicenseRequired);
  const err = h('p.b-err', { role: 'alert' });
  const btn = button('Submit for review', { key: 'submit' });
  btn.addEventListener('click', async () => {
    btn.busy(true, 'Submitting…');
    try {
      await a.api.contractors.submitReview();
      await a.refresh();
      a.go('status');
    } catch (ex) { err.textContent = ex.message; btn.busy(false); }
  });
  const row = (label, value, step) => h('div.b-row', [h('span.b-muted', label), h('span', value), step ? h('button.b-edit', { type: 'button', onClick: () => a.go(step) }, 'Edit') : null]);
  return h('section.b-screen', [
    stepsBar('review'),
    head('Ready for review?', 'NOHM looks it over and the result shows here and in the app.'),
    h('div.b-card', [
      row('Business', p.businessName || '', 'profile'),
      row('Trades', (dash.trades || []).map((t) => t.label).join(', '), 'profile'),
      row('Area', p.baseZip ? `${p.baseZip} · ${p.serviceRadius} miles` : '', 'profile'),
      row('Payouts', dash.checklist && dash.checklist.stripeConnect ? 'Stripe connected' : 'Not yet', 'payouts'),
      row('Agreement', dash.checklist && dash.checklist.attestation ? 'Signed' : 'Not yet', 'agreement'),
      row('Documents', missingDocs.length ? `${missingDocs.length} to upload` : 'All uploaded', 'documents'),
    ]),
    blockers.length ? h('div.b-card.alert', [h('b', 'Still to do'), ...blockers.map((b) => h('p', [h('a', { href: '#', onClick: (e) => { e.preventDefault(); a.go(b.step); } }, b.label)]))]) : null,
    missingDocs.length ? h('p.b-small', 'You can submit without documents; the review will ask for the headshot and driver’s license before you take jobs.') : null,
    err,
    h('div.b-foot', [a.canGoBack() ? button('Back', { kind: 'sec', onClick: () => a.back() }) : null, btn]),
  ]);
}

// ── Status ────────────────────────────────────────────────────────

export function statusScreen(a) {
  const dash = a.state.dashboard || {};
  const copy = statusCopy(dash);
  const p = dash.profile || {};
  const missingDocs = docsMissing(dash.checklist, dash.tradeLicenseRequired);
  const rejected = (dash.documents || []).filter((d) => d.reviewStatus === 'REJECTED');
  const canUpload = dash.applicationStatus !== 'PENDING_DOC_REVIEW' && dash.applicationStatus !== 'PENDING_BG_CHECK';
  return h('section.b-screen', [
    head(copy.title, copy.line),
    h('div.b-card', [h('b', p.businessName || ''), h('p', `${dash.contractorId || ''}${dash.trades && dash.trades.length ? ' · ' + dash.trades.map((t) => t.label).join(', ') : ''}`), p.baseZip ? h('p.b-small', `${p.baseZip} · ${p.serviceRadius} miles`) : null]),
    rejected.length ? h('div.b-card.alert', [h('b', 'Needs a new upload'), ...rejected.map((d) => h('p', `${DOC_TYPES[d.docType] ? DOC_TYPES[d.docType].label : d.docType}${d.rejectionNotes ? `: ${d.rejectionNotes}` : ''}`))]) : null,
    canUpload && (missingDocs.length || rejected.length) ? button('Upload documents', { kind: 'sec', onClick: () => a.go('documents'), key: 'docs' }) : null,
    dash.applicationStatus === 'ACTION_REQUIRED' ? button('Finish the steps', { kind: 'sec', onClick: () => a.go('profile') }) : null,
    h('div.b-card.blue', [h('b', 'Jobs come through the app.'), h('p', 'Go on shift, take offers, write estimates, get paid. Install it now so you’re ready the day you’re approved.'), h('a.b-btn', { href: a.storeUrl() }, 'Get the NOHM app')]),
    h('p.b-small', ['Signed in as ', h('b', a.state.user ? a.state.user.email || prettyPhone(a.state.user.phone) : ''), ' · ', h('button.b-inline', { type: 'button', onClick: () => a.signOut() }, 'Sign out')]),
  ]);
}
