// node --test tools/book
// A NOHM Reddit post's code (/book?ref=rd…): kept for the tab, sent with
// the sign-up's last step (email or phone verify-otp) only when the
// server says it takes one (GET /config/web signupRef: true), and never
// with the first step (the server's send-otp bodies don't have it).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rememberSignupRef, signupRef } from '../../public/nohm/ref.js';
import { createApi } from '../../public/nohm/api.js';
import { createSession } from '../../public/nohm/session.js';
import { normalizeWebConfig } from '../../public/nohm/web-config.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test('only a post’s code is kept, lowercased; anything else is ignored', () => {
  const s = memStore();
  rememberSignupRef('?trade=plumbing', s);
  assert.equal(signupRef(s), null);
  rememberSignupRef('?ref=<script>', s);
  assert.equal(signupRef(s), null);
  rememberSignupRef('?ref=RDABC234', s);
  assert.equal(signupRef(s), 'rdabc234');
  rememberSignupRef('?ref=rd0000001', s); // a bad one never replaces a good one
  assert.equal(signupRef(s), 'rdabc234');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  rememberSignupRef('?ref=rdabc234', broken);
  assert.equal(signupRef(broken), null);
});

test('the server says whether it takes one: only an explicit true', () => {
  assert.equal(normalizeWebConfig({ signupRef: true }).signupRef, true);
  assert.equal(normalizeWebConfig({ signupRef: 'true' }).signupRef, false);
  assert.equal(normalizeWebConfig({}).signupRef, false);
  assert.equal(normalizeWebConfig(null).signupRef, false);
});

test('verify-otp carries the code; send-otp never does; no code, nothing added', async () => {
  const posts = [];
  const http = { post: async (path, body) => { posts.push({ path, body }); return {}; } };
  const session = createSession(memStore(), { deviceName: 'Test browser' });
  const withRef = createApi(http, session, { signupRef: async () => 'rdabc234' });
  await withRef.auth.phoneSignupSendOtp({ phone: '+15125550123', role: 'HOMEOWNER' });
  await withRef.auth.phoneSignupVerify({ phone: '+15125550123', firstName: 'Ava', lastName: 'Ng', role: 'HOMEOWNER' }, '123456');
  await withRef.auth.emailSignupSendOtp({ email: 'a@b.co', phone: '+15125550123', firstName: 'Ava', lastName: 'Ng', role: 'HOMEOWNER' });
  await withRef.auth.emailSignupVerify({ email: 'a@b.co', phone: '+15125550123', firstName: 'Ava', lastName: 'Ng', role: 'HOMEOWNER' }, '123456');
  assert.equal(posts[0].body.ref, undefined);
  assert.equal(posts[1].body.ref, 'rdabc234');
  assert.equal(posts[2].body.ref, undefined);
  assert.equal(posts[3].body.ref, 'rdabc234');

  const none = createApi(http, session, { signupRef: async () => null });
  await none.auth.phoneSignupVerify({ phone: '+15125550123', firstName: 'Ava', lastName: 'Ng', role: 'HOMEOWNER' }, '123456');
  assert.equal('ref' in posts[4].body, false);
  const failing = createApi(http, session, { signupRef: async () => { throw new Error('config down'); } });
  await failing.auth.phoneSignupVerify({ phone: '+15125550123', firstName: 'Ava', lastName: 'Ng', role: 'HOMEOWNER' }, '123456');
  assert.equal('ref' in posts[5].body, false, 'a failure never stops the sign-up');
});
