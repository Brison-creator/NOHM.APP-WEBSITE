// NOHM fees shown on the website. One price each, always: no launch
// pricing, no discount, no struck-through "regular" price (owner,
// 2026-10-29: "make now permantly 60 for 60 no discounts now its confusing
// and also express is 30 now standard is 48 hours out no sooner no matter
// what"). Keep these in step with the NOHM admin.
//   <span data-fee="express">$30</span>   the fee, in whole dollars
var NOHM_PRICING = {
  express: 30,             // NOHM Express: a pro today
  now: 60,                 // NOHM NOW, "60 for 60": a pro at your door within
                           // 60 minutes of booking, or no NOW fee
  standardLeadHours: 48,   // Standard: no fee, 48 hours or more after booking
  // Rentals (set in the NOHM admin; keep these in step with it).
  //   plan: the NOHM rental plan (owner, 2026-11-16: "7.99 a month to add as
  //   many rentals as you want then we keep all the other fees in place the
  //   same way ok that makes sense also first month is free"). One price per
  //   landlord account per month, however many rentals they add, with
  //   Financial Management on every enrolled rental (rent collection and
  //   tracking, ledgers and records, payment reminders, financial reporting,
  //   the Schedule E report included). The first trialDays days are free;
  //   cancel any time. Billed by the App Store or Google Play when bought in
  //   the app, or to the landlord's card on the web. The earlier
  //   founding-partner program is closed to new landlords (owner, 2026-11-16):
  //   no page offers it, and "free" attaches to the landlord plan only as
  //   "first month free".
  //   Everything below stays as it was: the tenant's bank payment fee
  //   (achFee, each bank rent payment, which the landlord may cover: about $5
  //   is the processor's cost, NOHM keeps about $2), the applicant's
  //   background check, a walkthrough (work the landlord books) and the
  //   optional NOHM Autopilot.
  //   <span data-rental="plan">$7.99</span>        the plan, a month
  //   <span data-rental-year="plan">$95.88</span>  twelve months of it
  //   <span data-rental-days="trialDays">30</span> the free days
  rentals: {
    plan: 7.99,
    trialDays: 30,
    // NOHM Autopilot, optional, per rental per month, for everyone (owner,
    // 2026-10-29: "Wait Nohm autopilot cost still ok"; server
    // RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY). Its share of a $1,500 rent is
    // worked out from it (data-rental-share).
    autopilot: 19.99,
    achFee: 7,
    walkthrough: 79,
    // Owner, 2026-10-09: one background check, paid by the applicant
    // where the law allows.
    application: 50
  }
};

(function (p) {
  document.querySelectorAll('[data-fee]').forEach(function (el) {
    el.textContent = '$' + p[el.getAttribute('data-fee')];
  });
  document.querySelectorAll('[data-rental]').forEach(function (el) {
    el.textContent = '$' + p.rentals[el.getAttribute('data-rental')];
  });
  // A monthly price for twelve months, in dollars and cents: 7.99 → $95.88.
  document.querySelectorAll('[data-rental-year]').forEach(function (el) {
    var month = p.rentals[el.getAttribute('data-rental-year')];
    if (typeof month === 'number') el.textContent = '$' + (Math.round(month * 12 * 100) / 100).toFixed(2);
  });
  // A number of days, as a bare number: 30.
  document.querySelectorAll('[data-rental-days]').forEach(function (el) {
    var days = p.rentals[el.getAttribute('data-rental-days')];
    if (typeof days === 'number') el.textContent = String(days);
  });
  // <span data-rental-share="autopilot" data-share-of="1500">1.3%</span>:
  // a rental price as a share of that rent, to one decimal.
  document.querySelectorAll('[data-rental-share]').forEach(function (el) {
    var part = p.rentals[el.getAttribute('data-rental-share')];
    var whole = Number(el.getAttribute('data-share-of'));
    if (typeof part === 'number' && whole > 0) el.textContent = Math.round((part / whole) * 1000) / 10 + '%';
  });
})(NOHM_PRICING);
