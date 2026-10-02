// /join (pros) and /join/renter (renters): the same NOHM sign-up the
// app uses, then each role's onboarding against the server. Which one
// runs comes from <body data-join="pro|renter">.
//
// Pro: account → profile (with trades) → documents → payouts (Stripe
// Connect) → agreement → submit → status. The server's dashboard says
// where a returning pro is; nothing is tracked here.
// Renter: account → the landlord's invite code → a text code → done.

import { createSession } from '../nohm/session.js';
import { createHttp } from '../nohm/http.js';
import { createApi, apiBaseFor } from '../nohm/api.js';
import { h, clear } from '../nohm/dom.js';
import { accountScreen } from '../nohm/account.js';
import { proStepFor } from './lib/pro-flow.js';
import { renterStepFor } from './lib/renter-flow.js';
import * as pro from './ui/pro-screens.js';
import * as renter from './ui/renter-screens.js';

const config = window.NOHM_BOOK;
const MODE = document.body.dataset.join === 'renter' ? 'renter' : 'pro';
const ROLE = MODE === 'pro' ? 'CONTRACTOR' : 'TENANT';
const root = document.getElementById('join');
const toastEl = document.getElementById('join-toast');

const apiBase = apiBaseFor(location.hostname, location.search, config.apiBase);
const session = createSession(window.localStorage, { deviceName: navigator.userAgent.slice(0, 80) });
const http = createHttp({ baseUrl: apiBase, session });
const api = createApi(http, session);

const COPY = {
  pro: { signupTitle: 'Join NOHM as a pro', signupSub: 'Your account first. Then your profile, payouts and the Standard: about ten minutes.', signinSub: 'Pick up where you left off.' },
  renter: { signupTitle: 'Join NOHM as a renter', signupSub: 'Use the phone number your landlord has for you; the invite is matched to it.', signinSub: 'Sign in to accept your landlord’s invite.' },
};

const a = {
  config,
  api,
  session,
  state: { user: null, trades: [], dashboard: null, myProperty: null, invite: null },
  step: 'account',
  history: [],
  leave: [],

  canGoBack() {
    if (MODE === 'pro') return ['documents', 'payouts', 'agreement', 'review'].includes(this.step);
    return false;
  },
  back() {
    const order = ['profile', 'documents', 'payouts', 'agreement', 'review'];
    const i = order.indexOf(this.step);
    if (i > 0) this.go(order[i - 1]);
  },
  go(step) {
    this.leave.splice(0).forEach((fn) => fn());
    this.step = step;
    render();
  },
  rerender() {
    render();
  },
  onLeave(fn) {
    this.leave.push(fn);
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
  async run(fn, errEl, okMsg) {
    try {
      errEl.textContent = '';
      await fn();
      if (okMsg) this.toast(okMsg);
    } catch (ex) {
      errEl.textContent = ex.message || 'Something went wrong.';
    }
  },
  /** Reload the server's view of this person (dashboard or lease). */
  async refresh() {
    if (MODE === 'pro') this.state.dashboard = await api.contractors.dashboard();
    else this.state.myProperty = await api.tenants.myProperty().catch(() => ({ hasProperty: false }));
  },
  account: {
    async signedIn(res) {
      session.setTokens(res);
      a.state.accountMode = null;
      a.state.pendingSignup = null;
      a.state.pendingLogin = null;
      a.state.pendingGoogle = null;
      try {
        await loadAccount();
      } catch (ex) {
        a.toast(ex.message || "Signed in, but your details didn't load.");
      }
      a.go(firstStep());
    },
    async google(idToken) {
      const res = await api.auth.googleSignin(idToken, ROLE);
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
    try { await api.auth.logout(); } catch { /* fine */ }
    session.clear();
    this.state = { user: null, trades: this.state.trades, dashboard: null, myProperty: null, invite: null };
    this.go('account');
  },
};

async function loadAccount() {
  const me = await api.auth.me();
  a.state.user = me && me.user ? me.user : me;
  const caps = a.state.user.caps || [a.state.user.role];
  const hasRole = caps.includes(ROLE) || a.state.user.role === ROLE;
  if (!hasRole) {
    a.state.wrongRole = true;
    return;
  }
  a.state.wrongRole = false;
  await a.refresh();
}

function firstStep() {
  if (a.state.wrongRole) return 'wrong-role';
  return MODE === 'pro' ? proStepFor(a.state.dashboard) : renterStepFor(a.state.myProperty);
}

function wrongRoleScreen() {
  const r = a.state.user.role;
  const where = r === 'HOMEOWNER' || r === 'PROPERTY_MANAGER' ? 'a homeowner' : r === 'CONTRACTOR' ? 'a pro' : r === 'TENANT' ? 'a renter' : 'another kind of';
  return h('section.b-screen', [
    h('h1.b-h1', 'That’s a different kind of account.'),
    h('p.b-sub', `You’re signed in as ${where} account (${a.state.user.email}). Add the ${MODE === 'pro' ? 'pro' : 'renter'} role to it in the NOHM app, or sign out and sign up here with a different email.`),
    h('div.b-foot', [h('button.b-btn', { type: 'button', onClick: () => a.signOut() }, 'Sign out')]),
    MODE === 'pro' ? h('p.b-small', [h('a', { href: '/book' }, 'Book a pro instead')]) : null,
  ]);
}

function render() {
  clear(root);
  const screens = MODE === 'pro'
    ? { account: (app) => accountScreen(app, { role: ROLE, ...COPY.pro }), profile: pro.profileScreen, documents: pro.documentsScreen, payouts: pro.payoutsScreen, agreement: pro.agreementScreen, review: pro.reviewScreen, status: pro.statusScreen, 'wrong-role': wrongRoleScreen }
    : { account: (app) => accountScreen(app, { role: ROLE, ...COPY.renter }), invite: renter.inviteScreen, confirm: renter.confirmScreen, done: renter.doneScreen, 'wrong-role': wrongRoleScreen };
  root.append((screens[a.step] || screens.account)(a));
  root.dataset.step = a.step;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

async function boot() {
  root.append(h('p.b-loading', 'Loading…'));
  try {
    if (MODE === 'pro') a.state.trades = (await api.trades()).filter((t) => t.isActive !== false);
    if (session.signedIn) {
      try { await loadAccount(); } catch { session.clear(); }
    }
  } catch (ex) {
    clear(root);
    root.append(h('section.b-screen', [h('h1.b-h1', 'NOHM is taking a moment.'), h('p.b-sub', ex.message), h('a.b-btn', { href: location.pathname }, 'Try again')]));
    return;
  }
  a.step = a.state.user ? firstStep() : 'account';
  render();
}

boot();
