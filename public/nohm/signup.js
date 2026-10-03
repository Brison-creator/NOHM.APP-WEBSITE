// The sign-up forms' rules, shared by /book (homeowners), /join (pros)
// and /join/renter (renters).
//
// Email sign-up, the server's SendEmailSignupOtpDto: first and last
// name, email, an E.164 phone, an 8+ character password and the role.
// Phone sign-up (SendPhoneSignupOtpDto / VerifyPhoneSignupOtpDto in
// auth/dto/email-signup.dto.ts): the code goes to { phone, role }; the
// account is { phone, code, firstName, lastName (each up to 60), role,
// optional email, device fields }. No password.

import { toE164US, isEmail } from './format.js';

/** Problems with a sign-up form, keyed by field; {} when it's fine. */
export function signupProblems(f) {
  const e = {};
  if (!(f.firstName || '').trim()) e.firstName = 'First name';
  if (!(f.lastName || '').trim()) e.lastName = 'Last name';
  if (!isEmail(f.email)) e.email = 'A real email address';
  if (!toE164US(f.phone)) e.phone = 'A US mobile number';
  if ((f.password || '').length < 8) e.password = 'At least 8 characters';
  return e;
}

/** The send-otp body, normalized the way the server wants it. */
export function signupBody(f, role = 'HOMEOWNER') {
  return {
    firstName: f.firstName.trim(),
    lastName: f.lastName.trim(),
    email: f.email.trim().toLowerCase(),
    phone: toE164US(f.phone),
    password: f.password,
    role,
  };
}

const NAME_MAX = 60;

/** Problems with the phone sign-up form, keyed by field; {} when it's fine. */
export function phoneSignupProblems(f) {
  const e = {};
  const first = (f.firstName || '').trim();
  const last = (f.lastName || '').trim();
  if (!first) e.firstName = 'First name';
  else if (first.length > NAME_MAX) e.firstName = `Up to ${NAME_MAX} characters`;
  if (!last) e.lastName = 'Last name';
  else if (last.length > NAME_MAX) e.lastName = `Up to ${NAME_MAX} characters`;
  if (!toE164US(f.phone)) e.phone = 'A US mobile number';
  const email = (f.email || '').trim();
  if (email && !isEmail(email)) e.email = 'A real email address, or leave it empty';
  return e;
}

/** POST /auth/phone-signup/send-otp body. */
export function phoneSignupStart(f, role = 'HOMEOWNER') {
  return { phone: toE164US(f.phone), role };
}

/**
 * POST /auth/phone-signup/verify-otp body, less the code and device
 * fields (added when it's sent). An empty email is left out: the
 * server checks any email it's given.
 */
export function phoneSignupBody(f, role = 'HOMEOWNER') {
  const body = { phone: toE164US(f.phone), firstName: f.firstName.trim(), lastName: f.lastName.trim(), role };
  const email = (f.email || '').trim().toLowerCase();
  if (email) body.email = email;
  return body;
}
