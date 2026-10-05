// /book steps 9 and 10: review and send, the NOHM NOW live list, and
// the done screen (pick a pro for Standard; any photo that didn't upload).

import { h, append, button, money, clear } from '../../nohm/dom.js';
import { TIERS, feeFor, cancellationTermsQuery } from '../lib/flow.js';
import { WINDOWS, bookableDays, homeId } from '../../nohm/format.js';
import { photoFailureText } from '../lib/photos.js';
import { head, footer, HOLD, premiumText } from './parts.js';

// ── 9. Review ─────────────────────────────────────────────────────

export function reviewScreen(a) {
  const d = a.draft;
  const tier = TIERS[d.tier];
  const fee = feeFor(d.tier, a.state.pricing);
  const win = WINDOWS.find((w) => w.key === d.window);
  const day = bookableDays().find((x) => x.iso === d.day);
  const terms = h('p.b-small', '…');
  a.api.jobs.cancellationTerms(cancellationTermsQuery(d)).then((t) => (terms.textContent = (t && t.disclosure) || '')).catch(() => (terms.textContent = ''));

  // Express: if the server says the person has spendable NOHM Credits,
  // offer to put them toward the fee (off unless ticked). How many apply
  // is the server's call when it holds the fee; nothing here changes the price.
  const credits = h('div.b-credits');
  if (d.tier === 'EXPRESS') {
    a.api.credits.balance().then((r) => {
      const n = Math.floor(Number(r && r.balance));
      if (!(n > 0)) { if (a.draft.useCredits) a.setDraft({ useCredits: false }); return; }
      const box = h('input', { type: 'checkbox', id: 'f-credits', checked: a.draft.useCredits === true, onChange: () => a.setDraft({ useCredits: box.checked }) });
      credits.append(h('label.b-check', { htmlFor: 'f-credits' }, [box, h('span', [h('b', 'Put my NOHM Credits toward this fee'), h('small', `You have ${n}. NOHM applies what this fee allows when it’s held; the rest goes on your card.`)])]));
    }).catch(() => { if (a.draft.useCredits) a.setDraft({ useCredits: false }); });
  }

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
    credits,
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
    h('div.b-card', [h('b', `${d.trade.label} · ${d.issue.title}`), h('p', a.state.property ? a.state.property.formattedAddress : ''), a.state.property && a.state.property.hin ? h('p.b-small', `Home ID ${homeId(a.state.property.hin)}`) : null]),
    status,
    photoFailureText(a.state.photoFailures) ? h('p.b-err.b-photofail', { role: 'alert' }, photoFailureText(a.state.photoFailures)) : null,
    pros,
    err,
    h('div.b-card.blue', [h('b', 'Everything else lives in the app.'), h('p', 'Live tracking, chat with your pro, the door PIN, the estimate to approve, and this home’s record.'), h('a.b-btn', { href: a.storeUrl() }, 'Get NOHM')]),
    h('p.b-small', [h('button.b-inline', { type: 'button', onClick: () => a.restart() }, 'Book something else')]),
  );
  return wrap;
}
