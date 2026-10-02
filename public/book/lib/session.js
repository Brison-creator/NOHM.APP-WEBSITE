// Who is signed in, in this browser. Tokens live in localStorage (the
// server only speaks Authorization: Bearer; it sets no cookies). One
// device id per browser so the server's trusted-device logic works
// for the web the way it does for a phone.
//
// `store` is injected so tests run without a window.

import { randomId } from './format.js';

const TOKENS = 'nohm.book.tokens';
const DEVICE = 'nohm.book.device';
const DRAFT = 'nohm.book.draft';

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
    saveDraft(d) {
      write(DRAFT, d);
    },
    loadDraft() {
      return read(DRAFT);
    },
    clearDraft() {
      write(DRAFT, null);
    },
  };
}
