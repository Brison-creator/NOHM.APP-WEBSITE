// node --test tools/join
// The pro and renter onboarding rules without a browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proStepFor, submitBlockers, docsMissing, docTypesFor, profileProblems, profileBody, profileFormFrom, statusCopy, attestationProblem } from '../../public/join/lib/pro-flow.js';
import { inviteCodeProblem, otpProblem, renterStepFor, inviteLine } from '../../public/join/lib/renter-flow.js';

const PLUMB = { id: 't-plumb', name: 'PLUMBING', label: 'Plumbing', licenseRequired: true };
const HANDY = { id: 't-appl', name: 'APPLIANCE', label: 'Appliance', licenseRequired: false };

test('the dashboard decides the step: profile → payouts → agreement → review → status', () => {
  assert.equal(proStepFor(null), 'profile');
  const c = { publicProfile: false, tradesSelected: false, stripeConnect: false, attestation: false };
  const dash = (patch, status = 'DRAFT') => ({ applicationStatus: status, checklist: { ...c, ...patch } });
  assert.equal(proStepFor(dash({})), 'profile');
  assert.equal(proStepFor(dash({ publicProfile: true })), 'profile', 'trades are part of the profile');
  assert.equal(proStepFor(dash({ publicProfile: true, tradesSelected: true })), 'payouts');
  assert.equal(proStepFor(dash({ publicProfile: true, tradesSelected: true, stripeConnect: true })), 'agreement');
  assert.equal(proStepFor(dash({ publicProfile: true, tradesSelected: true, stripeConnect: true, attestation: true })), 'review');
  assert.equal(proStepFor(dash({}, 'PENDING_DOC_REVIEW')), 'status');
  assert.equal(proStepFor(dash({}, 'APPROVED')), 'status');
  assert.equal(proStepFor(dash({ publicProfile: true, tradesSelected: true }, 'ACTION_REQUIRED')), 'payouts', 'action required reopens the steps');
});

test('submit blockers are the four things the server checks, nothing else', () => {
  assert.deepEqual(submitBlockers({}).map((b) => b.step), ['profile', 'profile', 'payouts', 'agreement']);
  assert.deepEqual(submitBlockers({ publicProfile: true, tradesSelected: true, stripeConnect: true, attestation: true, headshot: false }), []);
});

test('documents: headshot and license always; trade license only when the trade needs one', () => {
  assert.deepEqual(docTypesFor(PLUMB), ['HEADSHOT', 'DRIVERS_LICENSE', 'TRADE_LICENSE', 'INSURANCE_PROOF']);
  assert.deepEqual(docTypesFor(HANDY), ['HEADSHOT', 'DRIVERS_LICENSE', 'INSURANCE_PROOF']);
  assert.deepEqual(docsMissing({ headshot: true, driversLicense: false, tradeLicense: null, insurance: false }, PLUMB), ['DRIVERS_LICENSE', 'TRADE_LICENSE', 'INSURANCE_PROOF']);
  assert.deepEqual(docsMissing({ headshot: true, driversLicense: true, insurance: true }, HANDY), []);
});

test('profile form: the server’s rules, named per field', () => {
  const p = profileProblems({});
  assert.deepEqual(Object.keys(p).sort(), ['baseZip', 'businessName', 'firstName', 'lastName', 'primaryTradeId', 'serviceRadius']);
  assert.equal(profileProblems({ firstName: 'Ray', lastName: 'Diaz', businessName: 'n/a', baseZip: '72011', serviceRadius: 20, primaryTradeId: 't' }).businessName, 'Your real business name');
  assert.equal(profileProblems({ firstName: 'Ray', lastName: 'Diaz', businessName: 'Diaz Plumbing', baseZip: '7201', serviceRadius: 20, primaryTradeId: 't' }).baseZip, 'A 5-digit ZIP');
  assert.equal(profileProblems({ firstName: 'Ray', lastName: 'Diaz', businessName: 'Diaz Plumbing', baseZip: '72011', serviceRadius: 25, primaryTradeId: 't' }).serviceRadius, 'Pick 10, 20 or 30 miles');
  assert.ok(profileProblems({ firstName: 'Ray', lastName: 'Diaz', businessName: 'Diaz Plumbing', baseZip: '72011', serviceRadius: 20, primaryTradeId: 't', secondaryTradeId: 't' }).secondaryTradeId);
  assert.ok(profileProblems({ firstName: 'Ray', lastName: 'Diaz', businessName: 'Diaz Plumbing', baseZip: '72011', serviceRadius: 20, primaryTradeId: 't', yearsExperience: '99' }).yearsExperience);
  const good = { firstName: ' Ray ', lastName: 'Diaz', businessName: ' Diaz Plumbing ', baseZip: '72011', serviceRadius: '20', primaryTradeId: 't-plumb', secondaryTradeId: '', bio: '', licenseNumber: 'M-1234', yearsExperience: '11', serviceCallFeeRange: '$95', hourlyRateRange: '' };
  assert.deepEqual(profileProblems(good), {});
  assert.deepEqual(profileBody(good), { firstName: 'Ray', lastName: 'Diaz', businessName: 'Diaz Plumbing', baseZip: '72011', serviceRadius: 20, primaryTradeId: 't-plumb', licenseNumber: 'M-1234', yearsExperience: 11, serviceCallFeeRange: '$95' });
});

test('a returning pro’s form comes from the dashboard; "Not Provided" reads as empty', () => {
  const f = profileFormFrom({ user: { firstName: 'Ray', lastName: 'Diaz' }, profile: { businessName: 'Not Provided', baseZip: '72011', serviceRadius: 30, yearsExperience: 0 }, trades: [PLUMB] });
  assert.equal(f.businessName, '');
  assert.equal(f.serviceRadius, 30);
  assert.equal(f.primaryTradeId, 't-plumb');
  assert.equal(f.yearsExperience, 0);
  assert.equal(profileFormFrom(null, { firstName: 'A', lastName: 'B' }).firstName, 'A');
});

test('status copy and the signature', () => {
  assert.match(statusCopy({ applicationStatus: 'PENDING_DOC_REVIEW' }).title, /Under review/);
  assert.match(statusCopy({ applicationStatus: 'APPROVED', dispatchEligible: true }).title, /live/);
  assert.match(statusCopy({ applicationStatus: 'REJECTED' }).title, /Not this time/);
  const u = { firstName: 'Ray', lastName: 'Diaz' };
  assert.equal(attestationProblem('ray diaz', u), null);
  assert.match(attestationProblem('R', u), /full name/);
  assert.match(attestationProblem('Someone Else', u), /Sign as Ray Diaz/);
});

test('renter codes and steps', () => {
  assert.equal(inviteCodeProblem('482913'), null);
  assert.ok(inviteCodeProblem('4829'));
  assert.equal(otpProblem('123456'), null);
  assert.ok(otpProblem('abc'));
  assert.equal(renterStepFor({ hasProperty: true }), 'done');
  assert.equal(renterStepFor({ hasProperty: false }), 'invite');
  assert.equal(inviteLine({ rentAmount: 1250, leaseDueDay: 1, leaseStartDate: '2026-11-01T00:00:00.000Z' }), '$1,250 on the 1st · from Nov 1, 2026');
  assert.equal(inviteLine({ rentAmount: 900, leaseDueDay: 3 }), '$900 on the 3rd');
});
