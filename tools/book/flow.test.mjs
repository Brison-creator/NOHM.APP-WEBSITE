// node --test tools/book
// The booking flow's rules, checked without a browser: step order,
// what each step needs, the exact server bodies, and how server
// errors are routed. Run before pushing a change under public/book.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, emptyDraft, nextStep, prevStep, stepProblem, jobBody, nowDispatchBody, feeFor, tradeForSlug, bookableTrades, bookingErrorAction, restoreDraft, persistableDraft } from '../../public/book/lib/flow.js';
import { signupProblems, signupBody } from '../../public/nohm/signup.js';
import { issuesForTrade, ISSUES_FALLBACK, jobTitle } from '../../public/book/lib/issues.js';
import { toE164US, money, scheduledDateIso, bookableDays, windowOpenOn, randomId, prettyPhone } from '../../public/nohm/format.js';
import { createSession } from '../../public/nohm/session.js';
import { createHttp, ApiError } from '../../public/nohm/http.js';

const TRADES = [
  { id: 't-plumb', name: 'PLUMBING', label: 'Plumbing', bookable: true, isActive: true },
  { id: 't-hvac', name: 'HVAC', label: 'HVAC', bookable: true, isActive: true },
  { id: 't-make', name: 'MAKE_READY', label: 'Make Ready', bookable: false, isActive: true },
];
const PRICING = {
  EXPRESS_PRIORITY_FEE: { baseAmountCents: 4000, currentAmountCents: 2000, hasLiveDiscount: true, promoLabel: 'Launch' },
  NOHM_NOW_FEE: { baseAmountCents: 6000, currentAmountCents: 3000, hasLiveDiscount: true },
};

function readyDraft(tier = 'STANDARD') {
  const d = emptyDraft();
  d.trade = TRADES[0];
  d.issue = issuesForTrade('PLUMBING')[1];
  d.description = 'Kitchen sink drains slowly and gurgles.';
  d.tier = tier;
  d.day = '2026-10-03';
  d.window = 'MORNING';
  d.propertyId = 'p1';
  d.idempotencyKey = 'k1';
  return d;
}

test('steps: Standard visits the schedule; Express and NOW skip it; account and card skip when done', () => {
  const ctx0 = { signedIn: false, hasCard: false };
  assert.equal(nextStep('speed', { tier: 'STANDARD' }, ctx0), 'schedule');
  assert.equal(nextStep('speed', { tier: 'EXPRESS' }, ctx0), 'account');
  assert.equal(nextStep('speed', { tier: 'NOW' }, ctx0), 'account');
  assert.equal(nextStep('speed', { tier: 'NOW' }, { signedIn: true, hasCard: false }), 'home');
  assert.equal(nextStep('home', {}, { signedIn: true, hasCard: true }), 'review');
  assert.equal(nextStep('home', {}, { signedIn: true, hasCard: false }), 'card');
  assert.equal(prevStep('home', { tier: 'EXPRESS' }, { signedIn: true }), 'speed');
  assert.equal(prevStep('service', {}, ctx0), null);
  assert.deepEqual(STEPS.slice(0, 3), ['service', 'issue', 'details']);
});

test('each step says what it still needs', () => {
  const d = emptyDraft();
  assert.equal(stepProblem('service', d), 'Pick a service.');
  d.trade = TRADES[0];
  assert.equal(stepProblem('service', d), null);
  assert.ok(stepProblem('issue', d));
  d.issue = { title: 'Pipe leak' };
  assert.ok(stepProblem('details', d));
  d.description = 'leak';
  assert.equal(stepProblem('details', d), null);
  d.tier = 'NOW';
  assert.ok(stepProblem('details', d), 'NOW needs 10+ chars for issueSummary');
  d.description = 'Water under the sink, cabinet is wet.';
  assert.equal(stepProblem('details', d), null);
  d.photos = new Array(6).fill({});
  assert.ok(stepProblem('details', d));
  d.photos = [];
  d.tier = 'STANDARD';
  assert.equal(stepProblem('schedule', d), 'Pick a day.');
  d.day = '2026-10-03';
  assert.equal(stepProblem('schedule', d), 'Pick an arrival window.');
  d.window = 'MIDDAY';
  assert.equal(stepProblem('schedule', d), null);
  d.tier = 'EXPRESS';
  assert.equal(stepProblem('schedule', d), null, 'Express has no schedule');
  assert.ok(stepProblem('home', d));
});

