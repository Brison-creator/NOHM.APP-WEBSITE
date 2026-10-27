// "Continue with Google" through Google Identity Services. Loaded only
// when the account screen shows and a client id is configured. Gives
// back the ID token; the server verifies it (POST /auth/google/signin).

/**
 * The app whose built-in browser this page is open in ('facebook' or
 * 'instagram'), or null. Google won't sign in inside those browsers
 * (its "disallowed_useragent"), so the account screen sends them out.
 */
export function inAppBrowser(ua) {
  if (/Instagram/.test(ua || '')) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS/.test(ua || '')) return 'facebook';
  return null;
}

/**
 * This page in Chrome, from an Android app's built-in browser (an intent
 * link). `tags`, the visit's utm_ tags, ride along: Chrome starts a new tab.
 */
export function chromeLink(loc, tags) {
  const q = new URLSearchParams(loc.search || '');
  new URLSearchParams(tags || '').forEach((v, k) => { if (!q.has(k)) q.set(k, v); });
  const qs = q.toString();
  const path = `${loc.host}${loc.pathname}${qs ? `?${qs}` : ''}`;
  return `intent://${path}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(`https://${path}`)};end`;
}

let gisLoad = null;

function loadGis() {
  if (window.google && window.google.accounts) return Promise.resolve();
  if (!gisLoad) {
    gisLoad = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Couldn't load Google sign-in."));
      document.head.appendChild(s);
    });
  }
  return gisLoad;
}

/** Render Google's button into `host`; `onToken(idToken)` fires on success. */
let initialized = false;
let tokenHandler = null; // the latest mount's handler; GIS initializes once
export async function mountGoogleButton({ host, clientId, onToken }) {
  await loadGis();
  tokenHandler = onToken;
  if (!initialized) window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (res) => res && res.credential && tokenHandler && tokenHandler(res.credential),
    ux_mode: 'popup',
    auto_select: false,
  });
  initialized = true;
  window.google.accounts.id.renderButton(host, { theme: 'outline', size: 'large', width: host.clientWidth || 320, text: 'continue_with', shape: 'rectangular' });
}
