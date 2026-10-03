// The settings the NOHM server publishes for the website (GET
// /config/web): the Stripe publishable key and the Google OAuth client
// id. If the call fails or a value is missing, that feature is off and
// the screen says so (fail closed): no card form, no Google button.
//
// One exception, for the server that's live today: a server from before
// /config/web answers 404. Then, and only then, the site uses the values
// it carried before (LEGACY_WEB_CONFIG), still checked like the server's,
// and treats the server as old: no phone sign-up (it has no
// /auth/phone-signup routes either). A network error, a 5xx, or a 200
// with empty values is not an old server, and stays fail closed.

/**
 * DELETE THIS once api.nohm.app serves GET /config/web (server main
 * 3b5f675 or later): the values public/book/config.js held before
 * (9819e15), used only when the server answers that route with 404.
 * Public by design: a Stripe publishable key; no Google client was set.
 */
export const LEGACY_WEB_CONFIG = Object.freeze({
  stripePublishableKey: 'pk_live_51Ssr6TGRifyQNvisAhdcN4bxhMn0CIzJhoTwhy2HC43a7vCmMl8ydkvR3PSMXcCzFcJEEJTtF9QvvsuTTf3igRt5007K5t99sr',
  googleClientId: '',
});

/** Card entry is off: said the same way wherever it shows. */
export const CARD_UNAVAILABLE = 'Card entry isn’t available right now. Try again in a few minutes, or add your card in the NOHM app.';
/** Google sign-in is off. */
export const GOOGLE_UNAVAILABLE = 'Continue with Google isn’t available right now.';

/**
 * Only well-formed public values get through: a publishable key
 * (pk_…), never anything else, and a Google OAuth web client id
 * (…apps.googleusercontent.com).
 */
export function normalizeWebConfig(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const pk = typeof r.stripePublishableKey === 'string' ? r.stripePublishableKey.trim() : '';
  const gid = typeof r.googleClientId === 'string' ? r.googleClientId.trim() : '';
  return {
    stripePublishableKey: /^pk_(live|test)_[A-Za-z0-9]+$/.test(pk) ? pk : null,
    googleClientId: /^[A-Za-z0-9-]+\.apps\.googleusercontent\.com$/.test(gid) ? gid : null,
  };
}

/**
 * A loader that asks the server once per page and shares the answer:
 * { stripePublishableKey, googleClientId, legacy, phoneSignup }.
 *   legacy       the server is from before /config/web (it said 404)
 *   phoneSignup  whether to offer phone sign-up (not on a legacy server)
 * A failed call (network, 5xx) resolves to both features off and is
 * asked again next time a screen needs it.
 */
export function createWebConfig(api) {
  let pending = null;
  return function webConfig() {
    if (!pending) {
      pending = api.webConfig().then(
        (raw) => ({ ...normalizeWebConfig(raw), legacy: false, phoneSignup: true }),
        (err) => {
          if (err && err.status === 404) return { ...normalizeWebConfig(LEGACY_WEB_CONFIG), legacy: true, phoneSignup: false };
          pending = null;
          return { ...normalizeWebConfig(null), legacy: false, phoneSignup: true };
        },
      );
    }
    return pending;
  };
}
