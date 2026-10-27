// nohm.app/pro/handyman: the thunder handyman's video in a card as the page
// opens, once a visit (tab). It plays once and holds on its last frame, the
// poster; "Apply in a minute" goes to the form. With reduced motion it shows
// the poster still.
(function () {
  var card = document.getElementById('promo');
  if (!card || typeof card.showModal !== 'function') return;
  try {
    if (sessionStorage.getItem('nohm:promo:handyman')) return;
    sessionStorage.setItem('nohm:promo:handyman', '1');
  } catch (e) { /* no storage: show it this time */ }
  var video = card.querySelector('video');
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function close() { card.close(); }
  card.addEventListener('close', function () { video.pause(); });
  card.querySelector('.promo-x').addEventListener('click', close);
  card.querySelector('.promo-close').addEventListener('click', close);
  card.querySelector('.btn').addEventListener('click', close);
  // A tap outside the card (on the backdrop) closes it too.
  card.addEventListener('click', function (e) { if (e.target === card) close(); });
  setTimeout(function () {
    card.showModal();
    if (!still) {
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* autoplay refused: the poster stays */ });
    }
  }, 600);
})();
