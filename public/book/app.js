// /book: wires the screens to the server. State lives here; rules in
// lib/flow.js; endpoints in lib/api.js; markup in ui/screens.js.
//
// Order of calls on a fresh visit: GET /trades and GET /config/pricing
// (public). Nothing else until the person signs in. After sign-in:
// GET /auth/me, GET /properties, GET /stripe/customer/payment-method.
// The job itself: POST /jobs (or /now/dispatch), then POST /jobs/:id/photos.

import { createSession } from '../nohm/session.js';
import { createHttp } from '../nohm/http.js';
import { createApi } from '../nohm/api.js';
import { STEPS, emptyDraft, restoreDraft, persistableDraft, nextStep, prevStep, stepProblem, tradeForSlug, jobBody, nowDispatchBody, bookingErrorAction } from './lib/flow.js';
import { randomId } from '../nohm/format.js';
import { h, clear } from '../nohm/dom.js';
import * as screens from './ui/screens.js';

const config = window.NOHM_BOOK;
const root = document.getElementById('book');
const progress = document.getElementById('book-progress');
const toastEl = document.getElementById('book-toast');

const session = createSession(window.localStorage, { deviceName: navigator.userAgent.slice(0, 80), draftStore: window.sessionStorage });
// On localhost only, ?api= points the page at a stub server
// (tools/book/stub-server.mjs). Never honored on the real site: a link
// that sent people's sign-ins somewhere else must not be possible.
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const apiBase = (LOCAL && new URLSearchParams(location.search).get('api')) || config.apiBase;
const http = createHttp({ baseUrl: apiBase, session });
const api = createApi(http, session);

const PROGRESS = { service: 1, issue: 1, details: 2, speed: 3, schedule: 3, account: 4, home: 4, card: 5, review: 6, now: 6, done: 7 };

