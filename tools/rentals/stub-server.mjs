// A stand-in NOHM server for trying /rentals without the real one:
//   node tools/rentals/stub-server.mjs [port]
// then open http://localhost:<port>/rentals/?api=http://localhost:<port>/api/v1
// Serves public/ and answers what /rentals calls, in the shapes the real
// server returns (backend src/modules/rentals/listing-search.ts and
// listings.service.ts publicView): GET /config/web, GET /listings/public,
// GET /listings/public/:slug and POST /listings/public/:slug/inquire.
// STUB_RENTALS=off answers as a server with the search switched off;
// STUB_TURNSTILE=off as one without the "I'm human" check. The e2e run
// stands in for Cloudflare's script, so its token is always "stub-token".
// Every request is kept at GET /__log. Photos are the site's own images.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const PORT = Number(process.argv[2] || process.env.PORT || 8790);
const BASE = `http://localhost:${PORT}`;
const OFF = process.env.STUB_RENTALS === 'off';
// The "I'm human" check: on unless STUB_TURNSTILE=off (then Contact takes questions only).
const HUMAN = process.env.STUB_TURNSTILE !== 'off';
const SITE_KEY = '0x4AAAAAAAstubSiteKey';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const log = [];

const photo = (...names) => names.map((n) => `${BASE}/img/${n}`);
// Fixture listings (made-up addresses), all in ZIP 72701 but the last.
const LISTINGS = [
  { slug: '412-maple-ave-a1b2c3', street: '412 Maple Ave', unit: null, city: 'Fayetteville', state: 'AR', zipCode: '72701', rentCents: 155000, depositCents: 155000, beds: 4, baths: 2, sqft: 1720, availableOn: '2026-11-01', leaseMonths: 12, pets: 'DOGS', homeType: 'HOUSE', latitude: 36.0626, longitude: -94.1574, photos: photo('home-960.jpg', 'renter-960.jpg', 'fixed-960.jpg', 'door-960.jpg'), description: 'A bright four-bedroom house on a quiet street, with a fenced back yard and a two-car driveway.\n\nThe kitchen was redone last year: new cabinets, quartz counters and a gas range. Washer and dryer hookups in the laundry room off the kitchen. Central heat and air. The primary bedroom has its own bath and a walk-in closet.\n\nLawn care is the tenant’s; the landlord handles repairs through NOHM. Rent is paid by bank in the NOHM app.' },
  { slug: '88-college-ave-2b-d4e5f6', street: '88 College Ave', unit: '2B', city: 'Fayetteville', state: 'AR', zipCode: '72701', rentCents: 98500, depositCents: 98500, beds: 1, baths: 1, sqft: 640, availableOn: '2026-10-01', leaseMonths: 12, pets: 'CATS', homeType: 'CONDO', latitude: 36.0689, longitude: -94.1606, photos: photo('move-in-488.jpg', 'washer-960.jpg'), description: 'One bedroom upstairs, walk to campus.' },
  { slug: '19-oak-st-g7h8i9', street: '19 Oak St', unit: null, city: 'Fayetteville', state: 'AR', zipCode: '72701', rentCents: 124000, depositCents: null, beds: 2, baths: 1.5, sqft: 980, availableOn: '2026-12-15', leaseMonths: 6, pets: 'ASK', homeType: 'TOWNHOUSE', latitude: null, longitude: null, photos: photo('ready-960.jpg', 'prep-960.jpg', 'flooring-960.jpg'), description: '' },
  { slug: '7-ridge-rd-j1k2l3', street: '7 Ridge Rd', unit: null, city: 'Fayetteville', state: 'AR', zipCode: '72701', rentCents: 210000, depositCents: 210000, beds: 3, baths: 2, sqft: 1500, availableOn: '2026-11-15', leaseMonths: 12, pets: 'CATS_AND_DOGS', homeType: 'HOUSE', latitude: 36.0551, longitude: -94.1431, photos: photo('landlord-960.jpg', 'standard-960.jpg'), description: 'Three bedrooms with a covered porch.' },
  { slug: '5-elm-ct-m4n5o6', street: '5 Elm Ct', unit: null, city: 'Springdale', state: 'AR', zipCode: '72762', rentCents: 140000, depositCents: 140000, beds: 3, baths: 2, sqft: 1300, availableOn: '2026-11-01', leaseMonths: 12, pets: 'NONE', homeType: 'HOUSE', latitude: 36.18, longitude: -94.13, photos: photo('crew-960.jpg'), description: '' },
];
const url = (slug) => `${BASE}/l/${slug}`;
const card = (l) => ({ slug: l.slug, url: url(l.slug), title: [l.street, l.unit].filter(Boolean).join(' '), street: l.street, unit: l.unit, city: l.city, state: l.state, zipCode: l.zipCode, rentCents: l.rentCents, beds: l.beds, baths: l.baths, sqft: l.sqft, availableOn: l.availableOn, pets: l.pets, photos: l.photos, latitude: l.latitude, longitude: l.longitude });
const detail = (l) => ({ slug: l.slug, street: l.street, unit: l.unit, city: l.city, state: l.state, zipCode: l.zipCode, rentCents: l.rentCents, depositCents: l.depositCents, beds: l.beds, baths: l.baths, sqft: l.sqft, availableOn: l.availableOn, leaseMonths: l.leaseMonths, pets: l.pets, description: l.description, photos: l.photos, homeType: l.homeType, latitude: l.latitude, longitude: l.longitude, url: url(l.slug), asksApplication: true, applicationFeeCents: 5000 });
const PETS_OK = { cats: ['CATS', 'CATS_AND_DOGS'], dogs: ['DOGS', 'CATS_AND_DOGS'] };

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function api(req, res, u, body) {
  const p = u.pathname.replace(/^\/api\/v1/, '');
  if (p === '/config/web') return send(res, 200, { stripePublishableKey: null, googleClientId: null, turnstileSiteKey: HUMAN ? SITE_KEY : null, publicRentalsSearch: !OFF });
  if (p === '/listings/public' && req.method === 'GET') {
    if (OFF) return send(res, 404, { statusCode: 404, message: 'Not Found' });
    const q = u.searchParams;
    if (!/^\d{5}$/.test(q.get('zip') || '')) return send(res, 400, { statusCode: 400, message: ['Enter a 5-digit ZIP code.'] });
    let rows = LISTINGS.filter((l) => l.zipCode === q.get('zip'));
    if (q.get('minBeds')) rows = rows.filter((l) => l.beds >= Number(q.get('minBeds')));
    if (q.get('maxRent')) rows = rows.filter((l) => l.rentCents <= Number(q.get('maxRent')) * 100);
    if (q.get('pets')) rows = rows.filter((l) => PETS_OK[q.get('pets')].includes(l.pets));
    const sort = q.get('sort') || 'newest';
    if (sort === 'rent') rows = [...rows].sort((a, b) => a.rentCents - b.rentCents);
    if (sort === 'rent_desc') rows = [...rows].sort((a, b) => b.rentCents - a.rentCents);
    const size = Math.min(24, Number(q.get('pageSize')) || 24);
    const page = Number(q.get('page')) || 1;
    return send(res, 200, { zip: q.get('zip'), sort, page, pageSize: size, hasMore: rows.length > page * size, listings: rows.slice((page - 1) * size, page * size).map(card) }, { 'Cache-Control': 'public, max-age=30' });
  }
  const m = /^\/listings\/public\/([a-z0-9-]+)(\/inquire)?$/.exec(p);
  if (m) {
    const l = LISTINGS.find((x) => x.slug === m[1]);
    if (!l) return send(res, 404, { statusCode: 404, message: 'This rental is no longer listed.' });
    if (!m[2] && req.method === 'GET') return send(res, 200, detail(l));
    if (m[2] && req.method === 'POST') {
      if (OFF) return send(res, 404, { statusCode: 404, message: 'Not Found' });
      // As WebOnlyHumanCheckGuard and fromSite: the token on every
      // request when the check is on; no application without it.
      if (HUMAN && !(body && body.humanToken)) return send(res, 403, { statusCode: 403, code: 'HUMAN_CHECK', message: 'Please confirm you’re human, then try again.' });
      if (!HUMAN && body && body.requestApplication) return send(res, 403, { statusCode: 403, code: 'APPLY_NEEDS_HUMAN_CHECK', message: 'Applying from here isn’t available right now. Tap Request to Apply instead.' });
      if (body && body.requestApplication && body.firstName === 'Fail') return send(res, 409, { statusCode: 409, code: 'APPLICATION_NOT_STARTED', message: 'The landlord has your message, but your application didn’t start. Tap Request to Apply to try again.' });
      if (body && body.requestApplication && body.phone) return send(res, 200, { token: 'stub-application-token' });
      return send(res, 200, { sent: true });
    }
  }
  return send(res, 404, { statusCode: 404, message: 'Not Found' });
}

http
  .createServer((req, res) => {
    const u = new URL(req.url, BASE);
    if (req.method === 'OPTIONS') return send(res, 204);
    if (u.pathname === '/__log') return send(res, 200, log);
    if (u.pathname.startsWith('/api/v1/')) {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        let body = null;
        try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
        log.push({ method: req.method, path: u.pathname + u.search, body });
        api(req, res, u, body);
      });
      return;
    }
    let file = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!file.startsWith(ROOT)) return send(res, 403);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`rentals stub on ${BASE}  →  ${BASE}/rentals/?api=${BASE}/api/v1`));
