// Checking a NOHM paper: nohm.app/verify/<ID> and nohm.app/verify?id=<ID>
// go on to the NOHM server's check page, which knows every Document ID
// (NOHM-ID-…, NOHM-TAX-…, NOHM-HOME-…). Loaded by /verify and by the
// not-found page, which is what a path like /verify/NOHM-ID-… lands on.
(function () {
  var CHECK = 'https://api.nohm.app/verify/';
  var clean = function (raw) {
    return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
  };
  var go = function (raw) {
    var id = clean(raw);
    if (id) window.location.replace(CHECK + encodeURIComponent(id));
    return !!id;
  };
  var inPath = /^\/verify\/([^/?#]+)\/?$/.exec(window.location.pathname);
  if (inPath && go(decodeURIComponent(inPath[1]))) return;
  if (go(new URLSearchParams(window.location.search).get('id'))) return;

  // On /verify itself: the form (it also works without this, as ?id=).
  var attach = function () {
    var form = document.getElementById('verify-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('verify-id');
      if (!go(input.value)) {
        input.focus();
        document.getElementById('verify-note').textContent =
          'Type the Document ID printed at the foot of the paper.';
      }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
})();
