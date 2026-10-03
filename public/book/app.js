// /book: wires the screens to the server. State lives here; rules in
// lib/flow.js; endpoints in lib/api.js; markup in ui/screens.js.
//
// Order of calls on a fresh visit: GET /trades and GET /config/pricing
// (public). Nothing else until the person signs in. After sign-in:
// GET /auth/me, GET /properties, GET /stripe/customer/payment-method.
// The job itself: POST /jobs (or /now/dispatch), then POST /jobs/:id/photos.

import { createSession } from '../nohm/session.js';
import { createHttp } from '../nohm/http.js';
import { createApi, apiBaseFor } from '../nohm/api.js';
import { STEPS, REQUEST_STEPS, emptyDraft, restoreDraft, persistableDraft, nextStep, prevStep, stepProblem, tradeForSlug, jobBody, nowDispatchBody, serviceRequestBody, bookingErrorAction } from './lib/flow.js';
import { randomId } from '../nohm/format.js';
import { h, clear } from '../nohm/dom.js';
import * as screens from './ui/screens.js';

const config = window.NOHM_BOOK;
const root = document.getElementById('book');
const progress = document.getElementById('book-progress');
const toastEl = document.getElementById('book-toast');

// The request in progress lives in the tab's sessionStorage (never the
// next visitor's), the sign-in in localStorage.
const session = createSession(window.localStorage, { deviceName: navigator.userAgent.slice(0, 80), draftStore: window.sessionStorage });
const apiBase = apiBaseFor(location.hostname, location.search, config.apiBase);
const http = createHttp({ baseUrl: apiBase, session });
const api = createApi(http, session);

const PROGRESS = { service: 1, issue: 1, details: 2, speed: 3, schedule: 3, account: 4, home: 4, card: 5, review: 6, now: 6, done: 7, request: 2, 'request-review': 6, 'request-done': 7 };

