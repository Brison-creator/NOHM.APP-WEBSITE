// The booth: when nobody's touching it, the demo plays itself (a Standard
// repair start to finish, then an Express job whose card is declined, pauses
// and is fixed). Any touch hands it to the visitor with a clean slate; a
// minute without a touch brings the loop back for the next person.
(function () {
  'use strict';
  var D = window.NohmDemo;
  if (!D) return;

  var IDLE_MS = 60000; // no touches for this long: back to the loop
  var STEP_MS = 1100; // between taps while it plays itself
  var TAP_MS = 650; // how long a tap shows before it lands

  var banner = document.getElementById('attract');
  var playing = false;
  var run = 0; // bumped to stop a loop that's mid-play
  var lastTouch = Date.now();
  var swallowUntil = 0; // the click that follows the waking touch, if the browser sends one

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function job() { return D.world().jobs[0]; }

  // Show the tap on the right phone, then do it.
  function tap(role, act, data, mine) {
    if (mine !== run) return Promise.reject(new Error('stopped'));
    var app = D.app(role);
    data = data || {};
    var sel = '[data-act="' + act + '"]';
    Object.keys(data).forEach(function (k) { sel += '[data-' + k + '="' + data[k] + '"]'; });
    var el = app.root.querySelector(sel);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('d-tap');
    }
    return sleep(TAP_MS).then(function () {
      if (mine !== run) throw new Error('stopped');
      app.act(act, data);
      return sleep(STEP_MS);
    });
  }

  function standardRepair(mine) {
    var id;
    return tap('homeowner', 'trade', { trade: 'plumbing' }, mine)
      .then(function () { return tap('homeowner', 'submit', {}, mine); })
      .then(function () { id = job().id; return tap('homeowner', 'pick', { id: id, n: '0' }, mine); })
      .then(function () { return tap('pro', 'accept', { id: id }, mine); })
      .then(function () { return tap('pro', 'unlock', { id: id }, mine); })
      .then(function () { return tap('pro', 'pro', { step: 'enroute', id: id }, mine); })
      .then(function () { return tap('pro', 'pro', { step: 'arrive', id: id }, mine); })
      .then(function () { return tap('pro', 'go', { view: 'pin' }, mine); })
      .then(function () {
        return job().pin.split('').reduce(function (p, k) {
          return p.then(function () { return tap('pro', 'key', { k: k }, mine); });
        }, Promise.resolve());
      })
      .then(function () { return tap('pro', 'go', { view: 'findings' }, mine); })
      .then(function () { return tap('pro', 'send-estimate', { id: id }, mine); })
      .then(function () { return tap('homeowner', 'approve', { id: id }, mine); })
      .then(function () { return tap('pro', 'pro', { step: 'start', id: id }, mine); })
      .then(function () { return tap('pro', 'pro', { step: 'complete', id: id }, mine); })
      .then(function () { return tap('homeowner', 'confirm', { id: id }, mine); })
      .then(function () { return tap('homeowner', 'rate', { id: id, n: '5' }, mine); })
      .then(function () { return sleep(4000); });
  }

  // The card rule: declined, paused with the clock on both phones, fixed, on its way.
  function declinedCard(mine) {
    var id;
    return tap('homeowner', 'card', { v: 'declined' }, mine)
      .then(function () { return tap('homeowner', 'trade', { trade: 'hvac' }, mine); })
      .then(function () { return tap('homeowner', 'tier', { v: 'EXPRESS' }, mine); })
      .then(function () { return tap('homeowner', 'submit', {}, mine); })
      .then(function () { id = job().id; return tap('pro', 'accept', { id: id }, mine); })
      .then(function () { return sleep(6000); })
      .then(function () { return tap('homeowner', 'fixcard', { id: id }, mine); })
      .then(function () { return tap('pro', 'pro', { step: 'enroute', id: id }, mine); })
      .then(function () { return tap('pro', 'pro', { step: 'arrive', id: id }, mine); })
      .then(function () { return sleep(3500); });
  }

  function loop(mine) {
    if (mine !== run) return;
    D.reset();
    standardRepair(mine)
      .then(function () { if (mine === run) D.reset(); return declinedCard(mine); })
      .then(function () { loop(mine); })
      .catch(function () { /* stopped by a touch */ });
  }

  function startLoop() {
    playing = true;
    banner.hidden = false;
    run++;
    loop(run);
  }

  function handOver() {
    playing = false;
    banner.hidden = true;
    run++;
    D.reset();
  }

  // The first touch during the loop only wakes it up; it doesn't also press
  // whatever button was under the finger.
  document.addEventListener('pointerdown', function (e) {
    lastTouch = Date.now();
    if (playing) {
      e.preventDefault();
      e.stopPropagation();
      swallowUntil = Date.now() + 700;
      handOver();
    }
  }, true);
  document.addEventListener('click', function (e) {
    lastTouch = Date.now();
    if (Date.now() < swallowUntil) {
      e.preventDefault();
      e.stopPropagation();
      swallowUntil = 0;
    }
  }, true);
  document.addEventListener('keydown', function () { lastTouch = Date.now(); }, true);
  document.addEventListener('input', function () { lastTouch = Date.now(); }, true);

  setInterval(function () {
    if (!playing && Date.now() - lastTouch > IDLE_MS) startLoop();
  }, 5000);

  // For testing: ?fast plays the loop quickly.
  if (/[?&]fast\b/.test(location.search)) { STEP_MS = 150; TAP_MS = 100; }

  startLoop();
})();
