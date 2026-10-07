// "I'm human": Cloudflare Turnstile on the forms that send a text or
// email code (sign-up, sign-in by code, password sign-in). The server
// checks the box's token before it sends anything (server
// common/human-check). The site key comes from the server
// (GET /config/web → turnstileSiteKey); without one there is no box and
// the server doesn't ask for it either.

import { h } from './dom.js';

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('no turnstile')));
      s.onerror = () => { loading = null; reject(new Error('Turnstile didn’t load')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** Said when the box is there but not ticked yet. */
export const TICK_FIRST = 'Confirm you’re human first (the box above the button).';

/**
 * The box for one form: { el, needed(), token(), reset() }.
 * needed() is true once the server gave a site key; token() is '' until
 * the visitor passes. Tokens work once: reset() after every send.
 */
export function humanCheck(webConfig) {
  const host = h('div.b-human', { hidden: true });
  let widget = null;
  let token = '';
  let needed = false;
  webConfig()
    .then((cfg) => {
      if (!cfg.turnstileSiteKey) return;
      needed = true;
      host.hidden = false;
      return loadTurnstile().then((ts) => {
        widget = ts.render(host, {
          sitekey: cfg.turnstileSiteKey,
          theme: 'light',
          size: 'flexible',
          callback: (t) => { token = t; },
          'expired-callback': () => { token = ''; },
          'error-callback': () => { token = ''; },
        });
      });
    })
    .catch(() => {});
  return {
    el: host,
    needed: () => needed,
    token: () => token,
    reset() {
      token = '';
      if (widget !== null && window.turnstile) window.turnstile.reset(widget);
    },
  };
}
