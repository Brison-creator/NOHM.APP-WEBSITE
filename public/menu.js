// Adds the Menu button to the top bar and the full-screen menu it opens.
(function () {
  var bar = document.querySelector('.bar');
  if (!bar) return;

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menu-btn';
  btn.textContent = 'Menu';
  btn.setAttribute('aria-controls', 'site-menu');
  btn.setAttribute('aria-expanded', 'false');
  bar.appendChild(btn);

  var store = /android/i.test(navigator.userAgent)
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
    '<li><a href="/homeowners">Homeowners</a></li>' +
    '<li><a href="' + store + '">Download the App</a></li>' +
    '<li><a href="/support">Support</a></li>' +
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
  btn.addEventListener('click', function () { setOpen(true); });
  close.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) setOpen(false);
  });
})();
