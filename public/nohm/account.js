// The account step shared by /book, /join and /join/renter: sign up
// with a phone (name + phone → text code, email optional, no password)
// or with email (email, phone, password → text code), sign in (password, with the
// new-browser code; or a phone code), optional Google. The host app
// passes `a` with: api, config, webConfig(), state, run(), account.signedIn(res),
// account.google(idToken), canGoBack(), back(), and `role` + `copy`.

import { h, append, field, button, clear } from './dom.js';
import { signupProblems, signupBody, phoneSignupProblems, phoneSignupStart, phoneSignupBody } from './signup.js';
import { prettyPhone, toE164US } from './format.js';
import { mountGoogleButton } from './google.js';
import { GOOGLE_UNAVAILABLE } from './web-config.js';

/**
 * Under every phone field where a number is given for texts: the same
 * words as the app's sign-up (legal_links.dart SmsConsentNote) and
 * nohm.app/sms, which carriers check before NOHM's number may text.
 */
export const SMS_CONSENT =
  'By entering your number, you agree to get account texts from NOHM, like login codes and job updates. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.';

function head(title, sub) {
  return h('header.b-head', [h('h1.b-h1', title), sub ? h('p.b-sub', sub) : null]);
}

function footer(a) {
  return h('div.b-foot', [a.canGoBack() ? button('Back', { kind: 'sec', onClick: () => a.back() }) : null]);
}

/**
 * @param a the host app
 * @param opts { role: 'HOMEOWNER'|'CONTRACTOR'|'TENANT', signupTitle, signupSub, signinSub }
 */
