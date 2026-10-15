// NOHM fees shown on the website. The app has its own admin setting for the
// launch threshold; the site can't see the user count, so flip `launch` to
// false here when NOHM reaches its launch target and every page updates.
var NOHM_PRICING = {
  launch: true,            // 50% off until 1,000 activated homeowners
  launchTarget: 1000,
  express: { launch: 20, regular: 40 },
  now: { launch: 30, regular: 60 },
  // Rentals, in dollars (set in the NOHM admin's Prices; keep these in step
  // with it). Rental plans are chosen per rental and mix freely:
  //   Free                  $0, always. Adding a rental never starts a plan.
  //   Financial Management  planBase + financialPerRental for each enrolled rental
  //   NOHM Autopilot        planBase + autopilotPerRental for each Autopilot
  //                         rental; includes Financial Management (never
  //                         also financialPerRental)
  // planBase is charged once per landlord account while any rental is on a
  // paid plan, whichever plans they are.
  rentals: {
    planBase: 9,
    financialPerRental: 7,
    autopilotPerRental: 19.99,
    walkthrough: 79,
    // Rent by bank (ACH): a flat fee per payment, whatever the rent; the
    // landlord pays it from their payout or passes it to the tenant, per
    // lease. A returned bank payment's fee (Stripe's) comes out of the
    // landlord's next payout.
    achFlat: 7,
    achReturn: 4,
    // Paid by the landlord, on any plan, only if the applicant connects
    // their bank (Plaid).
    incomeCheck: 20,
    // Optional screening the renter buys (Certn). Applying is free.
    // readyAddOn is worked out below: NOHM Ready minus Standard.
    screeningStandard: 55,
    screeningReady: 75
  }
};

(function (p) {
  var r = p.rentals;
  r.readyAddOn = r.screeningReady - r.screeningStandard;

  // "$7", "$19.99", "$55.98": cents only when there are some.
  function money(n) {
    var c = Math.round(n * 100);
    return '$' + (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
  }

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
    el.textContent = money(r[el.getAttribute('data-rental')]);
  });
  // A worked total: data-rental-sum="planBase autopilotPerRental*2 financialPerRental".
  document.querySelectorAll('[data-rental-sum]').forEach(function (el) {
    var cents = 0;
    el.getAttribute('data-rental-sum').split(/\s+/).forEach(function (part) {
      if (!part) return;
      var bits = part.split('*');
      cents += Math.round(r[bits[0]] * 100) * (bits[1] ? Number(bits[1]) : 1);
    });
    el.textContent = money(cents / 100);
  });
  document.querySelectorAll('[data-launch-only]').forEach(function (el) { el.hidden = !p.launch; });
  document.querySelectorAll('[data-launch-target]').forEach(function (el) {
    el.textContent = p.launchTarget.toLocaleString('en-US');
  });
})(NOHM_PRICING);