const a = {
  config,
  api,
  session,
  draft: emptyDraft(),
  state: { trades: [], pricing: null, user: null, properties: null, property: null, hasCard: false, card: null, job: null, request: null, wrongRole: false },
  step: 'service',
  leave: [],
  /** A one-line notice for the next screen (a price change, a pro that was just taken). */
  notice: null,

  ctx() {
    return { signedIn: Boolean(this.state.user), hasCard: this.state.hasCard };
  },
  /**
   * Change the draft. Any change to what the job *is* retires the
   * idempotency key: the server replays by key before it looks at the
   * body, so an edited resubmit with the old key would book the old job.
   */
  setDraft(patch) {
    const content = Object.keys(patch).some((k) => k !== 'idempotencyKey' && k !== 'photos' && patch[k] !== this.draft[k]);
    Object.assign(this.draft, patch);
    if (content && patch.idempotencyKey === undefined) this.draft.idempotencyKey = null;
    session.saveDraft(persistableDraft(this.draft));
  },
  canGoBack() {
    return this.step !== 'done' && prevStep(this.step, this.draft, this.ctx()) !== null;
  },
  /** Screens register timers to stop when the screen goes away. */
  onLeave(fn) {
    this.leave.push(fn);
  },
  go(step) {
    this.step = step;
    render();
  },
  next() {
    const p = stepProblem(this.step, this.draft);
    if (p) return this.toast(p);
    // After a detour (re-adding photos lost on reload), return to where the draft was.
    const target = this.resumeTo;
    this.resumeTo = null;
    this.go(target || nextStep(this.step, this.draft, this.ctx()));
  },
  back() {
    const s = prevStep(this.step, this.draft, this.ctx());
    if (s) this.go(s);
  },
  restart() {
    this.draft = emptyDraft();
    session.clearDraft();
    this.state.job = null;
    this.state.request = null;
    this.go('service');
  },
  toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastEl.t);
    toastEl.t = setTimeout(() => (toastEl.hidden = true), 5000);
  },
  storeUrl() {
    return /android/i.test(navigator.userAgent) ? config.playStore : config.appStore;
  },
  /** Run an async step, putting any failure into `errEl`. */
  async run(fn, errEl, okMsg) {
    try {
      errEl.textContent = '';
      await fn();
      if (okMsg) this.toast(okMsg);
    } catch (ex) {
      errEl.textContent = ex.message || 'Something went wrong.';
    }
  },

  // ── Account ────────────────────────────────────────────────────
  account: {
    async signedIn(res) {
      session.setTokens(res);
      clearPending();
      try {
        await loadAccount();
      } catch (ex) {
        // The code was accepted and the tokens are good; the profile
        // load failed. Move on and let the next screen's call say so.
        a.toast(ex.message || "Signed in, but your profile didn't load.");
      }
      a.go(a.state.wrongRole ? 'wrong-role' : nextStep('account', a.draft, a.ctx()));
    },
    async google(idToken) {
      const res = await api.auth.googleSignin(idToken);
      if (res.status === 'needs_signup') {
        a.state.pendingGoogle = { idToken: res.idToken || idToken, firstName: res.firstName, email: res.email };
        a.state.accountMode = 'google-phone';
        render();
        return;
      }
      await a.account.signedIn(res);
    },
  },
  async signOut() {
    try { await api.auth.logout(); } catch { /* the token may already be dead */ }
    // The request in progress goes with the account: the next person on
    // this computer starts clean.
    session.clear();
    clearPending();
    Object.assign(this.state, { user: null, properties: null, property: null, hasCard: false, card: null, wrongRole: false });
    this.draft = emptyDraft();
    this.history = [];
    this.toast('Signed out.');
    this.go('service');
  },

  // ── Submit ─────────────────────────────────────────────────────
  async submit(btn, errEl, attempt = 0) {
    errEl.textContent = '';
    if (this.draft.tier === 'NOW') return this.go('now');
    if (!this.draft.idempotencyKey) this.setDraft({ idempotencyKey: randomId() });
    btn.busy(true, 'Sending…');
    try {
      const body = jobBody(this.draft, this.state.pricing);
      const job = await api.jobs.create(body);
      await this.afterJob(job);
    } catch (ex) {
      await this.handleBookingError(ex, errEl, attempt < 1 ? () => this.submit(btn, errEl, attempt + 1) : null);
    } finally {
      btn.busy(false);
    }
  },
  /** A "by request" trade: send it to the people at NOHM, no card, no match. */
  async submitRequest(btn, errEl) {
    errEl.textContent = '';
    btn.busy(true, 'Sending…');
    try {
      const r = await api.serviceRequests.create(serviceRequestBody(this.draft));
      this.state.request = r;
      session.clearDraft();
      this.go('request-done');
    } catch (ex) {
      if (ex && ex.status === 409 && ex.code === 'OPEN_REQUEST_EXISTS') {
        this.state.request = { id: ex.body && ex.body.requestId, duplicate: true };
        session.clearDraft();
        this.go('request-done');
        return;
      }
      await this.handleBookingError(ex, errEl, null, 'request');
    } finally {
      btn.busy(false);
    }
  },
  async dispatchNow(availabilityId, errEl) {
    errEl.textContent = '';
    try {
      const job = await api.now.dispatch(nowDispatchBody(this.draft, availabilityId, this.state.pricing));
      await this.afterJob(job);
      return true;
    } catch (ex) {
      await this.handleBookingError(ex, errEl, null, 'dispatch');
      return false;
    }
  },
  async afterJob(job) {
    this.state.job = job;
    if (this.draft.photos && this.draft.photos.length) {
      try { await api.jobs.uploadPhotos(job.id, this.draft.photos); } catch { this.toast('The request went out, but the photos didn’t upload. You can add them in the app.'); }
    }
    session.clearDraft();
    this.go('done');
  },
  async handleBookingError(ex, errEl, retry, call = 'job') {
    const action = bookingErrorAction(ex, call);
    switch (action.kind) {
      case 'sign_in':
        session.clear();
        this.state.user = null;
        this.notice = 'Please sign in again to send your request.';
        return this.go('account');
      case 'card':
        this.state.hasCard = false;
        return this.go('card');
      case 'rentals_card':
        errEl.textContent = `${ex.message} Rental cards are set up in the NOHM app.`;
        return;
      case 'price_changed':
        try { this.state.pricing = await api.pricing(); } catch { /* keep the old map */ }
        this.setDraft({ idempotencyKey: null });
        this.notice = 'The fee just changed. Here’s the new price; send again if it’s still a go.';
        return render();
      case 'duplicate': {
        const j = action.existingJob || {};
        errEl.textContent = `You already have an open ${this.draft.trade.label} request${j.jobNumber ? ` (${j.jobNumber})` : ''}. Manage it in the app, or choose a different service.`;
        return;
      }
      case 'retry_same_key':
        if (retry) return retry();
        // Twice is enough: a key the server won't take is retired.
        this.setDraft({ idempotencyKey: null });
        errEl.textContent = `${ex.message} Send again to try with a fresh request.`;
        return;
      case 'pick_again':
        this.notice = action.message;
        return render();
      default:
        errEl.textContent = action.message;
    }
  },
};