export function accountScreen(a, opts = {}) {
  const role = opts.role || 'HOMEOWNER';
  const wrap = h('section.b-screen');
  let mode = a.state.accountMode || 'signup';
  const err = h('p.b-err', { role: 'alert' });

  function tabs() {
    const newOn = mode === 'signup' || mode === 'signup-phone';
    return h('div.b-tabs', { role: 'tablist' }, [
      h('button.b-tab', { type: 'button', role: 'tab', 'aria-selected': newOn ? 'true' : 'false', class: newOn ? 'on' : '', onClick: () => { mode = 'signup'; draw(); } }, 'New to NOHM'),
      h('button.b-tab', { type: 'button', role: 'tab', 'aria-selected': mode === 'signin' ? 'true' : 'false', class: mode === 'signin' ? 'on' : '', onClick: () => { mode = 'signin'; draw(); } }, 'Sign in'),
    ]);
  }

  // The client id is the server's (GET /config/web). Without it, or if
  // Google's script won't load, the row says so instead of a button.
  function googleRow() {
    const host = h('div.b-google');
    const row = h('div.b-googlerow', [host, h('p.b-or', 'or')]);
    const off = () => { clear(row); row.append(h('p.b-small.b-google-off', GOOGLE_UNAVAILABLE)); };
    a.webConfig()
      .then((cfg) => {
        if (!cfg.googleClientId) return off();
        return mountGoogleButton({ host, clientId: cfg.googleClientId, onToken: (idToken) => a.run(() => a.account.google(idToken), err) });
      })
      .catch(off);
    return row;
  }

  function signupForm() {
    const f = {
      firstName: field({ label: 'First name', name: 'firstName', autocomplete: 'given-name' }),
      lastName: field({ label: 'Last name', name: 'lastName', autocomplete: 'family-name' }),
      email: field({ label: 'Email', name: 'email', type: 'email', autocomplete: 'email', inputmode: 'email' }),
      phone: field({ label: 'Mobile number', name: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', hint: SMS_CONSENT }),
      password: field({ label: 'Password', name: 'password', type: 'password', autocomplete: 'new-password', hint: 'At least 8 characters.' }),
    };
    const btn = button('Text me a code', { key: 'signup', submit: true });
    const submit = async (e) => {
      e && e.preventDefault();
      const values = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.value]));
      const problems = signupProblems(values);
      Object.entries(f).forEach(([k, v]) => v.setError(problems[k]));
      if (Object.keys(problems).length) return;
      const body = signupBody(values, role);
      btn.busy(true, 'Sending…');
      try {
        const exists = await a.api.auth.checkExists(body.email);
        if (exists && exists.exists) { f.email.setError('That email already has a NOHM account. Sign in instead.'); return; }
        await a.api.auth.emailSignupSendOtp(body);
        a.state.pendingSignup = body;
        mode = 'signup-code';
        draw();
      } catch (ex) {
        err.textContent = ex.status === 409 ? 'That email or phone already has a NOHM account. Sign in instead.' : ex.message;
      } finally {
        btn.busy(false);
      }
    };
    return h('form.b-form', { onSubmit: submit, novalidate: true }, [h('div.b-two', [f.firstName.el, f.lastName.el]), f.email.el, f.phone.el, f.password.el, btn, h('p.b-small', ['By continuing you agree to NOHM’s ', h('a', { href: '/terms' }, 'Terms'), ' and ', h('a', { href: '/privacy' }, 'Privacy Policy'), '. How NOHM texts: ', h('a', { href: '/sms' }, 'nohm.app/sms'), '.'])]);
  }

  // Phone sign-up: name and phone (email optional), a code, the account.
  function phoneSignupForm() {
    const f = {
      firstName: field({ label: 'First name', name: 'firstName', autocomplete: 'given-name', maxlength: 60 }),
      lastName: field({ label: 'Last name', name: 'lastName', autocomplete: 'family-name', maxlength: 60 }),
      phone: field({ label: 'Mobile number', name: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', hint: SMS_CONSENT }),
      email: field({ label: 'Email (optional)', name: 'email', type: 'email', autocomplete: 'email', inputmode: 'email', hint: 'You can add it later in the app.' }),
    };
    const btn = button('Text me a code', { key: 'phone-signup-send', submit: true });
    const submit = async (e) => {
      e && e.preventDefault();
      const values = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.value]));
      const problems = phoneSignupProblems(values);
      Object.entries(f).forEach(([k, v]) => v.setError(problems[k]));
      if (Object.keys(problems).length) return;
      const body = phoneSignupBody(values, role);
      btn.busy(true, 'Sending…');
      try {
        // An email the server would refuse after the code is used up: ask first.
        if (body.email) {
          const exists = await a.api.auth.checkExists(body.email);
          if (exists && exists.exists) { f.email.setError('That email already has a NOHM account. Sign in instead, or leave it empty.'); return; }
        }
        await a.api.auth.phoneSignupSendOtp(phoneSignupStart(values, role));
        a.state.pendingPhoneSignup = body;
        mode = 'signup-phone-code';
        draw();
      } catch (ex) {
        err.textContent = ex.message;
      } finally {
        btn.busy(false);
      }
    };
    return h('form.b-form', { onSubmit: submit, novalidate: true }, [h('div.b-two', [f.firstName.el, f.lastName.el]), f.phone.el, f.email.el, btn, h('button.b-link', { type: 'button', onClick: () => { mode = 'signup'; draw(); } }, 'Use email and a password instead'), h('p.b-small', ['By continuing you agree to NOHM’s ', h('a', { href: '/terms' }, 'Terms'), ' and ', h('a', { href: '/privacy' }, 'Privacy Policy'), '. How NOHM texts: ', h('a', { href: '/sms' }, 'nohm.app/sms'), '.'])]);
  }

  function phoneSignupButton() {
    return h('div', [button('Sign up with your phone', { kind: 'sec', key: 'phone-signup', onClick: () => { mode = 'signup-phone'; draw(); } }), h('p.b-or', 'or with email')]);
  }

  function codeForm({ phone, onCode, onResend, back = 'signup' }) {
    const code = field({ label: `Code we texted ${prettyPhone(phone)}`, name: 'code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6 });
    const btn = button('Verify', { key: 'verify', submit: true });
    const submit = async (e) => {
      e && e.preventDefault();
      if (!/^\d{4,6}$/.test(code.value.trim())) return code.setError('The code from the text.');
      btn.busy(true, 'Checking…');
      try { await onCode(code.value.trim()); } catch (ex) { code.setError(ex.message); } finally { btn.busy(false); }
    };
    setTimeout(() => code.input.focus(), 0);
    return h('form.b-form', { onSubmit: submit, novalidate: true }, [code.el, btn, onResend ? h('button.b-link', { type: 'button', onClick: () => a.run(onResend, err, 'Sent another code.') }, 'Send a new code') : null, h('button.b-link', { type: 'button', onClick: () => { mode = back; draw(); } }, 'Change my details')]);
  }

  function signinForm() {
    const email = field({ label: 'Email', name: 'email', type: 'email', autocomplete: 'email', inputmode: 'email' });
    const pw = field({ label: 'Password', name: 'password', type: 'password', autocomplete: 'current-password' });
    const btn = button('Sign in', { key: 'signin', submit: true });
    const submit = async (e) => {
      e && e.preventDefault();
      if (!email.value.trim()) return email.setError('Your email');
      if (!pw.value) return pw.setError('Your password');
      btn.busy(true, 'Signing in…');
      try {
        const address = email.value.trim().toLowerCase();
        const res = await a.api.auth.loginEmailPassword(address, pw.value);
        if (res.status === 'otp_required') {
          a.state.pendingLogin = { email: email.value.trim().toLowerCase(), maskedPhone: res.maskedPhone };
          mode = 'signin-code';
          draw();
          return;
        }
        await a.account.signedIn(res);
      } catch (ex) {
        err.textContent = ex.status === 401 || ex.status === 400 ? 'That email and password don’t match.' : ex.message;
      } finally {
        btn.busy(false);
      }
    };
    const phoneBtn = h('button.b-link', { type: 'button', onClick: () => { mode = 'signin-phone'; draw(); } }, 'Sign in with a text code instead');
    return h('form.b-form', { onSubmit: submit, novalidate: true }, [email.el, pw.el, btn, phoneBtn]);
  }

  function phoneSigninForm() {
    const phone = field({ label: 'Mobile number', name: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', hint: SMS_CONSENT });
    const btn = button('Text me a code', { key: 'phone', submit: true });
    const submit = async (e) => {
      e && e.preventDefault();
      const e164 = toE164US(phone.value);
      if (!e164) return phone.setError('A US mobile number');
      btn.busy(true, 'Sending…');
      try {
        await a.api.auth.loginSendOtp(e164);
        a.state.pendingLogin = { phone: e164 };
        mode = 'signin-phone-code';
        draw();
      } catch (ex) { err.textContent = ex.message; } finally { btn.busy(false); }
    };
    return h('form.b-form', { onSubmit: submit, novalidate: true }, [phone.el, btn, h('button.b-link', { type: 'button', onClick: () => { mode = 'signin'; draw(); } }, 'Use my password instead')]);
  }

  function draw() {
    clear(wrap);
    err.textContent = '';
    a.state.accountMode = mode;
    const title = mode.startsWith('signin') ? 'Welcome back' : opts.signupTitle || 'Create your NOHM account';
    const sub = mode.startsWith('signin') ? opts.signinSub || '' : opts.signupSub || 'Takes a minute.';
    const body = [];
    if (mode === 'signup') body.push(googleRow(), phoneSignupButton(), signupForm());
    else if (mode === 'signup-phone') body.push(phoneSignupForm());
    else if (mode === 'signup-phone-code') body.push(codeForm({ phone: a.state.pendingPhoneSignup.phone, back: 'signup-phone', onCode: async (code) => a.account.signedIn(await a.api.auth.phoneSignupVerify(a.state.pendingPhoneSignup, code)), onResend: () => a.api.auth.phoneSignupSendOtp(phoneSignupStart(a.state.pendingPhoneSignup, role)) }));
    else if (mode === 'signup-code') body.push(codeForm({ phone: a.state.pendingSignup.phone, onCode: async (code) => a.account.signedIn(await a.api.auth.emailSignupVerify(a.state.pendingSignup, code)), onResend: () => a.api.auth.emailSignupSendOtp(a.state.pendingSignup) }));
    else if (mode === 'google-phone') {
      const phone = field({ label: 'Mobile number', name: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', hint: SMS_CONSENT });
      const btn = button('Text me a code', { key: 'gphone' });
      btn.addEventListener('click', () => {
        const e164 = toE164US(phone.value);
        if (!e164) return phone.setError('A US mobile number');
        a.run(async () => { await a.api.auth.socialSignupSendOtp(e164); a.state.pendingGoogle.phone = e164; mode = 'google-code'; draw(); }, err);
      });
      body.push(h('form.b-form', { onSubmit: (e) => e.preventDefault() }, [h('p.b-line', `Hi ${a.state.pendingGoogle.firstName || ''}, Google checked out.`), phone.el, btn]));
    } else if (mode === 'google-code') body.push(codeForm({ phone: a.state.pendingGoogle.phone, onCode: async (code) => a.account.signedIn(await a.api.auth.googleSignupWithPhone(a.state.pendingGoogle.idToken, a.state.pendingGoogle.phone, code, role)), onResend: () => a.api.auth.socialSignupSendOtp(a.state.pendingGoogle.phone) }));
    else if (mode === 'signin') body.push(googleRow(), signinForm());
    else if (mode === 'signin-code') body.push(h('p.b-line', `New browser. We texted a code to ${a.state.pendingLogin.maskedPhone || 'your phone'}.`), codeForm({ phone: a.state.pendingLogin.maskedPhone || '', onCode: async (code) => a.account.signedIn(await a.api.auth.loginVerifyDeviceOtp(a.state.pendingLogin.email, code)) }));
    else if (mode === 'signin-phone') body.push(phoneSigninForm());
    else if (mode === 'signin-phone-code') body.push(codeForm({ phone: a.state.pendingLogin.phone, onCode: async (code) => a.account.signedIn(await a.api.auth.loginVerifyOtp(a.state.pendingLogin.phone, code)), onResend: () => a.api.auth.loginSendOtp(a.state.pendingLogin.phone) }));
    append(wrap, [head(title, sub), mode === 'signup' || mode === 'signup-phone' || mode === 'signin' ? tabs() : null, ...body, err, footer(a)]);
  }
  draw();
  return wrap;
}

