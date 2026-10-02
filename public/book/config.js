// Settings for /book, the website's request-a-service flow. A plain
// script (not a module) so the page can read it before anything loads.
//
// apiBase: the NOHM server. The server's CORS_ORIGIN must list this
//   site's origin (https://nohm.app and https://www.nohm.app) or the
//   browser refuses every call.
// stripePublishableKey: public by design (the app ships the same key);
//   it only lets the browser tokenize a card. Charges need the secret
//   key, which lives on the server.
// googleClientId: the web OAuth client the server verifies Google
//   sign-ins against. Leave empty to hide "Continue with Google"; it
//   also needs this site's origin in the Google console's authorized
//   JavaScript origins.
window.NOHM_BOOK = {
  apiBase: 'https://api.nohm.app/api/v1',
  stripePublishableKey: 'pk_live_51Ssr6TGRifyQNvisAhdcN4bxhMn0CIzJhoTwhy2HC43a7vCmMl8ydkvR3PSMXcCzFcJEEJTtF9QvvsuTTf3igRt5007K5t99sr',
  googleClientId: '',
  appStore: 'https://apps.apple.com/us/app/nohm-app/id6761128513',
  playStore: 'https://play.google.com/store/apps/details?id=com.nohm.app',
};
