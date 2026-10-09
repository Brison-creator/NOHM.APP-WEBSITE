// Adds the Menu button to the top bar and the full-screen menu it opens.
// Its download link goes to Google Play on Android, the App Store otherwise.
(function () {
  var android = /android/i.test(navigator.userAgent);

  var bar = document.querySelector('.bar');
  if (!bar) return;

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menu-btn';
  btn.textContent = 'Menu';
  btn.setAttribute('aria-controls', 'site-menu');
  btn.setAttribute('aria-expanded', 'false');
  bar.appendChild(btn);

  var store = android
    ? 'https://play.google.com/store/apps/details?id=com.nohm.app'
    : 'https://apps.apple.com/us/app/nohm-app/id6761128513';
  var menu = document.createElement('nav');
  menu.id = 'site-menu';
  menu.className = 'menu';
  menu.setAttribute('aria-label', 'Menu');
  menu.innerHTML =
    '<div class="menu-top"><button type="button" class="menu-close" aria-label="Close menu">' +
    '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15" stroke="#171a20" stroke-width="1.6" stroke-linecap="round"/></svg>' +
    '</button></div>' +
    '<ul>' +
    '<li><a href="/">Home</a></li>' +
    '<li><a href="/book">Book a Pro</a></li>' +
    '<li><a href="/how-it-works">How It Works</a></li>' +
    '<li><a href="/homeowners">Homeowners</a></li>' +
    '<li><a href="/home-history">Home History</a></li>' +
    '<li><a href="/landlords">Landlords</a></li>' +
    '<li><a href="/renters">Renters</a></li>' +
    '<li data-rentals="live" hidden><a href="/rentals">Rentals</a></li>' +
    '<li><a href="/services">All Services</a></li>' +
    '<li><a href="/local-pros">Local Pros</a></li>' +
    '<li><a href="/quotes">Three Quotes</a></li>' +
    '<li><a href="/financing">Financing</a></li>' +
    '<li><a href="/pros">For Pros</a></li>' +
    '<li><a href="/join">Join as a Pro</a></li>' +
    '<li><a href="/join/renter">Renters: Accept Your Invite</a></li>' +
    '<li><a href="' + store + '">Download the App</a></li>' +
    '<li><a href="/step-in">When NOHM Steps In</a></li>' +
    '<li><a href="/support">Support</a></li>' +
    '<li><a href="/founder">Founder</a></li>' +
    '<li><a href="/delete-account">Delete Your Account</a></li>' +
    '<li><a href="/privacy">Privacy</a></li>' +
    '<li><a href="/terms">Terms</a></li>' +
    '</ul>';
  document.body.appendChild(menu);
  var close = menu.querySelector('.menu-close');

  function setOpen(open) {
    menu.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    (open ? close : btn).focus();
  }
  btn.addEventListener('click', function () {
    setOpen(true);
    showRentals();
  });
  close.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) setOpen(false);
  });

  // Rentals on nohm.app shows only while the NOHM server has its search
  // on (GET /config/web → publicRentalsSearch; server
  // PUBLIC_RENTALS_SEARCH_ENABLED). Elements marked data-rentals="live"
  // appear then; data-rentals="soon" ones say "coming soon" otherwise.
  // Asked once a tab (sessionStorage), when the page has such lines or
  // the menu opens; anything but an explicit true is "not yet".
  function rentalsLive() {
    var KEY = 'nohm:rentalsLive';
    try {
      var kept = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (kept && Date.now() - kept.at < 300000) return Promise.resolve(kept.live === true);
    } catch (e) { /* storage off */ }
    return serverBase().then(function (base) {
      return fetch(base + '/config/web').then(function (r) { return r.ok ? r.json() : null; });
    }).then(function (cfg) {
      var live = Boolean(cfg && cfg.publicRentalsSearch === true);
      try { sessionStorage.setItem(KEY, JSON.stringify({ live: live, at: Date.now() })); } catch (e) { /* storage off */ }
      return live;
    }, function () { return false; });
  }
  // The server /book uses (public/book/config.js), loaded if this page
  // doesn't have it; ?api= only on localhost, as /book and /rentals.
  function serverBase() {
    var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    var dev = null;
    if (local) {
      try { dev = new URLSearchParams(location.search).get('api') || sessionStorage.getItem('rentals:api'); } catch (e) { dev = null; }
    }
    if (dev) return Promise.resolve(dev);
    if (window.NOHM_BOOK) return Promise.resolve(window.NOHM_BOOK.apiBase);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '/book/config.js';
      s.onload = function () { window.NOHM_BOOK ? resolve(window.NOHM_BOOK.apiBase) : reject(new Error('no config')); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  var rentalsAsked = null;
  function showRentals() {
    if (!rentalsAsked) rentalsAsked = rentalsLive();
    return rentalsAsked.then(function (live) {
      var els = document.querySelectorAll('[data-rentals]');
      for (var i = 0; i < els.length; i++) {
        els[i].hidden = els[i].getAttribute('data-rentals') === 'live' ? !live : live;
      }
      return live;
    });
  }
  window.nohmRentalsLive = showRentals;
  if (document.querySelector('main [data-rentals]')) showRentals();
})();