test('POST /jobs body: Standard carries the window, Express the shown fee, never both', () => {
  const std = jobBody(readyDraft('STANDARD'), PRICING);
  assert.deepEqual(Object.keys(std).sort(), ['description', 'idempotencyKey', 'propertyId', 'scheduledDate', 'scheduledTimeWindow', 'title', 'tradeId']);
  assert.equal(std.title, 'Plumbing · Clogged drain');
  assert.equal(std.scheduledTimeWindow, 'MORNING');
  assert.match(std.scheduledDate, /^2026-10-03T08:00:00[+-]\d{2}:\d{2}$/);
  assert.equal(std.isExpress, undefined);
  assert.equal(std.shownFeeCents, undefined);

  const exp = jobBody(readyDraft('EXPRESS'), PRICING);
  assert.equal(exp.isExpress, true);
  assert.equal(exp.shownFeeCents, 2000, 'the launch price, not the base');
  assert.equal(exp.scheduledDate, undefined);
  assert.equal(exp.scheduledTimeWindow, undefined);

  assert.throws(() => jobBody(readyDraft('NOW'), PRICING), /nowDispatchBody/);
  assert.throws(() => jobBody(readyDraft('EXPRESS'), null), /Price not loaded/);
  const noKey = readyDraft();
  noKey.idempotencyKey = null;
  assert.throws(() => jobBody(noKey, PRICING), /idempotencyKey/);
});

test('POST /now/dispatch body carries the live pro, the summary and the shown NOW fee', () => {
  const b = nowDispatchBody(readyDraft('NOW'), 'avail-9', PRICING);
  assert.deepEqual(b, { availabilityId: 'avail-9', propertyId: 'p1', tradeId: 't-plumb', issueSummary: 'Kitchen sink drains slowly and gurgles.', shownFeeCents: 3000 });
  assert.throws(() => nowDispatchBody(readyDraft('NOW'), null, PRICING), /Pick a pro/);
});

test('fees come from the pricing map; a promo shows the base struck through; nothing is guessed', () => {
  assert.deepEqual(feeFor('STANDARD', PRICING), { current: 0, base: 0, discounted: false });
  assert.equal(feeFor('EXPRESS', PRICING).current, 2000);
  assert.equal(feeFor('EXPRESS', PRICING).discounted, true);
  assert.equal(feeFor('NOW', { NOHM_NOW_FEE: { baseAmountCents: 6000, currentAmountCents: 6000, hasLiveDiscount: false } }).discounted, false);
  assert.equal(feeFor('NOW', {}), null);
});

test('website slugs map to bookable server trades only', () => {
  assert.equal(tradeForSlug('plumbing', TRADES).id, 't-plumb');
  assert.equal(tradeForSlug('HVAC', TRADES).id, 't-hvac');
  assert.equal(tradeForSlug('make-ready', TRADES), null);
  assert.equal(tradeForSlug('handyman', TRADES), null);
  assert.deepEqual(bookableTrades(TRADES).map((t) => t.name), ['PLUMBING', 'HVAC']);
});

test('issues: the app catalog by trade, the generic four otherwise', () => {
  assert.equal(issuesForTrade('plumbing').length, 5);
  assert.equal(issuesForTrade('ROOFING')[0].title, 'Roof leak');
  assert.equal(issuesForTrade('LOCKSMITH'), ISSUES_FALLBACK);
  assert.equal(jobTitle('HVAC', 'No heat'), 'HVAC · No heat');
});

test('sign-up form: problems are named per field; the body is normalized', () => {
  assert.deepEqual(Object.keys(signupProblems({})).sort(), ['email', 'firstName', 'lastName', 'password', 'phone']);
  const f = { firstName: ' Ava ', lastName: 'Ng', email: ' Ava@Example.com ', phone: '(512) 555-0123', password: 'longenough' };
  assert.deepEqual(signupProblems(f), {});
  assert.deepEqual(signupBody(f), { firstName: 'Ava', lastName: 'Ng', email: 'ava@example.com', phone: '+15125550123', password: 'longenough', role: 'HOMEOWNER' });
  assert.equal(signupBody(f, 'CONTRACTOR').role, 'CONTRACTOR');
});

test('server errors route the way the app routes them', () => {
  assert.deepEqual(bookingErrorAction(new ApiError(400, { code: 'PAYMENT_METHOD_REQUIRED', message: 'Add a card' })), { kind: 'card' });
  assert.deepEqual(bookingErrorAction(new ApiError(400, { code: 'PRICE_CHANGED', amountCents: 4000, message: 'x' })), { kind: 'price_changed', amountCents: 4000 });
  assert.equal(bookingErrorAction(new ApiError(400, { code: 'DUPLICATE_TRADE_REQUEST', existingJob: { id: 'j' } })).kind, 'duplicate');
  assert.equal(bookingErrorAction(new ApiError(401, {})).kind, 'sign_in');
  assert.equal(bookingErrorAction(new ApiError(409, {})).kind, 'retry_same_key');
  assert.equal(bookingErrorAction(new ApiError(400, { code: 'PRO_JUST_BOOKED', message: 'Pick another' })).kind, 'pick_again');
  assert.deepEqual(bookingErrorAction(new ApiError(500, { message: 'boom' })), { kind: 'show', message: 'boom' });
  assert.equal(bookingErrorAction(null).kind, 'show');
});

