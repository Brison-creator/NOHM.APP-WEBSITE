// node --test tools/book
// Which 401s refresh the session (SESSION_EXPIRED, or no code from an
// older server), which don't (a wrong text code must not be sent twice),
// and a paused / blocked / deleted account signing the browser out with
// the server's message.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHttp, ApiError, shouldRefresh, isAccountStop } from '../../public/nohm/http.js';
import { createSession } from '../../public/nohm/session.js';
import { bookingErrorAction } from '../../public/book/lib/flow.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const json = (status, body) => ({ ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)), json: async () => body });

/** A client whose server answers from `routes` (path → (init) → response); records every path hit. */
function rig(routes) {
  const session = createSession(memStore());
  session.setTokens({ accessToken: 'old', refreshToken: 'r1' });
  const hits = [];
  const stops = [];
  const fetchImpl = async (url, init) => {
    const path = url.split('/api/v1')[1];
    hits.push(path);
    const r = routes[path];
    if (!r) throw new Error('unexpected ' + path);
    return r(init);
  };
  const http = createHttp({ baseUrl: 'https://api.test/api/v1', session, fetchImpl, onAccountStop: (e) => stops.push(e) });
  return { http, session, hits, stops };
}

test('the rule: refresh only on SESSION_EXPIRED or a 401 without a code', () => {
  assert.equal(shouldRefresh(401, { code: 'SESSION_EXPIRED' }), true);
  assert.equal(shouldRefresh(401, { message: 'Unauthorized' }), true, 'an older server sends no code');
  assert.equal(shouldRefresh(401, null), true);
  assert.equal(shouldRefresh(401, { code: 'INVALID_CODE', message: 'Invalid code. 4 attempts remaining' }), false);
  assert.equal(shouldRefresh(401, { code: 'ACCOUNT_PAUSED' }), false);
  assert.equal(shouldRefresh(403, { code: 'SESSION_EXPIRED' }), false);
  assert.equal(isAccountStop({ code: 'ACCOUNT_BLOCKED' }), true);
  assert.equal(isAccountStop({ code: 'SESSION_EXPIRED' }), false);
  assert.equal(isAccountStop(null), false);
});

test('SESSION_EXPIRED: one refresh, then the call again with the new token', async () => {
  const { http, hits, session } = rig({
    '/auth/refresh': () => json(200, { accessToken: 'new', refreshToken: 'r2' }),
    '/jobs': (init) => (init.headers.Authorization === 'Bearer new' ? json(201, { id: 'j1' }) : json(401, { code: 'SESSION_EXPIRED', message: 'Session expired' })),
  });
  assert.equal((await http.post('/jobs', {})).id, 'j1');
  assert.deepEqual(hits, ['/jobs', '/auth/refresh', '/jobs']);
  assert.equal(session.accessToken, 'new');
});

test('a wrong code on a signed-in POST is sent once: no refresh, no second attempt', async () => {
  const { http, hits, session, stops } = rig({
    '/tenants/invite/482913/accept': () => json(401, { code: 'INVALID_CODE', message: 'Invalid code. 4 attempts remaining' }),
  });
  await assert.rejects(http.post('/tenants/invite/482913/accept', { otpCode: '000000' }), (e) => e instanceof ApiError && e.status === 401 && e.code === 'INVALID_CODE' && /4 attempts remaining/.test(e.message));
  assert.deepEqual(hits, ['/tenants/invite/482913/accept'], 'sent exactly once');
  assert.equal(session.signedIn, true, 'still signed in');
  assert.equal(stops.length, 0);
});

for (const code of ['ACCOUNT_PAUSED', 'ACCOUNT_BLOCKED', 'ACCOUNT_DELETED']) {
  test(`${code} on the 401 itself: signed out, the server's message handed to the page, no refresh`, async () => {
    const { http, hits, session, stops } = rig({ '/auth/me': () => json(401, { code, message: `Server says ${code}` }) });
    await assert.rejects(http.get('/auth/me'), (e) => e.accountStop === true && e.code === code && e.message === `Server says ${code}`);
    assert.deepEqual(hits, ['/auth/me']);
    assert.equal(session.signedIn, false);
    assert.equal(stops.length, 1);
    assert.equal(stops[0].message, `Server says ${code}`);
  });

  test(`${code} as a 403 from the refresh: signed out with the server's message, not silently`, async () => {
    const { http, hits, session, stops } = rig({
      '/auth/me': () => json(401, { code: 'SESSION_EXPIRED', message: 'Session expired' }),
      '/auth/refresh': () => json(403, { code, message: `Refresh says ${code}` }),
    });
    await assert.rejects(http.get('/auth/me'), (e) => e.accountStop === true && e.status === 403 && e.code === code && e.message === `Refresh says ${code}`);
    assert.deepEqual(hits, ['/auth/me', '/auth/refresh'], 'the call is not sent again');
    assert.equal(session.signedIn, false);
    assert.deepEqual(stops.map((e) => e.code), [code]);
  });
}

test('two calls expiring together share one refresh; a stopped account is reported once', async () => {
  const { http, hits, stops } = rig({
    '/a': () => json(401, { code: 'SESSION_EXPIRED' }),
    '/b': () => json(401, {}),
    '/auth/refresh': () => json(403, { code: 'ACCOUNT_PAUSED', message: 'Paused' }),
  });
  const results = await Promise.allSettled([http.get('/a'), http.get('/b')]);
  assert.ok(results.every((r) => r.status === 'rejected' && r.reason.code === 'ACCOUNT_PAUSED'));
  assert.equal(hits.filter((p) => p === '/auth/refresh').length, 1);
  assert.equal(stops.length, 1);
});

test('a public call never refreshes or signs anyone out', async () => {
  const { http, hits, session, stops } = rig({ '/auth/login/verify-otp': () => json(401, { code: 'ACCOUNT_BLOCKED', message: 'Blocked' }) });
  await assert.rejects(http.post('/auth/login/verify-otp', {}, { auth: false }), (e) => e.message === 'Blocked' && !e.accountStop);
  assert.deepEqual(hits, ['/auth/login/verify-otp']);
  assert.equal(session.signedIn, true);
  assert.equal(stops.length, 0);
});

test('a booking error from a stopped account does nothing more: the signed-out screen is already up', () => {
  const e = new ApiError(401, { code: 'ACCOUNT_BLOCKED', message: 'Blocked' });
  e.accountStop = true;
  assert.deepEqual(bookingErrorAction(e), { kind: 'stopped' });
  assert.deepEqual(bookingErrorAction(new ApiError(401, { code: 'SESSION_EXPIRED' })), { kind: 'sign_in' });
});
