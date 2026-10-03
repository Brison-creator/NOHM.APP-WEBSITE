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
  { id: 't-hvac', name: 'HVAC', label: 'HVAC', isActive: true, bookable: true, sortOrder: 1, licenseRequired: true, enabledByMarket: true },
  { id: 't-plumb', name: 'PLUMBING', label: 'Plumbing', isActive: true, bookable: true, sortOrder: 2, licenseRequired: true, enabledByMarket: true },
  { id: 't-elec', name: 'ELECTRICAL', label: 'Electrical', isActive: true, bookable: true, sortOrder: 3 },
  { id: 't-roof', name: 'ROOFING', label: 'Roofing', isActive: true, bookable: true, sortOrder: 4 },
  { id: 't-appl', name: 'APPLIANCE', label: 'Appliance', isActive: true, bookable: true, sortOrder: 5, licenseRequired: false, enabledByMarket: true },
  { id: 't-make', name: 'MAKE_READY', label: 'Make Ready', isActive: true, bookable: false, sortOrder: 6 },
];
let PRICING = {
  EXPRESS_PRIORITY_FEE: { key: 'EXPRESS_PRIORITY_FEE', baseAmountCents: 4000, currentAmountCents: 2000, hasLiveDiscount: true, savingsCents: 2000, promoLabel: 'Launch pricing' },
  NOHM_NOW_FEE: { key: 'NOHM_NOW_FEE', baseAmountCents: 6000, currentAmountCents: 3000, hasLiveDiscount: true, savingsCents: 3000, promoLabel: 'Launch pricing' },
};
// A made-up test key: the page must use whatever the server publishes.
const STUB_STRIPE_KEY = 'pk_test_stubFromServer123';
const SIGNUP_ROLES = ['HOMEOWNER', 'PROPERTY_MANAGER', 'TENANT', 'CONTRACTOR'];
const TAKEN_PHONE = '+15125550100';
const USER = { id: 'u1', firstName: 'Ava', lastName: 'Ng', email: 'ava@example.com', phone: '+15125550123', role: 'HOMEOWNER' };
const world = { properties: [], jobs: {}, hasCard: process.env.STUB_HAS_CARD !== 'false', seq: 1041, offers: {}, role: 'HOMEOWNER', pro: freshPro(), stripeDone: false, tenant: { linked: false }, otpSent: {}, webConfig: 'ok', phoneOtp: {} };
function freshPro() {
  return { contractorId: 'C-000042', applicationStatus: 'DRAFT', dispatchEligible: false, shiftStatus: 'OFF_SHIFT', profile: { businessName: 'Not Provided', baseZip: null, serviceRadius: null, attestedAt: null, attestedName: null, stripeComplete: false, videoCompleted: false }, trades: [], documents: [] };
}
function proChecklist(p) {
  const docs = Object.fromEntries(p.documents.map((d) => [d.docType, d]));
  const primary = p.trades[0];
  return { checklist: {
    publicProfile: Boolean(p.profile.businessName && p.profile.businessName !== 'Not Provided' && p.profile.baseZip && p.profile.serviceRadius),
    tradesSelected: p.trades.length > 0, activationFeePaid: false, stripeConnect: p.profile.stripeComplete,
    headshot: Boolean(docs.HEADSHOT), driversLicense: Boolean(docs.DRIVERS_LICENSE), tradeLicense: primary && primary.licenseRequired ? Boolean(docs.TRADE_LICENSE) : null, insurance: Boolean(docs.INSURANCE_PROOF),
    videoCompleted: p.profile.videoCompleted, attestation: Boolean(p.profile.attestedAt) }, tradeLicenseRequired: Boolean(primary && primary.licenseRequired) };
}
// propertyAddress is the home's formattedAddress, city and state included, as the server sends it.
const INVITE = { inviteCode: '482913', tenantName: 'Ava Ng', propertyAddress: '11008 Chambers Rd, Bauxite, AR 72011, USA', propertyCity: 'Bauxite', propertyState: 'AR', landlordName: 'Kristi M.', rentAmount: 1250, leaseStartDate: '2026-11-01', leaseDueDay: 1, leaseEndDate: null };

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
      const fields = {};
      for (const m of raw.toString('latin1').matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)\r\n/g)) if (!m[0].includes('filename=')) fields[m[1]] = m[2];
      const files = multipartFiles(raw, req.headers['content-type'] || '');
      resolve({ _bytes: raw.length, _contentType: req.headers['content-type'] || '', _fields: fields, _files: files });
    });
  });
}

