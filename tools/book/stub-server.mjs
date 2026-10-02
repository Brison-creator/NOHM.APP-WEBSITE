// A stand-in NOHM server for trying /book without the real one:
//   node tools/book/stub-server.mjs [port]
// Serves public/ and answers the endpoints /book calls with the shapes
// the real controllers return. It records every request at
// GET /__log so a test can check exactly what the page sent. Nothing
// here is the real server; the real rules live in the-nohm-application-1.1.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const PORT = Number(process.argv[2] || process.env.PORT || 8787);
const log = [];
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webp': 'image/webp' };

const TRADES = [
  { id: 't-hvac', name: 'HVAC', label: 'HVAC', isActive: true, bookable: true, sortOrder: 1 },
  { id: 't-plumb', name: 'PLUMBING', label: 'Plumbing', isActive: true, bookable: true, sortOrder: 2 },
  { id: 't-elec', name: 'ELECTRICAL', label: 'Electrical', isActive: true, bookable: true, sortOrder: 3 },
  { id: 't-roof', name: 'ROOFING', label: 'Roofing', isActive: true, bookable: true, sortOrder: 4 },
  { id: 't-appl', name: 'APPLIANCE', label: 'Appliance', isActive: true, bookable: true, sortOrder: 5 },
  { id: 't-make', name: 'MAKE_READY', label: 'Make Ready', isActive: true, bookable: false, sortOrder: 6 },
];
const PRICING = {
  EXPRESS_PRIORITY_FEE: { key: 'EXPRESS_PRIORITY_FEE', baseAmountCents: 4000, currentAmountCents: 2000, hasLiveDiscount: true, savingsCents: 2000, promoLabel: 'Launch pricing' },
  NOHM_NOW_FEE: { key: 'NOHM_NOW_FEE', baseAmountCents: 6000, currentAmountCents: 3000, hasLiveDiscount: true, savingsCents: 3000, promoLabel: 'Launch pricing' },
};
const USER = { id: 'u1', firstName: 'Ava', lastName: 'Ng', email: 'ava@example.com', phone: '+15125550123', role: 'HOMEOWNER' };
const world = { properties: [], jobs: {}, hasCard: process.env.STUB_HAS_CARD !== 'false', seq: 1041, offers: {} };

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      if ((req.headers['content-type'] || '').startsWith('application/json')) {
        try { return resolve(JSON.parse(raw.toString() || '{}')); } catch { return resolve({}); }
      }
      resolve({ _bytes: raw.length, _contentType: req.headers['content-type'] || '' });
    });
  });
}