function clearPending() {
  a.state.accountMode = null;
  a.state.pendingSignup = null;
  a.state.pendingLogin = null;
  a.state.pendingGoogle = null;
}

async function loadAccount() {
  const me = await api.auth.me();
  a.state.user = me && me.user ? me.user : me;
  // Whether this account can book is the server's answer (a 403 on the
  // homes list), not a copy of its role rule.
  a.state.wrongRole = false;
  const [props, pm] = await Promise.all([
    api.properties.list().catch((ex) => {
      if (ex && ex.status === 403) a.state.wrongRole = true;
      return { properties: [] };
    }),
    api.stripe.paymentMethod().catch(() => ({ hasCard: false })),
  ]);
  if (a.state.wrongRole) return;
  a.state.properties = (props && props.properties) || [];
  a.state.hasCard = Boolean(pm && pm.hasCard);
  a.state.card = pm && pm.hasCard ? { last4: pm.last4, brand: pm.brand } : null;
  if (a.draft.propertyId) {
    a.state.property = a.state.properties.find((p) => p.id === a.draft.propertyId) || null;
    if (!a.state.property) a.setDraft({ propertyId: null });
  }
}

function wrongRoleScreen() {
  const u = a.state.user || {};
  return h('section.b-screen', [
    h('h1.b-h1', 'That’s a pro or renter account.'),
    h('p.b-sub', `${u.email || 'This account'} isn’t set up as a homeowner. Add the homeowner role in the NOHM app, or sign out and sign up here with a different email.`),
    h('div.b-foot', [h('button.b-btn', { type: 'button', onClick: () => a.signOut() }, 'Sign out')]),
    h('p.b-small', [h('a', { href: '/join' }, 'Pro sign-up'), ' · ', h('a', { href: '/join/renter' }, 'Renter sign-up')]),
  ]);
}

function render() {
  // Every redraw ends the old screen's timers (a NOW poll, an offers
  // poll), including a re-render of the same step.
  a.leave.splice(0).forEach((fn) => fn());
  clear(root);
  const fn = {
    service: screens.serviceScreen, issue: screens.issueScreen, details: screens.detailsScreen, speed: screens.speedScreen,
    schedule: screens.scheduleScreen,
    account: (app) => screens.accountScreen(app, { role: 'HOMEOWNER', signupSub: 'Takes a minute. Your request is saved while you do.', signinSub: 'Your request is saved. Sign in to send it.' }),
    home: screens.homeScreen, card: screens.cardScreen,
    review: screens.reviewScreen, now: screens.nowScreen, done: screens.doneScreen, 'wrong-role': wrongRoleScreen,
    request: screens.requestScreen, 'request-review': screens.requestReviewScreen, 'request-done': screens.requestDoneScreen,
  }[a.step] || screens.serviceScreen;
  root.append(fn(a));
  if (a.notice) {
    a.toast(a.notice);
    a.notice = null;
  }
  const n = PROGRESS[a.step] || 1;
  progress.style.setProperty('--p', `${(n / 7) * 100}%`);
  progress.setAttribute('aria-valuenow', String(n));
  root.dataset.step = a.step;
  window.scrollTo({ top: 0, behavior: 'instant' });
  const heading = root.querySelector('.b-h1');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  // One history entry per step so the browser's Back works; the done
  // screen replaces its entry, since there is nothing to go back to.
  if (a.step === 'done' || a.step === 'request-done') history.replaceState({ step: a.step }, '', `#${a.step}`);
  else if (!history.state || history.state.step !== a.step) history.pushState({ step: a.step }, '', `#${a.step}`);
}