// The file parts of a multipart body: field, name, type, size, and the
// image's pixel size (JPEG or PNG) so a test can see what was sent.
function multipartFiles(raw, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;\s]+))/.exec(contentType);
  if (!m) return [];
  const boundary = Buffer.from(`--${m[1] || m[2]}`);
  const out = [];
  let at = raw.indexOf(boundary);
  while (at !== -1) {
    const start = at + boundary.length;
    if (raw.slice(start, start + 2).toString() === '--') break;
    const next = raw.indexOf(boundary, start);
    if (next === -1) break;
    const part = raw.slice(start + 2, next - 2);
    const sep = part.indexOf('\r\n\r\n');
    const head = part.slice(0, sep).toString('latin1');
    const filename = /filename="([^"]*)"/.exec(head);
    if (filename) {
      const data = part.slice(sep + 4);
      out.push({ field: (/name="([^"]*)"/.exec(head) || [])[1], name: filename[1], type: ((/Content-Type:\s*([^\r\n]+)/i.exec(head) || [])[1] || '').trim(), size: data.length, ...imageSize(data) });
    }
    at = next;
  }
  return out;
}
function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return {};
}
// The server's request cap (common/http/request-limits.ts): anything
// declared over 25 MB is refused before it's read.
const UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

// The real server's ValidationPipe (whitelist + forbidNonWhitelisted):
// a field it doesn't know, or a required one missing, is a 400. Field
// lists from the DTOs (backend/src/modules/**/dto).
const DEVICE = ['deviceId', 'deviceName', 'deviceType', 'appVersion'];
const BODIES = {
  'POST /auth/login/email-password': { required: ['email', 'password', 'deviceId'], optional: [...DEVICE, 'deviceSecret'] },
  'POST /auth/login/verify-device-otp': { required: ['email', 'code', 'deviceId'], optional: [...DEVICE, 'trustDevice'] },
  'POST /auth/email-signup/send-otp': { required: ['firstName', 'lastName', 'email', 'phone', 'password', 'role'] },
  'POST /auth/email-signup/verify-otp': { required: ['phone', 'code', 'firstName', 'lastName', 'email', 'password', 'role', ...DEVICE] },
  'POST /auth/phone-signup/send-otp': { required: ['phone', 'role'] },
  'POST /auth/phone-signup/verify-otp': { required: ['phone', 'code', 'firstName', 'lastName', 'role', ...DEVICE], optional: ['email'] },
  'POST /properties/check-type': { required: ['googlePlaceId', 'formattedAddress', 'latitude', 'longitude'] },
  'POST /properties/shell': { required: ['googlePlaceId', 'formattedAddress', 'latitude', 'longitude'] },
  'POST /jobs': { required: ['propertyId', 'title', 'description', 'tradeId', 'idempotencyKey'], optional: ['urgency', 'scheduledDate', 'scheduledTimeWindow', 'photos', 'isExpress', 'shownFeeCents', 'useCreditsForExpressFee', 'diagnosticQuestion'] },
  'POST /now/dispatch': { required: ['availabilityId', 'propertyId', 'tradeId', 'issueSummary'], optional: ['shownFeeCents', 'emergencyId'] },
  'POST /contractors/attestation': { required: ['attestedName'] },
};
function bodyProblem(method, p, body) {
  const rule = BODIES[`${method} ${p}`] || (method === 'POST' && /^\/properties\/[^/]+\/confirm$/.test(p) ? { required: ['structureType'] } : null);
  if (!rule || !body || body._contentType) return null;
  const allowed = new Set([...rule.required, ...(rule.optional || [])]);
  for (const k of Object.keys(body)) if (!allowed.has(k)) return `property ${k} should not exist`;
  for (const k of rule.required) if (body[k] === undefined || body[k] === '') return `${k} should not be empty`;
  return null;
}
// scheduledDate is the homeowner's local midnight; the server adds the
// window's start hour itself (time-window.util.ts).
const LOCAL_MIDNIGHT = /^\d{4}-\d{2}-\d{2}T00:00:00[+-]\d{2}:\d{2}$/;

