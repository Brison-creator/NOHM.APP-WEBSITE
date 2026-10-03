// The sign-up form's rules, shared by /book (homeowners), /join (pros)
// and /join/renter (renters). The server's SendEmailSignupOtpDto: first
// and last name, email, an E.164 phone, an 8+ character password and
// the role.

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

/** Problems with the phone-first details form (name and email), keyed by field. */
export function detailsProblems(f) {
  const e = {};
  if (!(f.firstName || '').trim()) e.firstName = 'First name';
  if (!(f.lastName || '').trim()) e.lastName = 'Last name';
  if (!isEmail(f.email)) e.email = 'A real email address';
  return e;
}
