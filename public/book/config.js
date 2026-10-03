// Settings for /book, the website's request-a-service flow. A plain
// script (not a module) so the page can read it before anything loads.
//
// apiBase: the NOHM server. The server's CORS_ORIGIN must list this
//   site's origin (https://nohm.app and https://www.nohm.app) or the
//   browser refuses every call.
// The Stripe publishable key and the Google client id are not here:
//   the server publishes them (GET /config/web, nohm/web-config.js),
//   so the site never carries its own copy. The server's
//   GOOGLE_CLIENT_ID also needs this site's origin in the Google
//   console's authorized JavaScript origins.
window.NOHM_BOOK = {
  apiBase: 'https://api.nohm.app/api/v1',
  appStore: 'https://apps.apple.com/us/app/nohm-app/id6761128513',
  playStore: 'https://play.google.com/store/apps/details?id=com.nohm.app',
};
