// The pro (contractor) onboarding rules: which step the server's
// dashboard says comes next, what the profile form needs, and the
// exact PATCH /contractors/profile body. Pure, tested in Node.
//
// The server owns the application: DRAFT → PENDING_DOC_REVIEW →
// (ACTION_REQUIRED | PENDING_BG_CHECK) → APPROVED | REJECTED. A pro
// receives jobs only when the server sets dispatchEligible. The site
// just walks the four things the server needs before review (profile +
// trades, payouts through Stripe, the agreement, submit) and collects
// the documents the review will ask for.

export const PRO_STEPS = ['account', 'profile', 'documents', 'payouts', 'agreement', 'review', 'status'];

export const RADII = [10, 20, 30];

export const DOC_TYPES = {
  HEADSHOT: { label: 'Your headshot', line: 'A clear photo of your face. Homeowners see it when you take their job.', required: true },
  DRIVERS_LICENSE: { label: "Driver's license", line: 'Front of the card. Reviewed, never shown to homeowners.', required: true },
  TRADE_LICENSE: { label: 'Trade license', line: 'Your state license for the trade you picked.', required: false },
  INSURANCE_PROOF: { label: 'Proof of insurance', line: 'Certificate of liability insurance.', required: false },
};

/**
 * Document types to ask for. Whether a trade license is needed is the
 * server's answer (GET /contractors/dashboard tradeLicenseRequired).
 */
export function docTypesFor(tradeLicenseRequired) {
  const out = ['HEADSHOT', 'DRIVERS_LICENSE'];
  if (tradeLicenseRequired) out.push('TRADE_LICENSE');
  out.push('INSURANCE_PROOF');
  return out;
}

/** Where the person is, from GET /contractors/dashboard. Null when there's no dashboard yet. */
export function proStepFor(dash) {
  if (!dash) return 'profile';
  const st = dash.applicationStatus;
  if (st && st !== 'DRAFT' && st !== 'ACTION_REQUIRED') return 'status';
  const c = dash.checklist || {};
  if (!c.publicProfile || !c.tradesSelected) return 'profile';
  if (!c.stripeConnect) return 'payouts';
  if (!c.attestation) return 'agreement';
  return 'review';
}

/**
 * The server's checklist items not done yet, each with the step that
 * does it. Shown as a to-do list; whether the application can be
 * submitted is the server's answer to POST /contractors/submit-review.
 */
export function submitBlockers(checklist) {
  const c = checklist || {};
  const out = [];
  if (!c.publicProfile) out.push({ step: 'profile', label: 'Your profile' });
  if (!c.tradesSelected) out.push({ step: 'profile', label: 'Your trade' });
  if (!c.stripeConnect) out.push({ step: 'payouts', label: 'Payouts (Stripe)' });
  if (!c.attestation) out.push({ step: 'agreement', label: 'The NOHM Standard agreement' });
  return out;
}

/** Documents still missing for dispatch (headshot and license) or asked for (trade license, insurance). */
export function docsMissing(checklist, tradeLicenseRequired) {
  const c = checklist || {};
  const have = { HEADSHOT: c.headshot, DRIVERS_LICENSE: c.driversLicense, TRADE_LICENSE: c.tradeLicense, INSURANCE_PROOF: c.insurance };
  return docTypesFor(tradeLicenseRequired).filter((t) => !have[t]);
}

