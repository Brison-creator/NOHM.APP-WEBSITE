// nohm.app/go/landlords: what visitors look at, so the page can be made
// better. Each is a HEAD to this page that the site's access logs count
// (tools/ads/report.py) with no name, email or id in it: each part of the
// page scrolled to (?seen=), each question opened (?faq=), and time on the
// page (?stay= seconds, only while it's on screen). The hero test's
// version (the page's own script) rides along as &v=.
(function () {
  var v = document.documentElement.getAttribute('data-v') || 'a';
  var sent = {};
  function count(key, value) {
    var k = key + '=' + value;
    if (sent[k]) return;
    sent[k] = true;
    try {
      fetch('/go/landlords/?' + k + '&v=' + v, { method: 'HEAD', cache: 'no-store', keepalive: true }).catch(function () {});
    } catch (e) { /* an old browser: not counted */ }
  }

  // A part is "seen" once its top has come up into the top 60% of the screen.
  var parts = document.querySelectorAll('[data-seen]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        count('seen', e.target.getAttribute('data-seen'));
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -40% 0px' });
    // The hero is seen on arrival: its count carries the test's version.
    for (var i = 0; i < parts.length; i++) io.observe(parts[i]);
  }

  var qs = document.querySelectorAll('.faq details[data-q]');
  for (var j = 0; j < qs.length; j++) {
    qs[j].addEventListener('toggle', function (e) {
      if (e.currentTarget.open) count('faq', e.currentTarget.getAttribute('data-q'));
    });
  }

  // Seconds on screen: a tab left in the background doesn't count.
  var STAYS = [10, 30, 60, 120, 300];
  var shown = 0;
  var timer = setInterval(function () {
    if (document.hidden) return;
    shown += 1;
    if (STAYS.indexOf(shown) !== -1) count('stay', shown);
    if (shown >= STAYS[STAYS.length - 1]) clearInterval(timer);
  }, 1000);
})();