// Browser Back/Forward: go where the entry says, if it's a step the
// draft can still show; never back into a sent job.
window.addEventListener('popstate', (e) => {
  const target = e.state && e.state.step;
  if (a.step === 'done' || a.step === 'request-done' || !target || target === 'done' || target === 'request-done' || target === a.step) return;
  const known = [...STEPS, ...REQUEST_STEPS, 'now', 'wrong-role'];
  if (!known.includes(target)) return;
  a.leave.splice(0).forEach((fn) => fn());
  a.step = target;
  render();
});

async function boot() {
  root.append(h('p.b-loading', 'Loading…'));
  try {
    const [trades, pricing] = await Promise.all([api.trades(), api.pricing()]);
    a.state.trades = Array.isArray(trades) ? trades : [];
    a.state.pricing = pricing || null;
  } catch (ex) {
    clear(root);
    root.append(h('section.b-screen', [h('h1.b-h1', 'NOHM is taking a moment.'), h('p.b-sub', ex.message), h('a.b-btn', { href: '/book' }, 'Try again')]));
    return;
  }
  const saved = session.loadDraft();
  let lostPhotos = 0;
  if (saved) {
    a.draft = restoreDraft(saved);
    lostPhotos = Number(saved.photoCount) || 0;
  }
  const slug = new URLSearchParams(location.search).get('trade');
  const t = tradeForSlug(slug, a.state.trades);
  // A ?trade= link starts fresh on that trade, unless a saved draft is
  // already on it (a reload mid-flow keeps the person's place).
  const fresh = t && !(a.draft.trade && a.draft.trade.id === t.id);
  if (fresh) {
    a.draft = emptyDraft();
    a.draft.trade = { id: t.id, name: t.name, label: t.label };
    lostPhotos = 0;
  } else if (slug && !t) {
    a.toast(`${slug.replace(/-/g, ' ')} isn’t bookable online yet. Pick one of these.`);
  }
  if (session.signedIn) {
    try { await loadAccount(); } catch { session.clear(); }
  }
  if (a.draft.trade && a.draft.trade.id && !a.state.trades.some((x) => x.id === a.draft.trade.id)) a.draft = emptyDraft();
  // A day that has passed, or a window that closed, can't be booked.
  if (a.draft.tier === 'STANDARD' && a.draft.day && stepProblem('schedule', a.draft)) a.setDraft({ day: null, window: null });
  if (a.state.wrongRole) a.step = 'wrong-role';
  else if (!a.draft.trade) a.step = 'service';
  else if (fresh) a.step = 'issue';
  else if (lostPhotos && !stepProblem('details', a.draft)) {
    a.step = 'details';
    a.resumeTo = firstUnfinished();
    a.notice = `Your ${lostPhotos === 1 ? 'photo' : `${lostPhotos} photos`} didn’t survive the reload; add ${lostPhotos === 1 ? 'it' : 'them'} again.`;
  } else a.step = firstUnfinished();
  history.replaceState({ step: a.step }, '', `#${a.step}`);
  render();
}

/** Where a restored draft left off. */
function firstUnfinished() {
  for (const s of STEPS.slice(0, STEPS.indexOf('account'))) {
    if (s === 'schedule' && a.draft.tier !== 'STANDARD') continue;
    if (stepProblem(s, a.draft)) return s;
  }
  let s = nextStep('speed', a.draft, a.ctx());
  if (s === 'schedule') s = nextStep('schedule', a.draft, a.ctx());
  if (s === 'home' && !stepProblem('home', a.draft)) s = nextStep('home', a.draft, a.ctx());
  return s;
}

boot();
