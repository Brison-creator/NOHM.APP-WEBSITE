// NOHM fees shown on the website. The app has its own admin setting for the
// launch threshold; the site can't see the user count, so flip `launch` to
// false here when NOHM reaches its launch target and every page updates.
var NOHM_PRICING = {
  launch: true,            // 50% off until 1,000 activated homeowners
  launchTarget: 1000,
  express: { launch: 20, regular: 40 },
  now: { launch: 30, regular: 60 },
  // Rentals (set in the NOHM admin; keep these in step with it). Free for
  // landlords (owner, 2026-10-29: "It's absolutely free to the landlord.
  // No spam no ads nothing."): every rental gets everything, Autopilot and
  // the NOHM Income Check too, with no plan, card or monthly fee. NOHM is
  // paid by the tenant's bank payment fee (achFee, each bank rent payment:
  // about $5 is the processor's cost, NOHM keeps about $2) and by the
  // application. A walkthrough is work the landlord books and pays for.
  rentals: {
    free: 0,
    achFee: 7,
    walkthrough: 79,
    // Owner, 2026-10-09: one background check, paid by the applicant
    // where the law allows.
    application: 50
  }
};

(function (p) {
  document.querySelectorAll('[data-fee]').forEach(function (el) {
    var fee = p[el.getAttribute('data-fee')];
    el.textContent = '$' + (p.launch ? fee.launch : fee.regular);
  });
  document.querySelectorAll('[data-fee-regular]').forEach(function (el) {
    var fee = p[el.getAttribute('data-fee-regular')];
    el.textContent = '$' + fee.regular;
    el.hidden = !p.launch;
  });
  document.querySelectorAll('[data-rental]').forEach(function (el) {
    el.textContent = '$' + p.rentals[el.getAttribute('data-rental')];
  });
  document.querySelectorAll('[data-launch-only]').forEach(function (el) { el.hidden = !p.launch; });
  document.querySelectorAll('[data-launch-target]').forEach(function (el) {
    el.textContent = p.launchTarget.toLocaleString('en-US');
  });
})(NOHM_PRICING);
