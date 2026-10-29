// The role pages show today's prices and switches from the NOHM server, so a
// price changed in the admin panel is right here too. The page's own text is
// already today's, and stays if the server can't be reached.
//
//   <span data-price="KEY">$7</span>          the key's current price
//   <span data-rate="platformFeeRate">7.9%</span>  a rate the server sends as a
//                                             fraction (platformFeeRate, NOHM's fee on
//                                             a pro's job; threeQuotesFeeRate)
//   <s data-price-was="KEY" hidden>$40</s>    its regular price, shown only while discounted
//   <span data-price-share="KEY" data-share-of="150000">1.3%</span>
//                                             the key's price as a share of that many
//                                             cents, to one decimal (Autopilot
//                                             against a $1,500 rent)
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

  // "7.9%", "5%", "7.85%": two decimals at most, no trailing zeros (the
  // server's platformFeePercentLabel).
  function percent(rate) {
    var bps = Math.max(0, Math.round(rate * 10000));
    var part = String(bps % 100).padStart(2, '0').replace(/0+$/, '');
    return Math.floor(bps / 100) + (part ? '.' + part : '') + '%';
  }

  // 19.99 of 1,500 → "1.3%": one decimal, no trailing ".0".
  function share(cents, ofCents) {
    return Math.round((cents / ofCents) * 1000) / 10 + '%';
  }

  if (document.querySelector('[data-price], [data-price-was], [data-rate], [data-price-share]')) {
    get('/config/pricing').then(function (prices) {
      document.querySelectorAll('[data-rate]').forEach(function (el) {
        var r = prices[el.getAttribute('data-rate')];
        if (typeof r === 'number' && r >= 0 && r < 1) el.textContent = percent(r);
      });
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
      document.querySelectorAll('[data-price-share]').forEach(function (el) {
        var p = prices[el.getAttribute('data-price-share')];
        var of = Number(el.getAttribute('data-share-of'));
        if (p && typeof p.currentAmountCents === 'number' && of > 0) el.textContent = share(p.currentAmountCents, of);
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