function api(method, url, body, req) {
  const auth = req.headers.authorization || null;
  const p = url.pathname.replace('/api/v1', '');
  const needAuth = () => (auth === 'Bearer acc-1' ? null : json);
  if (p === '/trades' && method === 'GET') return [200, TRADES];
  if (p === '/config/pricing' && method === 'GET') return [200, PRICING];
  if (p === '/auth/check-exists') return [200, { exists: body.email === 'taken@example.com' }];
  if (p === '/auth/email-signup/send-otp') return body.email === 'taken@example.com' ? [409, { message: 'Email already registered' }] : [200, { message: 'OTP sent' }];
  if (p === '/auth/email-signup/verify-otp') return body.code === '123456' ? [201, { accessToken: 'acc-1', refreshToken: 'ref-1', user: USER }] : [400, { message: 'Invalid or expired code' }];
  if (p === '/auth/login/email-password') return body.password === 'password1' ? [200, { status: 'authenticated', accessToken: 'acc-1', refreshToken: 'ref-1', user: USER }] : [401, { message: 'Invalid credentials' }];
  if (p === '/auth/refresh') return body.refreshToken === 'ref-1' ? [200, { accessToken: 'acc-1', refreshToken: 'ref-1' }] : [401, { message: 'bad refresh' }];
  if (p === '/auth/logout') return [200, { success: true }];
  if (auth !== 'Bearer acc-1') return [401, { message: 'Unauthorized' }];
  if (p === '/auth/me') return [200, { user: { ...USER, homeownerProfile: { properties: world.properties } } }];
  if (p === '/properties' && method === 'GET') return [200, { properties: world.properties, total: world.properties.length }];
  if (p === '/stripe/customer/payment-method') return [200, world.hasCard ? { hasCard: true, last4: '4242', brand: 'visa' } : { hasCard: false }];
  if (p === '/stripe/customer/setup-intent') return [201, { clientSecret: 'seti_secret', customerId: 'cus_1' }];
  if (p === '/stripe/customer/confirm-card') { world.hasCard = true; return [201, { success: true, last4: '4242', brand: 'visa' }]; }
  if (p === '/places/autocomplete') return [200, { predictions: [{ placeId: 'pl-1', mainText: '11008 Chambers Rd', secondaryText: 'Bauxite, AR, USA', description: '11008 Chambers Rd, Bauxite, AR, USA' }] }];
  if (p === '/places/details') return [200, { placeId: 'pl-1', formattedAddress: '11008 Chambers Rd, Bauxite, AR 72011, USA', latitude: 34.55, longitude: -92.5 }];
  if (p === '/properties/check-type') return [201, { isMultiFamily: false, propertyType: 'SINGLE_FAMILY', existingProperty: false, message: 'ok' }];
  if (p === '/properties/shell') { const prop = { id: 'p-1', hin: null, structureStatus: 'PENDING_STRUCTURE', formattedAddress: body.formattedAddress, city: 'Bauxite', state: 'AR', zipCode: '72011' }; return [201, prop]; }
  if (p === '/properties/p-1/confirm') { const prop = { id: 'p-1', hin: '4K7-M2Q-9XC', structureStatus: 'CONFIRMED_SINGLE', formattedAddress: '11008 Chambers Rd, Bauxite, AR 72011, USA', city: 'Bauxite', state: 'AR', zipCode: '72011' }; world.properties = [prop]; return [201, prop]; }
  if (p === '/jobs/cancellation-terms') return [200, { tier: 'SCHEDULED', version: 1, feeCents: 7500, disclosure: 'Free to cancel up to 24 hours before your arrival window. After that, a $75 service call fee applies. Always free if your pro misses the window.' }];
  if (p === '/jobs' && method === 'POST') {
    if (!world.hasCard) return [400, { code: 'PAYMENT_METHOD_REQUIRED', message: 'Add a card to book.', action: 'ADD_CARD' }];
    if (body.isExpress && body.shownFeeCents !== 2000) return [400, { code: 'PRICE_CHANGED', amountCents: 2000, message: 'Price changed' }];
    const existing = Object.values(world.jobs).find((j) => j.idempotencyKey === body.idempotencyKey);
    if (existing) return [201, existing];
    const id = `j-${++world.seq}`;
    const job = { id, jobNumber: `NOHM-${world.seq}`, status: 'AWAITING_ACCEPTANCE', priority: body.isExpress ? 'EXPRESS' : 'STANDARD', ...body, photos: [] };
    world.jobs[id] = job;
    world.offers[id] = [{ contractorId: 'c-1', contractor: { id: 'c-1', businessName: 'Diaz Plumbing', averageRating: 4.9, completedJobsCount: 212, yearsExperience: 11, hasNohmProBadge: true, user: { firstName: 'Ray', lastName: 'Diaz' } } }];
    return [201, job];
  }
  let m = /^\/jobs\/([^/]+)\/photos$/.exec(p);
  if (m) { const j = world.jobs[m[1]]; if (!j) return [404, { message: 'Job not found' }]; j.photos.push(`https://cdn.test/${m[1]}/photo.jpg`); return [201, j]; }
  m = /^\/jobs\/([^/]+)\/matched-contractors$/.exec(p);
  if (m) return world.jobs[m[1]] ? [200, { job: world.jobs[m[1]], offers: world.offers[m[1]] || [] }] : [404, { message: 'Job not found' }];
  m = /^\/jobs\/([^/]+)\/select-contractor$/.exec(p);
  if (m) return world.jobs[m[1]] ? [200, { success: true }] : [404, { message: 'Job not found' }];
  m = /^\/jobs\/([^/]+)$/.exec(p);
  if (m && method === 'GET') return world.jobs[m[1]] ? [200, world.jobs[m[1]]] : [404, { message: 'Job not found' }];
  if (p === '/now/live') return [200, { kind: 'PROS', pros: [{ availabilityId: 'av-1', contractorProfileId: 'c-2', contractorName: 'Express Plumbing', completedJobs: 88, averageRating: 4.8, etaMinutes: 22, hasNohmProBadge: true }] }];
  if (p === '/now/demand') return [201, { pinged: 3 }];
  if (p === '/now/dispatch') {
    if (!world.hasCard) return [400, { code: 'PAYMENT_METHOD_REQUIRED', message: 'Add a card to book.' }];
    if (body.shownFeeCents !== 3000) return [400, { code: 'PRICE_CHANGED', amountCents: 3000, message: 'Price changed' }];
    const id = `j-${++world.seq}`;
    const job = { id, jobNumber: `NOHM-${world.seq}`, status: 'DISPATCHED', priority: 'NOW', ...body, photos: [] };
    world.jobs[id] = job;
    return [201, job];
  }
  return [404, { message: `No stub for ${method} ${p}` }];
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' }); return res.end(); }
  if (url.pathname === '/__log') return json(res, 200, log);
  if (url.pathname === '/__reset') { log.length = 0; world.properties = []; world.jobs = {}; world.hasCard = url.searchParams.get('card') !== 'false'; world.seq = 1041; return json(res, 200, { ok: true }); }
  if (url.pathname.startsWith('/api/v1/')) {
    const body = await readBody(req);
    log.push({ method: req.method, path: url.pathname.replace('/api/v1', '') + url.search, auth: req.headers.authorization || null, body });
    const [status, out] = api(req.method, url, body, req);
    return json(res, status, out);
  }
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`stub NOHM at http://localhost:${PORT}  (/book uses window.NOHM_BOOK.apiBase; override with ?api=)`));