/** Problems with the profile form, keyed by field; {} when it's fine. */
export function profileProblems(f) {
  const e = {};
  if (!(f.firstName || '').trim()) e.firstName = 'First name';
  if (!(f.lastName || '').trim()) e.lastName = 'Last name';
  const biz = (f.businessName || '').trim();
  if (biz.length < 2 || biz.length > 40) e.businessName = '2 to 40 characters';
  if (!/^\d{5}$/.test((f.baseZip || '').trim())) e.baseZip = 'A 5-digit ZIP';
  if (!RADII.includes(Number(f.serviceRadius))) e.serviceRadius = 'Pick 10, 20 or 30 miles';
  if (!f.primaryTradeId) e.primaryTradeId = 'Pick your main trade';
  if (f.secondaryTradeId && f.secondaryTradeId === f.primaryTradeId) e.secondaryTradeId = 'A different trade, or none';
  if ((f.bio || '').length > 500) e.bio = 'Up to 500 characters';
  if ((f.licenseNumber || '').length > 50) e.licenseNumber = 'Up to 50 characters';
  if (f.yearsExperience !== '' && f.yearsExperience !== undefined && f.yearsExperience !== null) {
    const y = Number(f.yearsExperience);
    if (!Number.isInteger(y) || y < 0 || y > 70) e.yearsExperience = '0 to 70';
  }
  for (const k of ['serviceCallFeeRange', 'hourlyRateRange']) {
    if ((f[k] || '').length > 20) e[k] = 'Up to 20 characters';
  }
  return e;
}

/** PATCH /contractors/profile body: required fields always, optional ones only when filled. */
export function profileBody(f) {
  const body = {
    firstName: f.firstName.trim(),
    lastName: f.lastName.trim(),
    businessName: f.businessName.trim(),
    baseZip: f.baseZip.trim(),
    serviceRadius: Number(f.serviceRadius),
    primaryTradeId: f.primaryTradeId,
  };
  if (f.secondaryTradeId) body.secondaryTradeId = f.secondaryTradeId;
  const bio = (f.bio || '').trim();
  if (bio) body.bio = bio;
  const lic = (f.licenseNumber || '').trim();
  if (lic) body.licenseNumber = lic;
  if (f.yearsExperience !== '' && f.yearsExperience !== undefined && f.yearsExperience !== null) body.yearsExperience = Number(f.yearsExperience);
  for (const k of ['serviceCallFeeRange', 'hourlyRateRange']) {
    const v = (f[k] || '').trim();
    if (v) body[k] = v;
  }
  return body;
}

/** The form, pre-filled from a dashboard (a returning pro). */
export function profileFormFrom(dash, user) {
  const p = (dash && dash.profile) || {};
  const u = (dash && dash.user) || user || {};
  const trades = (dash && dash.trades) || [];
  return {
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    businessName: p.businessName && p.businessName !== 'Not Provided' ? p.businessName : '',
    baseZip: p.baseZip || '',
    serviceRadius: p.serviceRadius || 20,
    primaryTradeId: trades[0] ? trades[0].id : '',
    secondaryTradeId: trades[1] ? trades[1].id : '',
    bio: p.bio || '',
    licenseNumber: p.licenseNumber || '',
    yearsExperience: p.yearsExperience ?? '',
    serviceCallFeeRange: p.serviceCallFeeRange || '',
    hourlyRateRange: p.hourlyRateRange || '',
  };
}

/** Plain words for an application status. */
export function statusCopy(dash) {
  const st = dash && dash.applicationStatus;
  if (dash && dash.dispatchEligible) return { title: "You're live on NOHM.", line: 'Go on shift in the app to start getting jobs.' };
  switch (st) {
    case 'PENDING_DOC_REVIEW':
      return { title: 'Under review.', line: 'NOHM is checking your profile and documents. The app and this page show the result.' };
    case 'PENDING_BG_CHECK':
      return { title: 'Almost there.', line: 'Your identity check is in progress. The app shows it the moment it clears.' };
    case 'ACTION_REQUIRED':
      return { title: 'One more thing.', line: 'The review needs something from you. The items below say what.' };
    case 'APPROVED':
      return { title: 'Approved.', line: 'Upload your headshot and driver’s license below if you haven’t; once they’re checked you can take jobs.' };
    case 'REJECTED':
      return { title: 'Not this time.', line: 'Your application wasn’t approved. Email support@nohm.app if you think that’s a mistake.' };
    default:
      return { title: 'Finish setting up.', line: 'A few steps left before review.' };
  }
}

/** Attestation name: the person types their full name to sign (the server's 2 to 100 characters). */
export function attestationProblem(name) {
  const n = (name || '').trim();
  if (n.length < 2) return 'Type your full name to sign.';
  if (n.length > 100) return 'Up to 100 characters.';
  return null;
}