function api(method, url, body, req) {
  const auth = req.headers.authorization || null;
  const p = url.pathname.replace('/api/v1', '');
  const bad = bodyProblem(method, p, body);
  if (bad) return [400, { message: [bad] }];
  const needAuth = () => (auth === 'Bearer acc-1' ? null : json);
  if (p === '/trades' && method === 'GET') return [200, TRADES];
  if (p === '/config/pricing' && method === 'GET') return [200, PRICING];
  // GET /config/web (app-version/web-config.controller.ts): public; null for a value the server doesn't have.
  if (p === '/config/web' && method === 'GET') {
    if (world.webConfig === 'fail') return [503, { message: 'Service Unavailable' }];
    if (world.webConfig === 'empty') return [200, { stripePublishableKey: null, googleClientId: null }];
    return [200, { stripePublishableKey: STUB_STRIPE_KEY, googleClientId: null }];
  }
  if (p === '/auth/check-exists') return [200, { exists: body.email === 'taken@example.com' }];
  if (p === '/auth/email-signup/send-otp') return body.email === 'taken@example.com' ? [409, { message: 'Email already registered' }] : [200, { message: 'OTP sent' }];
  if (p === '/auth/email-signup/verify-otp') { if (body.code !== '123456') return [400, { message: 'Invalid or expired code' }]; world.role = body.role || 'HOMEOWNER'; world.user = { ...USER, firstName: body.firstName, lastName: body.lastName, email: body.email, phone: body.phone, role: world.role }; return [201, { accessToken: 'acc-1', refreshToken: 'ref-1', user: world.user }]; }
  // Phone sign-up (auth.controller.ts, auth-signup.service.ts): a taken phone is a 409 before any text.
  if (p === '/auth/phone-signup/send-otp') {
    if (!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(body.phone)) return [400, { message: ['phone must be a valid phone number'] }];
    if (!SIGNUP_ROLES.includes(body.role)) return [400, { message: ['role must be a signup account type'] }];
    if (body.phone === TAKEN_PHONE) return [409, { message: 'This phone number already has an account. Please sign in with your email and password.' }];
    world.phoneOtp[body.phone] = true;
    return [200, { message: 'OTP sent successfully' }];
  }
  if (p === '/auth/phone-signup/verify-otp') {
    if (body.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) return [400, { message: ['email must be an email'] }];
    if (body.firstName.length > 60 || body.lastName.length > 60) return [400, { message: ['firstName must be shorter than or equal to 60 characters'] }];
    if (!SIGNUP_ROLES.includes(body.role)) return [400, { message: ['role must be a signup account type'] }];
    if (!world.phoneOtp[body.phone] || body.code !== '123456') return [401, { message: 'Invalid OTP' }];
    if (body.email === 'taken@example.com') return [409, { message: 'This email already has an account. Please sign in with your email and password.' }];
    world.role = body.role;
    world.user = { ...USER, firstName: body.firstName, lastName: body.lastName, email: body.email || null, phone: body.phone, role: world.role };
    return [200, { accessToken: 'acc-1', refreshToken: 'ref-1', user: world.user }];
  }
  if (p === '/auth/login/email-password') return body.password === 'password1' ? [200, { status: 'authenticated', accessToken: 'acc-1', refreshToken: 'ref-1', user: USER }] : [401, { message: 'Invalid credentials' }];
  if (p === '/auth/refresh') return body.refreshToken === 'ref-1' ? [200, { accessToken: 'acc-1', refreshToken: 'ref-1' }] : [401, { message: 'bad refresh' }];
  if (p === '/auth/logout') return [200, { success: true }];
  if (auth !== 'Bearer acc-1') return [401, { message: 'Unauthorized' }];
  // The server's role guards (RolesGuard on the account's caps).
  const guard = [
    [/^\/contractors\//, ['CONTRACTOR']],
    [/^\/stripe\/connect\//, ['CONTRACTOR']],
    [/^\/tenants\/(my-invites|my-property)$/, ['TENANT']],
    [/^\/properties(\/|$)/, ['HOMEOWNER', 'PROPERTY_MANAGER']],
    [/^\/jobs$/, ['HOMEOWNER', 'PROPERTY_MANAGER']],
  ].find(([re]) => re.test(p));
  if (guard && !guard[1].includes(world.role)) return [403, { message: 'Forbidden resource' }];
  if (p === '/auth/me') return [200, { user: { ...(world.user || USER), role: world.role, caps: [world.role], homeownerProfile: { properties: world.properties } } }];
  // ── Pros ──
  if (p === '/contractors/dashboard') { const pr = world.pro; return [200, { contractorId: pr.contractorId, applicationStatus: pr.applicationStatus, dispatchEligible: pr.dispatchEligible, shiftStatus: pr.shiftStatus, ...proChecklist(pr), profile: (({ attestedName, ...rest }) => rest)(pr.profile), user: { ...(world.user || USER), role: 'CONTRACTOR' }, trades: pr.trades, documents: pr.documents }]; }
  if (p === '/contractors/profile' && method === 'PATCH') {
    const req = ['firstName', 'lastName', 'businessName', 'baseZip', 'serviceRadius'];
    for (const k of req) if (body[k] === undefined || body[k] === '') return [400, { message: [`${k} should not be empty`] }];
    const allowed = new Set([...req, 'primaryTradeId', 'secondaryTradeId', 'bio', 'licenseNumber', 'serviceCallFeeRange', 'hourlyRateRange', 'yearsExperience']);
    for (const k of Object.keys(body)) if (!allowed.has(k)) return [400, { message: [`property ${k} should not exist`] }];
    if (!/^\d{5}$/.test(body.baseZip)) return [400, { message: ['baseZip must be a 5-digit ZIP code'] }];
    if (![10, 20, 30].includes(body.serviceRadius)) return [400, { message: ['serviceRadius must be one of the following values: 10, 20, 30'] }];
    if (world.pro.applicationStatus === 'PENDING_DOC_REVIEW') return [403, { message: 'Profile is locked during review' }];
    Object.assign(world.pro.profile, { businessName: body.businessName, baseZip: body.baseZip, serviceRadius: body.serviceRadius, bio: body.bio || null, licenseNumber: body.licenseNumber || null, yearsExperience: body.yearsExperience ?? null, serviceCallFeeRange: (body.serviceCallFeeRange || '').replace(/[^\d.]/g, '') || null, hourlyRateRange: (body.hourlyRateRange || '').replace(/[^\d.]/g, '') || null });
    world.pro.trades = [body.primaryTradeId, body.secondaryTradeId].filter(Boolean).map((id) => TRADES.find((t) => t.id === id)).filter(Boolean);
    return [200, { ...world.pro.profile, trades: world.pro.trades }];
  }
  if (p === '/contractors/documents' && method === 'POST') {
    if (world.pro.applicationStatus === 'PENDING_DOC_REVIEW') return [403, { message: 'Documents are locked during review' }];
    const docType = body._fields && body._fields.docType;
    if (!['HEADSHOT', 'DRIVERS_LICENSE', 'TRADE_LICENSE', 'INSURANCE_PROOF'].includes(docType)) return [400, { message: 'Invalid docType' }];
    world.pro.documents = world.pro.documents.filter((d) => d.docType !== docType);
    const doc = { id: `doc-${docType}`, docType, fileName: 'x', reviewStatus: 'PENDING', rejectionNotes: null };
    world.pro.documents.push(doc);
    return [201, doc];
  }
  if (p === '/contractors/documents' && method === 'GET') return [200, world.pro.documents];
  if (p === '/contractors/attestation') { if (world.pro.profile.attestedAt) return [403, { message: 'Already attested' }]; world.pro.profile.attestedAt = new Date().toISOString(); world.pro.profile.attestedName = body.attestedName; return [201, { attestedAt: world.pro.profile.attestedAt, attestedName: body.attestedName }]; }
  if (p === '/contractors/video-complete') { world.pro.profile.videoCompleted = true; return [201, { videoCompleted: true }]; }
  if (p === '/contractors/submit-review') { const c = proChecklist(world.pro).checklist; const miss = ['publicProfile', 'tradesSelected', 'stripeConnect', 'attestation'].filter((k) => !c[k]); if (miss.length) return [400, { message: `Incomplete steps: ${miss.join(', ')}` }]; world.pro.applicationStatus = 'PENDING_DOC_REVIEW'; return [201, { applicationStatus: 'PENDING_DOC_REVIEW' }]; }
  if (p === '/stripe/connect/create' || p === '/stripe/connect/refresh') { world.stripeAccount = true; return [201, { url: `http://localhost:${PORT}/stripe/return/`, expiresAt: new Date(Date.now() + 300000).toISOString() }]; }
  if (p === '/stripe/connect/status') { if (world.stripeDone) world.pro.profile.stripeComplete = true; return [200, world.stripeAccount ? { hasAccount: true, stripeComplete: world.stripeDone, chargesEnabled: world.stripeDone, payoutsEnabled: world.stripeDone, detailsSubmitted: world.stripeDone } : { hasAccount: false, stripeComplete: false, payoutEnabled: false }]; }
  // ── Renters ──
  if (p === '/tenants/my-invites') return [200, world.tenant.linked ? [] : [INVITE]];
  let im = /^\/tenants\/invite\/(\d+)$/.exec(p);
  if (im && method === 'GET') return im[1] === INVITE.inviteCode ? [200, INVITE] : [404, { message: 'Invite not found' }];
  im = /^\/tenants\/invite\/(\d+)\/send-otp$/.exec(p);
  if (im) { if (im[1] !== INVITE.inviteCode) return [404, { message: 'Invite not found' }]; world.otpSent[im[1]] = true; return [201, { success: true, expiresIn: 300 }]; }
  im = /^\/tenants\/invite\/(\d+)\/accept$/.exec(p);
  if (im) { if (!world.otpSent[im[1]]) return [400, { message: 'Request a code first' }]; if (body.otpCode !== '123456') return [400, { message: 'Invalid or expired code' }]; world.tenant.linked = true; return [201, { success: true, leaseId: 'lease-1', property: { id: 'p-9', address: INVITE.propertyAddress, city: INVITE.propertyCity, state: INVITE.propertyState } }]; }
  if (p === '/tenants/my-property') return [200, world.tenant.linked ? { hasProperty: true, property: { id: 'p-9', hin: '7QW-3HN-2KD', address: INVITE.propertyAddress, city: INVITE.propertyCity, state: INVITE.propertyState, zipCode: '72011' }, lease: { id: 'lease-1', rentAmount: 1250, startDate: '2026-11-01', endDate: null, dueDay: 1 }, landlord: { name: 'Kristi M.', phone: '+15015550100' } } : { hasProperty: false }];
  // GET /nohmcredit/balance (nohmcredit.service.ts getBalance): whole credits.
  if (p === '/nohmcredit/balance') return [200, { balance: world.credits || 0, pendingBalance: 0, totalBalance: world.credits || 0 }];
  if (p === '/properties' && method === 'GET') return [200, { properties: world.properties, total: world.properties.length }];
  if (p === '/stripe/customer/payment-method') return [200, world.hasCard ? { hasCard: true, last4: '4242', brand: 'visa' } : { hasCard: false }];
  if (p === '/stripe/customer/setup-intent') return [201, { clientSecret: 'seti_secret', customerId: 'cus_1' }];
  if (p === '/stripe/customer/confirm-card') { world.hasCard = true; return [201, { success: true, last4: '4242', brand: 'visa' }]; }
  if (p === '/places/autocomplete') return [200, { predictions: [{ placeId: 'pl-1', mainText: '11008 Chambers Rd', secondaryText: 'Bauxite, AR, USA', description: '11008 Chambers Rd, Bauxite, AR, USA' }] }];
  if (p === '/places/details') return [200, { placeId: 'pl-1', formattedAddress: '11008 Chambers Rd, Bauxite, AR 72011, USA', latitude: 34.55, longitude: -92.5 }];
  if (p === '/properties/check-type') return [201, { isMultiFamily: false, propertyType: 'SINGLE_FAMILY', existingProperty: false, message: 'ok' }];
  if (p === '/properties/shell') { const prop = { id: 'p-1', hin: null, structureStatus: 'PENDING_STRUCTURE', formattedAddress: body.formattedAddress, city: 'Bauxite', state: 'AR', zipCode: '72011' }; return [201, prop]; }
  if (p === '/properties/p-1/confirm') { const prop = { id: 'p-1', hin: '4K7-M2Q-9XC', structureStatus: 'CONFIRMED_SINGLE', formattedAddress: '11008 Chambers Rd, Bauxite, AR 72011, USA', city: 'Bauxite', state: 'AR', zipCode: '72011' }; world.properties = [prop]; return [201, prop]; }
  if (p === '/jobs/cancellation-terms' && url.searchParams.has('scheduledDate') && !LOCAL_MIDNIGHT.test(url.searchParams.get('scheduledDate'))) return [400, { message: 'scheduledDate must be local midnight with its offset' }];
  if (p === '/jobs/cancellation-terms') return [200, { tier: 'SCHEDULED', version: 1, feeCents: 7500, disclosure: 'Free to cancel up to 24 hours before your arrival window. After that, a $75 service call fee applies. Always free if your pro misses the window.' }];
  if (p === '/jobs' && method === 'POST') {
    if (!world.hasCard) return [400, { code: 'PAYMENT_METHOD_REQUIRED', message: 'Add a card to book.', action: 'ADD_CARD' }];
    if (world.conflicts > 0) { world.conflicts--; return [409, { message: 'This request was already used. Try again.' }]; }
    if (body.isExpress && body.shownFeeCents !== PRICING.EXPRESS_PRIORITY_FEE.currentAmountCents) return [400, { code: 'PRICE_CHANGED', amountCents: PRICING.EXPRESS_PRIORITY_FEE.currentAmountCents, message: 'Price changed' }];
    if (!body.isExpress && !LOCAL_MIDNIGHT.test(body.scheduledDate || '')) return [400, { message: ['scheduledDate must be local midnight with its offset'] }];
    const existing = Object.values(world.jobs).find((j) => j.idempotencyKey === body.idempotencyKey);
    if (existing) return [201, existing];
    const id = `j-${++world.seq}`;
    const job = { id, jobNumber: `NOHM-${world.seq}`, status: 'AWAITING_ACCEPTANCE', priority: body.isExpress ? 'EXPRESS' : 'STANDARD', ...body, photos: [] };
    world.jobs[id] = job;
    world.offers[id] = [{ contractorId: 'c-1', contractor: { id: 'c-1', businessName: 'Diaz Plumbing', averageRating: 4.9, completedJobsCount: 212, yearsExperience: 11, hasNohmProBadge: true, user: { firstName: 'Ray', lastName: 'Diaz' } } }];
    return [201, job];
  }
  // POST /jobs/:id/photos (jobs.controller.ts): multer field `files`, up to 5,
  // each at most 10 MB and image/(jpeg|png|webp|heic|heif); appended; 200.
  let m = /^\/jobs\/([^/]+)\/photos$/.exec(p);
  if (m && method === 'POST') {
    const j = world.jobs[m[1]];
    if (!j) return [404, { message: 'Job not found' }];
    const files = body._files || [];
    if (files.some((f) => f.field !== 'files')) return [400, { message: 'Unexpected field' }];
    if (files.length > 5) return [400, { message: 'Too many files' }];
    if (!files.length) return [400, { message: 'File is required' }];
    const big = files.find((f) => f.size > 10 * 1024 * 1024);
    if (big) return [400, { message: `Validation failed (current file size is ${big.size}, expected size is less than 10485760)` }];
    if (files.some((f) => !/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type))) return [400, { message: 'Validation failed (expected type is /^image\\/(jpeg|png|webp|heic|heif)$/)' }];
    world.photoPosts = (world.photoPosts || 0) + 1;
    if (world.photoFailAt === world.photoPosts) return [413, { statusCode: 413, message: 'That upload is too large.' }];
    for (const f of files) j.photos.push(`https://cdn.test/${m[1]}/${f.name}`);
    return [200, j];
  }
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
  if (url.pathname === '/__reset') { log.length = 0; world.properties = []; world.jobs = {}; world.hasCard = url.searchParams.get('card') !== 'false'; world.seq = 1041; world.role = 'HOMEOWNER'; world.user = null; world.conflicts = 0; PRICING.EXPRESS_PRIORITY_FEE.currentAmountCents = 2000; PRICING.EXPRESS_PRIORITY_FEE.hasLiveDiscount = true; world.pro = freshPro(); world.stripeDone = false; world.stripeAccount = false; world.tenant = { linked: false }; world.otpSent = {}; world.webConfig = 'ok'; world.photoPosts = 0; world.photoFailAt = 0; world.credits = 0; world.phoneOtp = {}; return json(res, 200, { ok: true }); }
  if (url.pathname === '/__express-price') { const c = Number(url.searchParams.get('cents')); PRICING.EXPRESS_PRIORITY_FEE.currentAmountCents = c; PRICING.EXPRESS_PRIORITY_FEE.hasLiveDiscount = c < PRICING.EXPRESS_PRIORITY_FEE.baseAmountCents; return json(res, 200, { ok: true }); }
  if (url.pathname === '/__conflicts') { world.conflicts = Number(url.searchParams.get('n') || 0); return json(res, 200, { ok: true }); }
  if (url.pathname === '/__photo-fail') { world.photoFailAt = Number(url.searchParams.get('nth') || 0); world.photoPosts = 0; return json(res, 200, { ok: true }); }
  if (url.pathname === '/__credits') { world.credits = Number(url.searchParams.get('n') || 0); return json(res, 200, { ok: true }); }
  if (url.pathname === '/__webconfig') { world.webConfig = url.searchParams.get('mode') || 'ok'; return json(res, 200, { ok: true }); }
  if (url.pathname === '/__stripe-done') { world.stripeDone = true; return json(res, 200, { ok: true }); }
  if (url.pathname.startsWith('/api/v1/')) {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > UPLOAD_MAX_BYTES) {
      log.push({ method: req.method, path: url.pathname.replace('/api/v1', ''), auth: req.headers.authorization || null, body: { _bytes: declared }, status: 413 });
      req.resume();
      return json(res, 413, { statusCode: 413, message: 'That upload is too large.' });
    }
    const body = await readBody(req);
    const entry = { method: req.method, path: url.pathname.replace('/api/v1', '') + url.search, auth: req.headers.authorization || null, body };
    log.push(entry);
    const [status, out] = api(req.method, url, body, req);
    entry.status = status;
    if (status === 400) {
      entry.error = out;
      console.log(`400 ${req.method} ${entry.path} ${JSON.stringify(out)}`);
    }
    return json(res, status, out);
  }
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`stub NOHM at http://localhost:${PORT}  (/book uses window.NOHM_BOOK.apiBase; override with ?api=)`));
