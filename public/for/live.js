// The role pages show today's prices and switches from the NOHM server, so a
// price changed in the admin panel is right here too. The page's own text is
// already today's, and stays if the server can't be reached.
//
//   <span data-price="KEY">$7</span>          the key's current price
//   <s data-price-was="KEY" hidden>$40</s>    its regular price, shown only while discounted
//   <x data-feature-on="name" hidden>         shown once GET /config/features says name: true
//   <x data-feature-off="name">               hidden once it says true
(function () {
  var API = 'https://api.nohm.io/api/v1';

  function money(cents) {
    var d = cents / 100;
    return '$' + (cents % 100 === 0 ? d.toFixed(0) : d.toFixed(2));
  }

  function get(path) {
    return fetch(API + path, { headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error(path + ' ' + r.status);
      return r.json();
    });
  }

  if (document.querySelector('[data-price], [data-price-was]')) {
    get('/config/pricing').then(function (prices) {
      document.querySelectorAll('[data-price]').forEach(function (el) {
        var p = prices[el.getAttribute('data-price')];
        if (p && typeof p.currentAmountCents === 'number') el.textContent = money(p.currentAmountCents);
      });
      document.querySelectorAll('[data-price-was]').forEach(function (el) {
        var p = prices[el.getAttribute('data-price-was')];
        if (!p) return;
        el.textContent = money(p.baseAmountCents);
        el.hidden = !p.hasLiveDiscount;
      });
    }).catch(function () {});
  }

  if (document.querySelector('[data-feature-on], [data-feature-off]')) {
    get('/config/features').then(function (features) {
      document.querySelectorAll('[data-feature-on]').forEach(function (el) {
        el.hidden = features[el.getAttribute('data-feature-on')] !== true;
      });
      document.querySelectorAll('[data-feature-off]').forEach(function (el) {
        el.hidden = features[el.getAttribute('data-feature-off')] === true;
      });
    }).catch(function () {});
  }
})();
