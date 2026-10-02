// "Continue with Google" through Google Identity Services. Loaded only
// when the account screen shows and a client id is configured. Gives
// back the ID token; the server verifies it (POST /auth/google/signin).

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
