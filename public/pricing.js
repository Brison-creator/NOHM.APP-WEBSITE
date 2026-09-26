// NOHM fees shown on the website. The app has its own admin setting for the
// launch threshold; the site can't see the user count, so flip `launch` to
// false here when NOHM reaches its launch target and every page updates.
var NOHM_PRICING = {
  launch: true,            // 50% off until 1,000 activated homeowners
  launchTarget: 1000,
  express: { launch: 20, regular: 40 },
  now: { launch: 30, regular: 60 }
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
  document.querySelectorAll('[data-launch-only]').forEach(function (el) { el.hidden = !p.launch; });
  document.querySelectorAll('[data-launch-target]').forEach(function (el) {
    el.textContent = p.launchTarget.toLocaleString('en-US');
  });
})(NOHM_PRICING);
