// The settings the NOHM server publishes for the website (GET
// /config/web): the Stripe publishable key and the Google OAuth client
// id. The site keeps no copy of either. If the call fails or a value is
// missing, that feature is off and the screen says so (fail closed):
// no card form, no Google button, never a built-in fallback.

/** Card entry is off: said the same way wherever it shows. */
export const CARD_UNAVAILABLE = 'Card entry isn’t available right now. Try again in a few minutes, or add your card in the NOHM app.';
/** Google sign-in is off. */
export const GOOGLE_UNAVAILABLE = 'Continue with Google isn’t available right now. Use your phone or email instead.';

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
 * A loader that asks the server once per page and shares the answer.
 * A failed call resolves to the empty config (both features off) and
 * is asked again next time a screen needs it.
 */
export function createWebConfig(api) {
  let pending = null;
  return function webConfig() {
    if (!pending) {
      pending = api.webConfig().then(normalizeWebConfig, () => {
        pending = null;
        return normalizeWebConfig(null);
      });
    }
    return pending;
  };
}
