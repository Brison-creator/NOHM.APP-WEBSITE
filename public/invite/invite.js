// The renter's invite code, from the link in NOHM's text
// (nohm.app/invite/renter?code=123456): shown on the page so it's right
// there when the app asks for it. Six digits or nothing, set as text.
(function () {
  var box = document.getElementById('inv-code');
  var value = document.getElementById('inv-code-value');
  if (!box || !value) return;
  var code = '';
  try {
    code = new URLSearchParams(location.search).get('code') || '';
  } catch (e) {
    return;
  }
  if (!/^\d{6}$/.test(code)) return;
  value.textContent = code;
  box.hidden = false;
})();
