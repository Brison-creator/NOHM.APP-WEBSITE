// Who is signed in, in this browser (shared by /book and /join). Tokens live in localStorage (the
// server only speaks Authorization: Bearer; it sets no cookies). One
// device id per browser so the server's trusted-device logic works
// for the web the way it does for a phone.
//
// `store` is injected so tests run without a window.

import { randomId } from './format.js';

const TOKENS = 'nohm.book.tokens';
const DEVICE = 'nohm.book.device';
const DRAFT = 'nohm.draft.';

export function createSession(store, { appVersion = 'web-1.0', deviceName = 'Web browser' } = {}) {
  const read = (k) => {
    try {
      const v = store.getItem(k);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  };
  const write = (k, v) => {
    try {
      if (v === null) store.removeItem(k);
      else store.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode etc: the flow still works for this page load */
    }
  };

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
    clear() {
      tokens = null;
      write(TOKENS, null);
    },
    /** The device fields every sign-in and sign-up body carries. */
    deviceFields() {
      return { deviceId: device.deviceId, deviceName, deviceType: 'web', appVersion };
    },
    /** The server trusts this browser once it has sent a code here; keep what it gave us. */
    get deviceSecret() {
      return device.deviceSecret || null;
    },
    setDeviceSecret(secret) {
      if (!secret) return;
      device = { ...device, deviceSecret: secret };
      write(DEVICE, device);
    },
    /** A named draft (one per flow: 'book', 'join'), kept across reloads. */
    saveDraft(d, name = 'book') {
      write(DRAFT + name, d);
    },
    loadDraft(name = 'book') {
      return read(DRAFT + name);
    },
    clearDraft(name = 'book') {
      write(DRAFT + name, null);
    },
  };
}
