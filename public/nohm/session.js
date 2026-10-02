// Who is signed in, in this browser (shared by /book and /join). Tokens live in localStorage (the
// server only speaks Authorization: Bearer; it sets no cookies). One
// device id per browser, plus the secret the server hands out when it
// trusts this browser for an email (sent back with the next password
// sign-in, as the app does), so a known browser isn't texted a code at
// every sign-in.
//
// A request in progress (the draft) lives in `draftStore`, the tab's
// sessionStorage: it never outlives the tab, and signing out clears it,
// so a shared computer never shows the next person the last one's
// request.
//
// Stores are injected so tests run without a window.

import { randomId } from './format.js';

const TOKENS = 'nohm.book.tokens';
const DEVICE = 'nohm.book.device';
const DRAFT = 'nohm.draft.';

export function createSession(store, { appVersion = 'web-1.0', deviceName = 'Web browser', draftStore = store } = {}) {
  const readFrom = (s, k) => {
    try {
      const v = s.getItem(k);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  };
  const writeTo = (s, k, v) => {
    try {
      if (v === null) s.removeItem(k);
      else s.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode etc: the flow still works for this page load */
    }
  };
  const read = (k) => readFrom(store, k);
  const write = (k, v) => writeTo(store, k, v);
  const DRAFTS = ['book', 'join'];

  let tokens = read(TOKENS);
  let device = read(DEVICE);
  if (!device) {
    device = { deviceId: randomId() };
    write(DEVICE, device);
  }

  return {
    get accessToken() {
      return tokens ? tokens.accessToken : null;
    },
    get refreshToken() {
      return tokens ? tokens.refreshToken : null;
    },
    get signedIn() {
      return Boolean(tokens && tokens.accessToken);
    },
    setTokens(t) {
      tokens = t && t.accessToken ? { accessToken: t.accessToken, refreshToken: t.refreshToken } : null;
      write(TOKENS, tokens);
    },
    /** Signing out: the tokens and any request in progress. */
    clear() {
      tokens = null;
      write(TOKENS, null);
      for (const name of DRAFTS) writeTo(draftStore, DRAFT + name, null);
    },
    /** The secret the server gave this browser for an email, if any. */
    deviceSecret(email) {
      const key = String(email || '').trim().toLowerCase();
      return (device.secrets && device.secrets[key]) || null;
    },
    saveDeviceSecret(email, secret) {
      const key = String(email || '').trim().toLowerCase();
      if (!key || !secret) return;
      device = { ...device, secrets: { ...(device.secrets || {}), [key]: secret } };
      write(DEVICE, device);
    },
    /** The device fields every sign-in and sign-up body carries. */
    deviceFields() {
      return { deviceId: device.deviceId, deviceName, deviceType: 'web', appVersion };
    },
    /** A named draft (one per flow: 'book', 'join'), kept across reloads of the tab. */
    saveDraft(d, name = 'book') {
      writeTo(draftStore, DRAFT + name, d);
    },
    loadDraft(name = 'book') {
      return readFrom(draftStore, DRAFT + name);
    },
    clearDraft(name = 'book') {
      writeTo(draftStore, DRAFT + name, null);
    },
  };
}