const a = {
  config,
  api,
  session,
  draft: emptyDraft(),
  state: { trades: [], pricing: null, user: null, properties: null, property: null, hasCard: false, card: null, job: null },
  step: 'service',
  history: [],

  ctx() {
    return { signedIn: Boolean(this.state.user), hasCard: this.state.hasCard };
  },
  setDraft(patch) {
    Object.assign(this.draft, patch);
    session.saveDraft(persistableDraft(this.draft));
  },
  canGoBack() {
    return this.step !== 'done' && prevStep(this.step, this.draft, this.ctx()) !== null;
  },
  go(step) {
    if (step !== this.step) this.history.push(this.step);
    this.step = step;
    render();
  },
  next() {
    const p = stepProblem(this.step, this.draft);
    if (p) return this.toast(p);
    this.go(nextStep(this.step, this.draft, this.ctx()));
  },
  back() {
    const s = prevStep(this.step, this.draft, this.ctx());
    if (s) this.go(s);
  },
  restart() {
    this.draft = emptyDraft();
    session.clearDraft();
    this.state.job = null;
    this.history = [];
    this.go('service');
  },
  toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastEl.t);
    toastEl.t = setTimeout(() => (toastEl.hidden = true), 4000);
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
      await loadAccount();
      a.go(nextStep('account', a.draft, a.ctx()));
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
    this.state.user = null;
    this.state.properties = null;
    this.state.property = null;
    this.state.hasCard = false;
    this.state.card = null;
    this.state.cannotBook = false;
    this.draft = emptyDraft();
    this.history = [];
    this.toast('Signed out.');
    this.go('service');
  },

  // ── Submit ─────────────────────────────────────────────────────
  async submit(btn, errEl, { retried = false } = {}) {
    errEl.textContent = '';
    if (this.draft.tier === 'NOW') return this.go('now');
    if (!this.draft.idempotencyKey) this.setDraft({ idempotencyKey: randomId() });
    btn.busy(true, 'Sending…');
    try {
      const body = jobBody(this.draft, this.state.pricing);
      const job = await api.jobs.create(body);
      await this.afterJob(job);
    } catch (ex) {
      await this.handleBookingError(ex, errEl, () => this.submit(btn, errEl, { retried: true }), { retried });
    } finally {
      btn.busy(false);
    }
  },
  async dispatchNow(availabilityId, errEl) {
    errEl.textContent = '';
    try {
      const job = await api.now.dispatch(nowDispatchBody(this.draft, availabilityId, this.state.pricing));
      await this.afterJob(job);
    } catch (ex) {
      await this.handleBookingError(ex, errEl, null);
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
  async handleBookingError(ex, errEl, retry, { retried = false } = {}) {
    const action = bookingErrorAction(ex, { retried });
    switch (action.kind) {
      case 'sign_in':
        session.clear();
        this.state.user = null;
        return this.go('account');
      case 'card':
        this.state.hasCard = false;
        return this.go('card');
      case 'rentals_card':
        errEl.textContent = `${ex.message} Rental cards are set up in the NOHM app.`;
        return;
      case 'price_changed':
        try { this.state.pricing = await api.pricing(); } catch { /* keep the old map */ }
        errEl.textContent = 'The fee just changed. Here’s the new price; tap again if it’s still a go.';
        return render();
      case 'duplicate': {
        const j = action.existingJob || {};
        errEl.textContent = `You already have an open ${this.draft.trade.label} request${j.jobNumber ? ` (${j.jobNumber})` : ''}. Manage it in the app, or choose a different service.`;
        return;
      }
      case 'retry_same_key':
        return retry ? retry() : (errEl.textContent = ex.message);
      case 'pick_again':
        errEl.textContent = action.message;
        return render();
      default:
        errEl.textContent = action.message;
    }
  },
};

async function loadAccount() {
  const me = await api.auth.me();
  a.state.user = me && me.user ? me.user : me;
  // Whether this account can book is the server's answer (a 403 on the
  // homes list), not a rule kept here.
  a.state.cannotBook = false;
  const [props, pm] = await Promise.all([
    api.properties.list().catch((ex) => {
      if (ex && ex.status === 403) a.state.cannotBook = true;
      return { properties: [] };
    }),
    api.stripe.paymentMethod().catch(() => ({ hasCard: false })),
  ]);
  a.state.properties = (props && props.properties) || [];
  a.state.hasCard = Boolean(pm && pm.hasCard);
  a.state.card = pm && pm.hasCard ? { last4: pm.last4, brand: pm.brand } : null;
  if (a.draft.propertyId) {
    a.state.property = a.state.properties.find((p) => p.id === a.draft.propertyId) || null;
    if (!a.state.property) a.setDraft({ propertyId: null });
  }
}

function render() {
  clear(root);
  const fn = {
    service: screens.serviceScreen, issue: screens.issueScreen, details: screens.detailsScreen, speed: screens.speedScreen,
    schedule: screens.scheduleScreen,
    account: (app) => screens.accountScreen(app, { role: 'HOMEOWNER', signupSub: 'Takes a minute. Your request is saved while you do.', signinSub: 'Your request is saved. Sign in to send it.' }),
    home: screens.homeScreen, card: screens.cardScreen,
    review: screens.reviewScreen, now: screens.nowScreen, done: screens.doneScreen,
  }[a.step];
  // A signed-in account the server won't let book (a pro or renter
  // account) is told so before it fills in a request it can't send.
  const blocked = a.state.cannotBook && !['service', 'issue', 'details', 'speed', 'schedule', 'account', 'done'].includes(a.step);
  root.append(blocked ? screens.cannotBookScreen(a) : fn(a));
  const n = PROGRESS[a.step] || 1;
  progress.style.setProperty('--p', `${(n / 7) * 100}%`);
  progress.setAttribute('aria-valuenow', String(n));
  root.dataset.step = a.step;
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (history.state?.step !== a.step) history.pushState({ step: a.step }, '', `#${a.step}`);
}

window.addEventListener('popstate', () => {
  const s = prevStep(a.step, a.draft, a.ctx());
  if (s && a.step !== 'done') { a.step = s; render(); }
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
  if (saved) a.draft = restoreDraft(saved);
  const slug = new URLSearchParams(location.search).get('trade');
  const t = tradeForSlug(slug, a.state.trades);
  // A ?trade= link starts fresh on that trade, unless a saved draft is
  // already on it (a reload mid-flow keeps the person's place).
  const fresh = t && !(a.draft.trade && a.draft.trade.id === t.id);
  if (fresh) {
    a.draft = emptyDraft();
    a.draft.trade = { id: t.id, name: t.name, label: t.label };
  } else if (slug && !t) {
    a.toast(`${slug.replace(/-/g, ' ')} isn’t bookable online yet. Pick one of these.`);
  }
  if (session.signedIn) {
    try { await loadAccount(); } catch { session.clear(); }
  }
  if (a.draft.trade && a.draft.trade.id && !a.state.trades.some((x) => x.id === a.draft.trade.id)) a.draft = emptyDraft();
  a.step = a.draft.trade ? (fresh ? 'issue' : firstUnfinished()) : 'service';
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