test('format helpers', () => {
  assert.equal(toE164US('(512) 555-0123'), '+15125550123');
  assert.equal(toE164US('1 512 555 0123'), '+15125550123');
  assert.equal(toE164US('+15125550123'), '+15125550123');
  assert.equal(toE164US('555-0123'), null);
  assert.equal(toE164US('+44 20 7946 0958'), null);
  assert.equal(prettyPhone('+15125550123'), '(512) 555-0123');
  assert.equal(money(2000), '$20');
  assert.equal(money(2050), '$20.50');
  assert.equal(scheduledDateIso('2026-10-03', 'AFTERNOON', () => 300), '2026-10-03T14:00:00-05:00');
  assert.equal(scheduledDateIso('2026-10-03', 'MORNING', () => -330), '2026-10-03T08:00:00+05:30');
  assert.equal(scheduledDateIso('bad', 'MORNING'), null);
  const days = bookableDays(new Date(2026, 9, 2, 9));
  assert.equal(days.length, 7);
  assert.deepEqual(days[0], { iso: '2026-10-02', label: 'Today' });
  assert.equal(days[1].label, 'Tomorrow');
  assert.equal(windowOpenOn('2026-10-02', 'MORNING', new Date(2026, 9, 2, 9)), true);
  assert.equal(windowOpenOn('2026-10-02', 'MORNING', new Date(2026, 9, 2, 10, 30)), false, 'closes an hour before the window ends');
  assert.equal(windowOpenOn('2026-10-03', 'MORNING', new Date(2026, 9, 2, 23)), true);
  assert.match(randomId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('draft persistence drops the files and restores known keys only', () => {
  const d = readyDraft();
  d.photos = [{ name: 'a.jpg' }];
  const saved = persistableDraft(d);
  assert.equal(saved.photos, undefined);
  assert.equal(saved.photoCount, 1);
  const back = restoreDraft({ ...saved, evil: 'x' });
  assert.equal(back.evil, undefined);
  assert.equal(back.propertyId, 'p1');
  assert.deepEqual(back.photos, []);
  assert.deepEqual(restoreDraft(null), emptyDraft());
});

function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('session: one device id per browser, tokens survive a reload, clear forgets them', () => {
  const store = memStore();
  const s1 = createSession(store);
  const id = s1.deviceFields().deviceId;
  assert.deepEqual(s1.deviceFields(), { deviceId: id, deviceName: 'Web browser', deviceType: 'web', appVersion: 'web-1.0' });
  assert.equal(s1.signedIn, false);
  s1.setTokens({ accessToken: 'a', refreshToken: 'r', user: { id: 'u' } });
  const s2 = createSession(store);
  assert.equal(s2.accessToken, 'a');
  assert.equal(s2.deviceFields().deviceId, id);
  s2.clear();
  assert.equal(createSession(store).signedIn, false);
});

test('http: bearer on authed calls only, one refresh then retry on 401, ApiError carries the code', async () => {
  const store = memStore();
  const session = createSession(store);
  session.setTokens({ accessToken: 'old', refreshToken: 'r1' });
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization || null, body: init.body });
    const path = url.replace('https://api.test/api/v1', '');
    const json = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body });
    if (path === '/trades') return json(200, [{ id: 't' }]);
    if (path === '/auth/refresh') return json(200, { accessToken: 'new', refreshToken: 'r2' });
    if (path === '/jobs') return init.headers.Authorization === 'Bearer new' ? json(201, { id: 'j1' }) : json(401, { message: 'Unauthorized' });
    if (path === '/boom') return json(400, { code: 'PRICE_CHANGED', message: 'Price changed', amountCents: 4000 });
    throw new Error('unexpected ' + path);
  };
  const http = createHttp({ baseUrl: 'https://api.test/api/v1/', session, fetchImpl });

  await http.get('/trades', { auth: false });
  assert.equal(calls[0].auth, null, 'public routes send no token');

  const job = await http.post('/jobs', { a: 1 });
  assert.equal(job.id, 'j1');
  assert.deepEqual(calls.slice(1).map((c) => c.url.split('/api/v1')[1]), ['/jobs', '/auth/refresh', '/jobs']);
  assert.equal(calls[3].auth, 'Bearer new');
  assert.equal(session.refreshToken, 'r2');

  await assert.rejects(http.get('/boom'), (e) => e instanceof ApiError && e.code === 'PRICE_CHANGED' && e.status === 400 && e.body.amountCents === 4000 && e.message === 'Price changed');
});

test('http: a failed refresh signs the person out and the 401 surfaces', async () => {
  const session = createSession(memStore());
  session.setTokens({ accessToken: 'old', refreshToken: 'dead' });
  const fetchImpl = async (url) => {
    const ok = url.endsWith('/auth/refresh') ? false : false;
    return { ok, status: 401, text: async () => '{"message":"Unauthorized"}', json: async () => ({}) };
  };
  const http = createHttp({ baseUrl: 'https://api.test/api/v1', session, fetchImpl });
  await assert.rejects(http.get('/auth/me'), (e) => e.status === 401);
  assert.equal(session.signedIn, false);
});

test('http: a network failure is a readable error, not a crash', async () => {
  const http = createHttp({ baseUrl: 'https://api.test/api/v1', session: createSession(memStore()), fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(http.get('/trades', { auth: false }), (e) => e.status === 0 && /Can't reach NOHM/.test(e.message));
});
