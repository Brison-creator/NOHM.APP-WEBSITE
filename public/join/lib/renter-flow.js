// The renter rules. A renter joins NOHM by accepting the landlord's
// invite: a 6-digit code texted to the phone on the lease, then a
// one-time code to confirm it's them. The server links the lease and
// turns the tenant profile ACTIVE; the site only carries the codes.

export const RENTER_STEPS = ['account', 'invite', 'confirm', 'done'];

export function inviteCodeProblem(code) {
  return /^\d{6}$/.test((code || '').trim()) ? null : 'The 6-digit code from your landlord’s text.';
}

export function otpProblem(code) {
  return /^\d{4,8}$/.test((code || '').trim()) ? null : 'The code we just texted you.';
}

/** Where a signed-in renter is: linked already, or still needs the invite. */
export function renterStepFor(myProperty) {
  return myProperty && myProperty.hasProperty ? 'done' : 'invite';
}

/** "$1,250 on the 1st" from an invite row. */
export function inviteLine(inv) {
  const rent = Number(inv.rentAmount);
  const money = Number.isFinite(rent) ? `$${rent.toLocaleString('en-US')}` : '';
  const day = inv.leaseDueDay ? ordinal(inv.leaseDueDay) : '';
  return [money && day ? `${money} on the ${day}` : money, inv.leaseStartDate ? `from ${localDate(inv.leaseStartDate)}` : ''].filter(Boolean).join(' · ');
}

/** A lease date is a calendar day; read it as one, whatever the zone. */
function localDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
