// node --test tools/book
// Phone sign-up on the web: the bodies match the server's
// SendPhoneSignupOtpDto { phone, role } and VerifyPhoneSignupOtpDto
// { phone, code, firstName, lastName, role, email?, deviceId,
// deviceName, deviceType, appVersion } exactly (forbidNonWhitelisted).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phoneSignupProblems, phoneSignupStart, phoneSignupBody } from '../../public/nohm/signup.js';
import { createApi } from '../../public/nohm/api.js';
import { createSession } from '../../public/nohm/session.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test('phone sign-up form: name and phone needed, email optional but checked', () => {
  assert.deepEqual(Object.keys(phoneSignupProblems({})).sort(), ['firstName', 'lastName', 'phone']);
  assert.deepEqual(phoneSignupProblems({ firstName: 'Ava', lastName: 'Ng', phone: '512 555 0123' }), {});
  assert.deepEqual(phoneSignupProblems({ firstName: 'Ava', lastName: 'Ng', phone: '512 555 0123', email: '' }), {});
  assert.equal(phoneSignupProblems({ firstName: 'Ava', lastName: 'Ng', phone: '512 555 0123', email: 'nope' }).email, 'A real email address, or leave it empty');
  assert.match(phoneSignupProblems({ firstName: 'x'.repeat(61), lastName: 'Ng', phone: '5125550123' }).firstName, /60/, 'the server’s 60-character cap');
  assert.equal(phoneSignupProblems({ firstName: 'Ava', lastName: 'Ng', phone: '555-0123' }).phone, 'A US mobile number');
});

test('phone sign-up bodies: exactly the server’s fields, no password, empty email left out', () => {
  const f = { firstName: ' Ava ', lastName: ' Ng ', phone: '(512) 555-0123', email: '  ' };
  assert.deepEqual(phoneSignupStart(f, 'TENANT'), { phone: '+15125550123', role: 'TENANT' });
  assert.deepEqual(phoneSignupBody(f, 'HOMEOWNER'), { phone: '+15125550123', firstName: 'Ava', lastName: 'Ng', role: 'HOMEOWNER' });
  assert.deepEqual(phoneSignupBody({ ...f, email: ' Ava@Example.com ' }, 'CONTRACTOR'), { phone: '+15125550123', firstName: 'Ava', lastName: 'Ng', role: 'CONTRACTOR', email: 'ava@example.com' });
});

test('phone sign-up endpoints: send-otp gets { phone, role }; verify-otp adds the code and the device fields', async () => {
  const posts = [];
  const http = { post: async (path, body, opts) => { posts.push({ path, body, opts }); return {}; } };
  const session = createSession(memStore(), { deviceName: 'Test browser' });
  const api = createApi(http, session);
  await api.auth.phoneSignupSendOtp({ phone: '+15125550123', role: 'HOMEOWNER', firstName: 'stray' });
  await api.auth.phoneSignupVerify({ phone: '+15125550123', firstName: 'Ava', lastName: 'Ng', role: 'HOMEOWNER' }, '123456');
  assert.equal(posts[0].path, '/auth/phone-signup/send-otp');
  assert.deepEqual(posts[0].body, { phone: '+15125550123', role: 'HOMEOWNER' }, 'only the two fields the DTO has');
  assert.equal(posts[0].opts.auth, false);
  assert.equal(posts[1].path, '/auth/phone-signup/verify-otp');
  assert.deepEqual(Object.keys(posts[1].body).sort(), ['appVersion', 'code', 'deviceId', 'deviceName', 'deviceType', 'firstName', 'lastName', 'phone', 'role']);
  assert.equal(posts[1].body.deviceType, 'web');
  assert.equal(posts[1].opts.auth, false);
});
