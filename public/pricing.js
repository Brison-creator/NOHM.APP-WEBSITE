// NOHM fees shown on the website. One price each, always: no launch
// pricing, no discount, no struck-through "regular" price (owner,
// 2026-10-29: "make now permantly 60 for 60 no discounts now its confusing
// and also express is 30 now standard is 48 hours out no sooner no matter
// what"). Keep these in step with the NOHM admin.
//   <span data-fee="express">$30</span>   the fee, in whole dollars
var NOHM_PRICING = {
  express: 30,             // NOHM Express: a pro today
  now: 60,                 // NOHM NOW, "60 for 60": a pro heads your way within
                           // 60 minutes of accepting, or no NOW fee
  standardLeadHours: 48,   // Standard: no fee, 48 hours or more after booking
  // Rentals (set in the NOHM admin; keep these in step with it). Free for
  // the first 10,000 landlords, NOHM Founding Partners, numbered in sign-up
  // order by the server (owner, 2026-10-29: "It's absolutely free to the
  // landlord. No spam no ads nothing." / "This will be for the first 10,000
  // landlords to signup."): every rental gets rent collection, the books
  // and the rest, the NOHM Income Check too, for good, with no plan or
  // monthly fee (a card on file keeps fake accounts out; it's charged only
  // for work they book). The site never shows a count of who's left. NOHM
  // is paid by the tenant's bank payment fee (achFee, each bank rent
  // payment, which the landlord may cover: about $5 is the processor's
  // cost, NOHM keeps about $2) and by the application. A walkthrough is
  // work the landlord books.
  rentals: {
    free: 0,
    // NOHM Autopilot, optional, per rental per month, for everyone,
    // Founding Partners included (owner, 2026-10-29: "Wait Nohm autopilot
    // cost still ok"; server RENTAL_AUTOPILOT_PER_RENTAL_MONTHLY). Its share
    // of a $1,500 rent is worked out from it (data-rental-share).
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
  // <span data-rental-share="autopilot" data-share-of="1500">1.3%</span>:
  // a rental price as a share of that rent, to one decimal.
  document.querySelectorAll('[data-rental-share]').forEach(function (el) {
    var part = p.rentals[el.getAttribute('data-rental-share')];
    var whole = Number(el.getAttribute('data-share-of'));
    if (typeof part === 'number' && whole > 0) el.textContent = Math.round((part / whole) * 1000) / 10 + '%';
  });
})(NOHM_PRICING);
