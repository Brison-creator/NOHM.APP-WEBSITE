// The NOHM app on sample data, in the browser only. Nothing here talks to
// NOHM: no accounts, no pros, no cards. One shared "world" lets a visitor
// play every role on the same job: book as the homeowner, switch to the
// pro to take it, and so on. Saved in this browser so a refresh keeps it.
(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────
  var EMAIL = 'test@nohm.app';
  var PASSWORD = 'password';
  var PAUSE_MINUTES = 30; // a failed card: time to update it before the pro is released
  var EXPRESS_SECONDS = 90; // an Express offer: time for the closest pro to take it

  var P = window.NOHM_PRICING || { launch: true, express: { launch: 20, regular: 40 }, now: { launch: 30, regular: 60 } };
  function fee(k) { return P.launch ? P[k].launch : P[k].regular; }

  var HOME = { address: '123 Maple Street', hin: 'HIN 0418-3391-7720' };
  var BUILDING = { name: 'Maple Court', units: ['1A', '1B', '2A', '2B'] };
  var TENANT = { name: 'Taylor Brooks', phone: '(555) 010-2244', rent: 950, due: 1 };
  var PROS = [
    { name: 'Riley Parker', biz: 'Parker Home Services', rating: '4.9', jobs: 212 },
    { name: 'Jordan Reed', biz: 'Reed & Sons', rating: '4.8', jobs: 148 },
    { name: 'Casey Ellis', biz: 'Ellis Repair Co.', rating: '4.7', jobs: 96 }
  ];

  var ICONS = {
    plumbing: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
    hvac: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/>',
    electrical: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    appliance: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6.5h2"/>',
    locksmith: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/>',
    handyman: '<path d="M14.5 5.5a4 4 0 0 0 4 5.5l-8 8a2 2 0 0 1-3-3l8-8a4 4 0 0 0-1-2.5z"/>',
    garage: '<path d="M3 10l9-6 9 6v10H3z"/><path d="M7 20v-7h10v7M7 16.5h10"/>',
    pest: '<ellipse cx="12" cy="13" rx="4" ry="6"/><path d="M12 7V4M8 10L4 8M16 10l4-2M8 14H4M16 14h4M8 18l-3 2M16 18l3 2"/>',
    home: '<path d="M3 11l9-7 9 7v9H3z"/><path d="M10 20v-6h4v6"/>',
    tool: '<path d="M14.5 5.5a4 4 0 0 0 4 5.5l-8 8a2 2 0 0 1-3-3l8-8a4 4 0 0 0-1-2.5z"/>',
    building: '<rect x="5" y="3" width="14" height="18"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3"/>'
  };
  function icon(k) { return '<span class="d-ico"><svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[k] || ICONS.tool) + '</svg></span>'; }

  var TRADES = [
    { id: 'plumbing', name: 'Plumbing', issue: 'Kitchen sink is leaking under the cabinet.',
      diag: ['Cracked P-trap under the kitchen sink', 'The slip nut on the P-trap is cracked and the supply line is corroded at the valve. Both need replacing to stop the leak.'],
      lines: [['Replace P-trap and supply line', 140], ['Parts', 35]], fixed: 'Replaced the P-trap and supply line. No more leak.' },
    { id: 'hvac', name: 'HVAC', issue: 'AC is running but blowing warm air.',
      diag: ['Failed run capacitor on the condenser', 'The condenser fan capacitor has failed, so the outdoor unit can’t move heat. Refrigerant pressure looks normal.'],
      lines: [['Replace run capacitor', 165], ['Capacitor', 45]], fixed: 'Replaced the capacitor. Cooling to 20 degrees below outside air.' },
    { id: 'electrical', name: 'Electrical', issue: 'Kitchen outlets stopped working.',
      diag: ['Tripped GFCI with a worn receptacle', 'The GFCI feeding the kitchen counter circuit won’t hold a reset. The receptacle is worn and needs replacing.'],
      lines: [['Replace GFCI receptacle', 120], ['Parts', 28]], fixed: 'Replaced the GFCI. All kitchen outlets tested and working.' },
    { id: 'appliance', name: 'Appliance', issue: 'Washer won’t drain and shows an error code.',
      diag: ['Clogged drain pump filter', 'The drain pump filter is packed with lint and a sock. The pump itself tests fine.'],
      lines: [['Clear drain pump and test', 110], ['Gasket', 18]], fixed: 'Cleared the drain pump and replaced the gasket. Drains normally.' },
    { id: 'locksmith', name: 'Locksmith', issue: 'Front door lock is sticking and hard to turn.',
      diag: ['Worn lock cylinder', 'The front door cylinder pins are worn. Rekeying won’t fix it; the cylinder needs replacing.'],
      lines: [['Replace lock cylinder', 95], ['Cylinder', 40]], fixed: 'Replaced the cylinder with two new keys. Turns smoothly.' },
    { id: 'handyman', name: 'Handyman', issue: 'Bathroom door won’t latch.',
      diag: ['Sagging hinges and a misaligned strike', 'The top hinge screws are stripped, so the door sags and misses the strike plate.'],
      lines: [['Re-hang door and move strike', 85], ['Hardware', 12]], fixed: 'Reset the hinges with longer screws and moved the strike. Latches every time.' },
    { id: 'garage', name: 'Garage Door', issue: 'Garage door stops halfway and reverses.',
      diag: ['Misaligned safety sensors', 'The photo-eye sensors are knocked out of line, so the opener thinks something is in the way.'],
      lines: [['Align sensors and tune opener', 90], ['Brackets', 15]], fixed: 'Realigned the sensors and tuned the opener. Opens and closes all the way.' },
    { id: 'pest', name: 'Pest Control', issue: 'Ants in the kitchen near the back door.',
      diag: ['Ant trail from a gap under the threshold', 'Odorous house ants coming in under the back door threshold. The nest is outside along the foundation.'],
      lines: [['Treatment inside and out', 125], ['Seal threshold gap', 20]], fixed: 'Treated the trail and the nest, and sealed the threshold gap.' }
  ];
  function trade(id) { for (var i = 0; i < TRADES.length; i++) if (TRADES[i].id === id) return TRADES[i]; return TRADES[0]; }

  var ROLES = {
    homeowner: { label: 'Homeowner', line: 'Book a pro and keep your home’s record', ico: 'home' },
    pro: { label: 'Service Pro', line: 'Take jobs near you and get paid', ico: 'tool' },
    pm: { label: 'Property Manager', line: 'Run your units and tenant repairs', ico: 'building' },
    tenant: { label: 'Tenant', line: 'Ask your landlord for repairs', ico: 'key' }
  };
  var STORE = /android/i.test(navigator.userAgent)
    ? 'https://play.google.com/store/apps/details?id=com.nohm.app'
    : 'https://apps.apple.com/us/app/nohm-app/id6761128513';

  // ── State ─────────────────────────────────────────────────────────
  // One world per page, shared by every phone on it (the booth shows two).
  function fresh() {
    return {
      card: 'ok', proOnShift: false, proLive: false, pro: 0,
      jobs: [], seq: 1041, draft: null, inbox: [],
      invite: null, tenantIn: false, requests: [], records: []
    };
  }
  // What one phone is showing.
  function freshUI(role) {
    return { signedIn: !!role, role: role || null, view: role ? 'home' : 'signin', focus: null, err: null, pinEntry: '' };
  }
  var S = null;
  var apps = [];
  var storeKey = null; // null on the booth: every visitor starts clean
  function save() {
    if (!storeKey) return;
    try { localStorage.setItem(storeKey, JSON.stringify({ world: S, ui: apps[0] && apps[0].V })); } catch (e) { /* private mode */ }
  }
  function load(key) {
    try { var d = JSON.parse(localStorage.getItem(key)); if (d && d.world && d.ui) return d; } catch (e) { /* none */ }
    return null;
  }
  function renderAll() { apps.forEach(function (a) { a.render(); }); save(); }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n).toFixed(2).replace(/\.00$/, ''); }
  function now() { return Date.now(); }
  function clock(ms) {
    var left = Math.max(0, Math.round(ms / 1000));
    return Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
  }
  function timeOfDay(ms) { return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

  function notify(to, title, body) {
    S.inbox.unshift({ to: to, title: title, body: body, at: now(), seen: false });
    if (S.inbox.length > 40) S.inbox.length = 40;
  }
  function unread(role) { return S.inbox.filter(function (m) { return m.to === role && !m.seen; }).length; }

  function job(id) { for (var i = 0; i < S.jobs.length; i++) if (S.jobs[i].id === id) return S.jobs[i]; return null; }
  function proOf(j) { return PROS[j.pro || 0]; }
  function activeFor(role) {
    return S.jobs.filter(function (j) { return j.booker === role && j.status !== 'CANCELLED'; });
  }

  // ── The job's life ────────────────────────────────────────────────
  var STEPS = ['Requested', 'Accepted', 'On the way', 'Arrived', 'Working', 'Done'];
  var STEP_OF = { MATCHING: 0, OFFERED: 0, SCHEDULED: 1, ACCEPTED: 1, EN_ROUTE: 2, ARRIVED: 3, VERIFIED: 3, ESTIMATED: 3, APPROVED: 3, WORKING: 4, COMPLETED: 5, CONFIRMED: 5 };

  function newJob(opts) {
    var t = trade(opts.trade);
    var j = {
      id: 'j' + (++S.seq), number: 'NOHM-' + S.seq, trade: t.id, issue: opts.issue || t.issue,
      tier: opts.tier || 'STANDARD', window: opts.window || 'Morning (8–11 AM)', booker: opts.booker || 'homeowner',
      place: opts.place || HOME.address, status: 'MATCHING', pro: 0, pin: String(1000 + Math.floor(Math.random() * 9000)),
      lines: t.lines.map(function (l) { return l.slice(); }), diag: null, total: 0, msgs: [], rating: 0,
      pause: null, unlocked: false, offerEnds: null, arriveBy: null, createdAt: now()
    };
    S.jobs.unshift(j);
    return j;
  }

  function pause(j, kind, amount) {
    if (!j.pause) {
      j.pause = { kind: kind, amount: amount, ends: now() + PAUSE_MINUTES * 60000 };
      var what = { EXPRESS: 'Express fee', ESTIMATE: 'estimate' }[kind];
      notify(j.booker, 'Your job is paused',
        'Your card didn’t go through for the ' + money(amount) + ' ' + what + '. Update it in the next ' + PAUSE_MINUTES +
        ' minutes and we’ll pick right back up. If it isn’t updated by then, we’ll release your pro so they can help someone else.');
      notify('pro', kind === 'ESTIMATE' ? 'Hold on — don’t start yet' : 'Hold on — don’t head out yet',
        'The homeowner’s card didn’t go through. They have ' + PAUSE_MINUTES + ' minutes to update it, and we’ll tell you the moment it clears. If it doesn’t, you’re released from this job and free to take your next one.');
    }
  }
  function resume(j) {
    var kind = j.pause.kind;
    j.pause = null;
    notify(j.booker, 'You’re all set', 'Your card went through, and your job is back on.');
    notify('pro', kind === 'ESTIMATE' ? 'You’re clear to start' : 'You’re clear to go',
      kind === 'ESTIMATE' ? 'The homeowner’s card went through and the estimate is approved. You can start the work.' : 'The homeowner’s card went through. Head out now.');
  }
  function release(j) {
    j.pause = null;
    j.status = 'RELEASED';
    notify(j.booker, 'We released your pro', 'Your card wasn’t updated in time, so we closed this job and released your pro. Any holds on your card are released too. When you’re ready, you can book again any time.');
    notify('pro', 'You’re released from this job', 'The homeowner’s card wasn’t updated in time, so the job is closed. You’re free to take your next job.');
  }
  // The booker's card. Only the homeowner's can be set to decline, to try the pause.
  function cardWorks(j) { return j.booker !== 'homeowner' || S.card === 'ok'; }

  // Whose move it is, and what it does. Fast-forward and the pro's buttons share these.
  function proAccept(j) {
    j.status = j.tier === 'STANDARD' ? 'SCHEDULED' : 'ACCEPTED';
    j.offerEnds = null;
    if (j.tier === 'NOW') j.arriveBy = now() + 60 * 60000;
    notify(j.booker, 'Your pro accepted', proOf(j).biz + ' took your ' + trade(j.trade).name.toLowerCase() + ' job.');
    if (j.tier === 'EXPRESS') {
      if (cardWorks(j)) notify(j.booker, 'Express fee held', 'A ' + money(fee('express')) + ' Express fee is held on your card. It’s charged when work starts.');
      else pause(j, 'EXPRESS', fee('express'));
    }
  }
  function proEnRoute(j) {
    j.status = 'EN_ROUTE';
    notify(j.booker, 'Your pro is on the way', 'Your NOHM code is ' + j.pin + '. Give it to your pro at the door.');
  }
  function proArrive(j) { j.status = 'ARRIVED'; notify(j.booker, 'Your pro is here', 'Give them your code: ' + j.pin + '.'); }
  function proVerify(j) { j.status = 'VERIFIED'; }
  function proEstimate(j) {
    var t = trade(j.trade);
    j.diag = t.diag;
    j.total = j.lines.reduce(function (s, l) { return s + Number(l[1] || 0); }, 0);
    j.status = 'ESTIMATED';
    notify(j.booker, 'Your estimate is ready', proOf(j).name + ' found the problem. Approve the ' + money(j.total) + ' estimate so they can start.');
  }
  function bookerApprove(j) {
    if (!cardWorks(j)) { pause(j, 'ESTIMATE', j.total); return false; }
    j.status = 'APPROVED';
    notify('pro', 'Estimate approved — you can start', 'The ' + money(j.total) + ' estimate is approved. You’re clear to start the work.');
    return true;
  }
  function proStart(j) { j.status = 'WORKING'; }
  function proComplete(j) {
    j.status = 'COMPLETED';
    notify(j.booker, 'Is it fixed?', proOf(j).name + ' marked the job done. Confirm it’s fixed and your card is charged.');
  }
  function bookerConfirm(j) {
    j.status = 'CONFIRMED';
    var t = trade(j.trade);
    S.records.unshift({ trade: t.name, fixed: t.fixed, total: j.total, pro: proOf(j).biz, place: j.place, at: now() });
    notify('pro', 'Paid', 'The job is confirmed. Your payment goes out through NOHM.');
  }

  function nextMove(j) {
    if (j.pause) return null;
    switch (j.status) {
      case 'OFFERED': return { who: 'pro', label: 'Pro accepts', go: function () { proAccept(j); } };
      case 'SCHEDULED':
      case 'ACCEPTED': return { who: 'pro', label: 'Pro heads out', go: function () { j.unlocked = true; proEnRoute(j); } };
      case 'EN_ROUTE': return { who: 'pro', label: 'Pro arrives', go: function () { proArrive(j); } };
      case 'ARRIVED': return { who: 'pro', label: 'Pro enters your code', go: function () { proVerify(j); } };
      case 'VERIFIED': return { who: 'pro', label: 'Pro sends findings and price', go: function () { proEstimate(j); } };
      case 'ESTIMATED': return { who: j.booker, label: 'Approve the estimate', go: function () { bookerApprove(j); } };
      case 'APPROVED': return { who: 'pro', label: 'Pro starts work', go: function () { proStart(j); } };
      case 'WORKING': return { who: 'pro', label: 'Pro marks it done', go: function () { proComplete(j); } };
      case 'COMPLETED': return { who: j.booker, label: 'Confirm it’s fixed', go: function () { bookerConfirm(j); } };
      default: return null;
    }
  }

  // ── One phone ─────────────────────────────────────────────────────
  // opts.mode: 'web' (how-it-works), 'try' (full screen, from the QR code)
  // or 'kiosk' (the booth: a fixed role per phone, no sign-in).
  function mount(root, opts) {
    opts = opts || {};
    var MODE = opts.mode || 'web';
    var KIOSK = MODE === 'kiosk';
    var firstUI = null;
    if (!S) {
      storeKey = KIOSK ? null : 'nohm-' + MODE + '-v1';
      var saved = storeKey && load(storeKey);
      S = saved ? saved.world : fresh();
      if (KIOSK) S.proOnShift = true;
      firstUI = saved && saved.ui;
    }
    var V = KIOSK ? freshUI(opts.role) : (firstUI || freshUI(null));

  // ── Screens ───────────────────────────────────────────────────────
  function progress(j) {
    var at = STEP_OF[j.status] == null ? 0 : STEP_OF[j.status];
    return '<div class="d-steps">' + STEPS.map(function (s, i) {
      return '<div class="d-step ' + (i < at || j.status === 'CONFIRMED' ? 'done' : i === at ? 'now' : '') + '"><i></i>' + s + '</div>';
    }).join('') + '</div>';
  }
  function statusLine(j, forRole) {
    var pro = proOf(j);
    var lines = {
      MATCHING: 'Pick a pro to send it to.',
      OFFERED: j.tier === 'EXPRESS' ? 'Sent to the closest pro. They have ' + EXPRESS_SECONDS + ' seconds to take it.' : 'Waiting for ' + pro.name + ' to accept.',
      SCHEDULED: 'Booked with ' + pro.name + ' for tomorrow, ' + j.window + '.',
      ACCEPTED: j.tier === 'NOW' ? pro.name + ' is getting ready to leave.' : pro.name + ' accepted and is heading your way today.',
      EN_ROUTE: pro.name + ' is on the way.',
      ARRIVED: pro.name + ' is at the door.',
      VERIFIED: pro.name + ' is checking the problem.',
      ESTIMATED: 'Your estimate is ready.',
      APPROVED: 'Approved. ' + pro.name + ' can start.',
      WORKING: pro.name + ' is working on it.',
      COMPLETED: 'Done. Confirm it’s fixed.',
      CONFIRMED: j.rating ? 'Complete. Saved to the home’s record.' : 'Complete. How did it go?',
      RELEASED: 'Closed. The card wasn’t updated in time, so the pro was released.'
    };
    if (forRole === 'pro') {
      lines = {
        OFFERED: j.tier === 'EXPRESS' ? 'Express offer: take it before the timer runs out.' : 'New job offer.',
        SCHEDULED: 'Booked for tomorrow, ' + j.window + '.',
        ACCEPTED: 'Tap On my way when you set off.',
        EN_ROUTE: 'Mark arrived when you get there.',
        ARRIVED: 'Enter the homeowner’s 4-digit code.',
        VERIFIED: 'Send your findings and price.',
        ESTIMATED: 'Waiting for approval of your estimate.',
        APPROVED: 'Approved. Start the work.',
        WORKING: 'Mark it done when you finish.',
        COMPLETED: 'Waiting for the homeowner to confirm.',
        CONFIRMED: 'Confirmed. Payment goes out through NOHM.',
        RELEASED: 'You were released from this job. Free for your next one.'
      };
    }
    return lines[j.status] || '';
  }

  function pauseCard(j, role) {
    if (!j.pause) return '';
    var left = '<span class="d-timer" data-ends="' + j.pause.ends + '">' + clock(j.pause.ends - now()) + '</span>';
    if (role === 'pro') {
      return '<div class="d-card alert"><h3>' + (j.pause.kind === 'ESTIMATE' ? 'Hold on — don’t start yet' : 'Hold on — don’t head out yet') + '</h3>' +
        '<p>The homeowner’s card didn’t go through. We’ll tell you the moment it clears.</p>' +
        '<p style="margin-top:10px">' + left + ' <span class="d-small">for them to update it</span></p>' +
        '<p class="d-small" style="margin-top:6px">If it isn’t updated in time, you’re released from this job and free to take your next one.</p>' +
        '<button class="d-link" data-act="skip30" data-id="' + j.id + '">Demo: skip ahead ' + PAUSE_MINUTES + ' minutes</button></div>';
    }
    var what = j.pause.kind === 'ESTIMATE' ? 'the estimate' : 'the Express fee';
    var next = j.pause.kind === 'ESTIMATE' ? 'Update it to approve, and your pro can start.' : 'Update it, and your pro heads out right away.';
    return '<div class="d-card alert"><h3>Your job is paused</h3>' +
      '<p>Your card didn’t go through for ' + what + '. ' + next + '</p>' +
      '<p style="margin-top:10px">' + left + ' <span class="d-small">left to update your card</span></p>' +
      '<p class="d-small" style="margin-top:6px">If it isn’t updated in time, we’ll release your pro so they can help someone else, and any holds on your card are released.</p>' +
      '<button class="d-btn" data-act="fixcard" data-id="' + j.id + '">Update card</button>' +
      '<button class="d-link" data-act="skip30" data-id="' + j.id + '">Demo: skip ahead ' + PAUSE_MINUTES + ' minutes</button></div>';
  }

  function estimateTable(j) {
    return '<table class="d-lines">' + j.lines.map(function (l) {
      return '<tr><td>' + esc(l[0]) + '</td><td>' + money(l[1]) + '</td></tr>';
    }).join('') + '<tr class="total"><td>Total</td><td>' + money(j.total) + '</td></tr></table>';
  }

  // The booker's view of a job (homeowner, or property manager for a unit).
  function bookerJob(j) {
    var pro = proOf(j), t = trade(j.trade), h = '';
    h += '<button class="d-back" data-act="go" data-view="home">← Back</button>';
    h += '<h1 class="d-h1">' + esc(t.name) + (j.tier !== 'STANDARD' ? ' · ' + (j.tier === 'NOW' ? 'NOHM NOW' : 'Express') : '') + '</h1>';
    h += '<p class="d-sub">#' + j.number + ' · ' + esc(j.place) + '</p>';
    h += pauseCard(j, j.booker);
    if (j.status !== 'RELEASED') h += progress(j);
    h += '<div class="d-card"><h3>' + esc(j.pause ? 'Paused until your card goes through.' : statusLine(j)) + '</h3>';
    if (j.status === 'OFFERED' && j.tier === 'EXPRESS') h += '<p><span class="d-timer" data-offer="' + j.offerEnds + '">' + clock(j.offerEnds - now()) + '</span></p>';
    if (j.tier === 'NOW' && j.arriveBy && STEP_OF[j.status] < 3) h += '<p>Arriving by <b>' + timeOfDay(j.arriveBy) + '</b>. NOHM NOW: within 60 minutes of accepting.</p>';
    if (j.status !== 'MATCHING' && j.status !== 'OFFERED') h += '<p class="d-muted">' + esc(pro.name) + ' · ' + esc(pro.biz) + ' · ★ ' + pro.rating + '</p>';
    h += '</div>';

    if (j.status === 'EN_ROUTE' || j.status === 'ARRIVED') {
      h += '<div class="d-card blue"><h3>Your NOHM code</h3><p>Give it to your pro at the door. It proves the right person is at your home.</p>' +
        '<div class="d-pin">' + j.pin.split('').map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div></div>';
    }
    if (j.diag) h += '<div class="d-card"><p class="d-small">Findings</p><h3>' + esc(j.diag[0]) + '</h3><p>' + esc(j.diag[1]) + '</p></div>';
    if (j.status === 'ESTIMATED' && !j.pause) {
      h += '<div class="d-card"><h3>Estimate</h3>' + estimateTable(j) +
        '<p class="d-small" style="margin-top:10px">Approving places a hold on your card. You’re charged when the job is done.</p>' +
        '<button class="d-btn" data-act="approve" data-id="' + j.id + '">Approve ' + money(j.total) + '</button></div>';
    }
    if (j.status === 'COMPLETED') {
      h += '<div class="d-card"><h3>What was fixed</h3><p>' + esc(t.fixed) + '</p>' +
        '<button class="d-btn" data-act="confirm" data-id="' + j.id + '">Yes, it’s fixed</button></div>';
    }
    if (j.status === 'CONFIRMED') {
      h += '<div class="d-card"><h3>Receipt</h3>' + estimateTable(j) + '<p class="d-small" style="margin-top:8px">Charged when you confirmed. Saved to ' + (j.booker === 'pm' ? 'the unit’s' : 'your home’s') + ' record.</p></div>';
      h += '<div class="d-card"><h3>' + (j.rating ? 'Thanks for rating' : 'Rate ' + esc(pro.name)) + '</h3><div class="d-stars">';
      for (var i = 1; i <= 5; i++) h += '<button class="d-star ' + (i <= j.rating ? 'on' : '') + '" data-act="rate" data-id="' + j.id + '" data-n="' + i + '" aria-label="' + i + ' stars">★</button>';
      h += '</div></div>';
    }
    if (['SCHEDULED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'VERIFIED', 'ESTIMATED', 'APPROVED', 'WORKING'].indexOf(j.status) >= 0) {
      h += '<button class="d-btn sec" data-act="chat" data-id="' + j.id + '">Message ' + esc(pro.name.split(' ')[0]) + (j.msgs.length ? ' (' + j.msgs.length + ')' : '') + '</button>';
    }
    var mv = nextMove(j);
    if (j.pause) {
      h += KIOSK ? '<p class="d-small" style="margin-top:12px">The pro sees the same clock on their screen, on the right.</p>'
        : '<button class="d-btn sec" style="margin-top:16px" data-act="role" data-role="pro">Play the pro\u2019s part</button>';
    }
    if (mv && mv.who === 'pro' && KIOSK) {
      h += '<div class="d-card" style="margin-top:16px"><p class="d-small">It\u2019s the pro\u2019s move: tap it on their screen, on the right.</p>' +
        '<button class="d-link" data-act="ff" data-id="' + j.id + '">Or fast-forward: ' + esc(mv.label.toLowerCase()) + '</button></div>';
    } else if (mv && mv.who === 'pro') {
      h += '<div class="d-card" style="margin-top:16px"><p class="d-small">Demo: it’s the pro’s move.</p>' +
        '<button class="d-btn sec" data-act="role" data-role="pro">Play the pro’s part</button>' +
        '<button class="d-link" data-act="ff" data-id="' + j.id + '">Fast-forward: ' + esc(mv.label.toLowerCase()) + '</button></div>';
    }
    if (j.status === 'RELEASED' || (j.status === 'CONFIRMED' && j.rating)) {
      if (MODE === 'try') {
        h += '<div class="d-card blue" style="margin-top:16px"><h3>That\u2019s NOHM.</h3><p>Free to download. Book a real pro the next time something breaks.</p>' +
          '<a class="d-btn" href="' + STORE + '">Get the app</a></div>';
      }
      h += '<button class="d-btn' + (MODE === 'try' ? ' sec' : '') + '" data-act="go" data-view="home">Done</button>';
    }
    return h;
  }

  function signinView() {
    return '<div class="d-pad"><div class="d-mark">NOHM</div><p class="d-tagline">It’s always something.</p>' +
      '<div class="d-demo-login">Demo login: <b>' + EMAIL + '</b> · password <b>' + PASSWORD + '</b>' +
      '<button class="d-link" style="padding:6px 0 0;text-align:left" data-act="fill">Fill it in for me</button></div>' +
      (V.err ? '<p class="d-error">' + esc(V.err) + '</p>' : '') +
      '<form data-form="signin" novalidate>' +
      '<label class="d-field"><span>Email</span><input id="d-email" type="email" autocomplete="off" placeholder="you@example.com"' + (MODE === 'try' ? ' value="' + EMAIL + '"' : '') + ' /></label>' +
      '<label class="d-field"><span>Password</span><input id="d-pass" type="password" autocomplete="off"' + (MODE === 'try' ? ' value="' + PASSWORD + '"' : '') + ' /></label>' +
      '<button class="d-btn" type="submit">Sign in</button></form>' +
      '<p class="d-small" style="text-align:center;margin-top:14px">Sample data. Nothing here books a pro or charges a card.</p></div>';
  }

  function rolesView() {
    return '<div class="d-pad"><h1 class="d-h1">How will you use NOHM?</h1><p class="d-sub">Switch any time to see the other side of the same job.</p>' +
      Object.keys(ROLES).map(function (k) {
        var r = ROLES[k];
        return '<button class="d-pill" data-act="role" data-role="' + k + '">' + icon(r.ico) + '<span><b>' + r.label + '</b><span>' + r.line + '</span></span></button>';
      }).join('') + (S.jobs.length || S.invite ? '<button class="d-link" data-act="reset">Start over with a fresh demo</button>' : '') + '</div>';
  }

  function inboxView() {
    var mine = S.inbox.filter(function (m) { return m.to === V.role; });
    mine.forEach(function (m) { m.seen = true; });
    return '<div class="d-pad"><button class="d-back" data-act="go" data-view="home">← Back</button><h1 class="d-h1">Messages from NOHM</h1>' +
      (mine.length ? '<ul class="d-list">' + mine.map(function (m) {
        return '<li><b>' + esc(m.title) + '</b><p class="d-muted" style="margin:4px 0 0">' + esc(m.body) + '</p><span class="d-small">' + timeOfDay(m.at) + '</span></li>';
      }).join('') + '</ul>' : '<p class="d-sub">Nothing yet.</p>') + '</div>';
  }

  function chatView(j) {
    var me = V.role === 'pro' ? 'pro' : 'booker';
    var other = V.role === 'pro' ? (j.booker === 'pm' ? 'the property manager' : 'the homeowner') : proOf(j).name.split(' ')[0];
    return '<div class="d-pad"><button class="d-back" data-act="go" data-view="job">← Back to the job</button><h1 class="d-h1">Message ' + esc(other) + '</h1>' +
      '<div class="d-msgs">' + (j.msgs.length ? j.msgs.map(function (m) {
        return '<div class="d-msg ' + (m.from === me ? 'me' : '') + '">' + esc(m.text) + '</div>';
      }).join('') : '<p class="d-small">Messages stay inside NOHM. Your phone number stays private.</p>') + '</div>' +
      '<form data-form="chat" data-id="' + j.id + '"><label class="d-field"><span>Message</span><input id="d-msg" maxlength="300" placeholder="' +
      (V.role === 'pro' ? 'On my way, about 20 minutes out.' : 'Gate code is 1234. Dog is friendly.') + '" /></label>' +
      '<button class="d-btn" type="submit">Send</button></form></div>';
  }

  // Homeowner
  function hoHome() {
    var mine = activeFor('homeowner'), h = '<div class="d-pad">';
    h += '<h1 class="d-h1">Hi, Avery.</h1><p class="d-sub">What do you need help with?</p>';
    var open = mine.filter(function (j) { return j.status !== 'CONFIRMED' || !j.rating; }).filter(function (j) { return j.status !== 'RELEASED' || !j.seenReleased; });
    open.forEach(function (j) {
      h += '<button class="d-choice" data-act="open" data-id="' + j.id + '"><div class="d-row"><b>' + esc(trade(j.trade).name) + '</b><span class="d-small">#' + j.number + '</span></div>' +
        '<p class="d-muted" style="margin:4px 0 0">' + (j.pause ? 'Paused — update your card' : esc(statusLine(j))) + '</p></button>';
    });
    h += '<div class="d-grid">' + TRADES.map(function (t) {
      return '<button class="d-tile" data-act="trade" data-trade="' + t.id + '">' + icon(t.id) + t.name + '</button>';
    }).join('') + '</div>';
    h += '<h2 class="d-h2">Your home</h2><div class="d-card"><h3>' + HOME.address + '</h3><p class="d-muted">' + HOME.hin + '</p>' +
      '<p class="d-small" style="margin-top:6px">Your home’s permanent ID. Its record stays with the house.</p></div>';
    h += '<h2 class="d-h2">Home record</h2>' + (S.records.filter(function (r) { return r.place === HOME.address; }).length ?
      '<ul class="d-list">' + S.records.filter(function (r) { return r.place === HOME.address; }).map(function (r) {
        return '<li><div class="d-row"><b>' + esc(r.trade) + '</b><span class="d-price">' + money(r.total) + '</span></div><p class="d-muted" style="margin:2px 0 0">' + esc(r.fixed) + '</p><span class="d-small">' + esc(r.pro) + '</span></li>';
      }).join('') + '</ul>' : '<p class="d-small">Every repair lands here, with who did it and what it cost.</p>');
    h += '<h2 class="d-h2">Payment</h2><div class="d-card"><div class="d-row"><b>Visa ending 4242</b></div>' +
      '<p class="d-small" style="margin:4px 0 10px">Demo: make the card decline to see what happens.</p>' +
      '<div class="d-switch"><button class="' + (S.card === 'ok' ? 'on' : '') + '" data-act="card" data-v="ok">Card works</button>' +
      '<button class="' + (S.card === 'declined' ? 'on' : '') + '" data-act="card" data-v="declined">Card declines</button></div></div>';
    return h + '</div>';
  }

  function hoRequest() {
    var d = S.draft, t = trade(d.trade), h = '<div class="d-pad">';
    h += '<button class="d-back" data-act="go" data-view="home">← Back</button>';
    h += '<h1 class="d-h1">' + t.name + '</h1><p class="d-sub">Tell your pro what’s wrong. A few words is enough.</p>';
    h += '<label class="d-field"><span>What’s going on?</span><textarea id="d-issue" maxlength="300">' + esc(d.issue) + '</textarea></label>';
    h += '<h2 class="d-h2">How soon?</h2>';
    [['STANDARD', 'Standard', 'A pro in a day or two. No NOHM fee.'],
      ['EXPRESS', 'Express · ' + money(fee('express')), 'Same day. Goes straight to the closest pro.'],
      ['NOW', 'NOHM NOW · ' + money(fee('now')), 'A pro who’s ready right now, there within 60 minutes of accepting.']
    ].forEach(function (o) {
      h += '<button class="d-choice ' + (d.tier === o[0] ? 'on' : '') + '" data-act="tier" data-v="' + o[0] + '"><b>' + o[1] + '</b><p class="d-muted" style="margin:2px 0 0">' + o[2] + '</p></button>';
    });
    if (d.tier === 'STANDARD') {
      h += '<h2 class="d-h2">Tomorrow</h2><div class="d-chips">' + ['Morning (8–11 AM)', 'Midday (11 AM–2 PM)', 'Afternoon (2–5 PM)'].map(function (w) {
        return '<button class="d-chip ' + (d.window === w ? 'on' : '') + '" data-act="window" data-v="' + w + '">' + w + '</button>';
      }).join('') + '</div>';
    }
    h += '<button class="d-btn" data-act="submit">' + (d.tier === 'STANDARD' ? 'See matched pros' : d.tier === 'EXPRESS' ? 'Request Express' : 'See who’s ready now') + '</button>';
    return h + '</div>';
  }

  function hoPick(j) {
    var h = '<div class="d-pad"><button class="d-back" data-act="cancel" data-id="' + j.id + '">← Cancel request</button>';
    h += '<h1 class="d-h1">' + (j.tier === 'NOW' ? 'Ready now' : 'Pick your pro') + '</h1>';
    h += '<p class="d-sub">' + (j.tier === 'NOW' ? 'These pros are live and ready to leave.' : 'Pros who do ' + trade(j.trade).name.toLowerCase() + ' and are open tomorrow.') + '</p>';
    PROS.forEach(function (p, i) {
      h += '<button class="d-choice" data-act="pick" data-id="' + j.id + '" data-n="' + i + '"><div class="d-row"><b>' + esc(p.biz) + '</b><span>★ ' + p.rating + '</span></div>' +
        '<p class="d-muted" style="margin:2px 0 0">' + esc(p.name) + ' · ' + p.jobs + ' jobs on NOHM' + (j.tier === 'NOW' ? ' · live now' : '') + '</p></button>';
    });
    return h + '</div>';
  }

  // Pro
  function proHome() {
    var p = PROS[S.pro], h = '<div class="d-pad">';
    h += '<h1 class="d-h1">Hi, ' + esc(p.name.split(' ')[0]) + '.</h1><p class="d-sub">' + esc(p.biz) + ' · Approved</p>';
    h += '<div class="d-card"><div class="d-row"><div><h3>' + (S.proOnShift ? 'On shift' : 'Off shift') + '</h3><p class="d-muted">' +
      (S.proOnShift ? 'You’re getting job offers.' : 'Go on shift to get offers.') + '</p></div></div>' +
      '<button class="d-btn ' + (S.proOnShift ? 'sec' : '') + '" data-act="shift">' + (S.proOnShift ? 'Go off shift' : 'Go on shift') + '</button>' +
      '<button class="d-link" data-act="live">' + (S.proLive ? 'Ready Now: you’re live' : 'Ready Now: go live for four hours') + '</button></div>';
    var offers = S.jobs.filter(function (j) { return j.status === 'OFFERED' && (S.proOnShift || j.tier === 'NOW'); });
    h += '<h2 class="d-h2">Offers</h2>';
    if (!offers.length) h += '<p class="d-small">' + (S.proOnShift ? (KIOSK ? 'No offers right now. Book something on the homeowner\u2019s screen.' : 'No offers right now. Switch to the homeowner and book something.') : 'Go on shift to see offers.') + '</p>';
    offers.forEach(function (j) {
      h += '<div class="d-card blue"><div class="d-row"><h3>' + esc(trade(j.trade).name) + (j.tier !== 'STANDARD' ? ' · ' + (j.tier === 'NOW' ? 'NOHM NOW' : 'Express') : '') + '</h3>' +
        (j.tier === 'EXPRESS' ? '<span class="d-timer" data-offer="' + j.offerEnds + '" style="font-size:20px">' + clock(j.offerEnds - now()) + '</span>' : '') + '</div>' +
        '<p>' + esc(j.issue) + '</p><p class="d-small" style="margin-top:4px">' + esc(j.place) + (j.tier === 'STANDARD' ? ' · tomorrow, ' + j.window : ' · today') + '</p>' +
        '<button class="d-btn" data-act="accept" data-id="' + j.id + '">' + (j.tier === 'NOW' ? 'Accept and leave now' : 'Accept') + '</button>' +
        '<button class="d-link" data-act="pass" data-id="' + j.id + '">Pass</button></div>';
    });
    var mine = S.jobs.filter(function (j) { return ['OFFERED', 'MATCHING', 'CANCELLED'].indexOf(j.status) < 0 && !(j.status === 'CONFIRMED' && j.seenPaid); });
    h += '<h2 class="d-h2">Your jobs</h2>';
    if (!mine.length) h += '<p class="d-small">Jobs you accept show up here.</p>';
    mine.forEach(function (j) {
      h += '<button class="d-choice" data-act="open" data-id="' + j.id + '"><div class="d-row"><b>' + esc(trade(j.trade).name) + '</b><span class="d-small">#' + j.number + '</span></div>' +
        '<p class="d-muted" style="margin:4px 0 0">' + (j.pause ? 'Paused — waiting on the card' : esc(statusLine(j, 'pro'))) + '</p></button>';
    });
    return h + '</div>';
  }

  function proJob(j) {
    var t = trade(j.trade), h = '<div class="d-pad">';
    h += '<button class="d-back" data-act="go" data-view="home">← Back</button>';
    h += '<h1 class="d-h1">' + esc(t.name) + '</h1><p class="d-sub">#' + j.number + ' · ' + esc(j.place) + (j.booker === 'pm' ? ' · booked by the property manager' : '') + '</p>';
    h += pauseCard(j, 'pro');
    h += '<div class="d-card"><p class="d-small">From the ' + (j.booker === 'pm' ? 'tenant' : 'homeowner') + '</p><p>' + esc(j.issue) + '</p></div>';
    h += '<div class="d-card"><h3>' + esc(j.pause ? 'Paused — waiting on the card' : statusLine(j, 'pro')) + '</h3>';
    if (j.tier === 'NOW' && j.arriveBy && STEP_OF[j.status] < 3) h += '<p>Be there by <b>' + timeOfDay(j.arriveBy) + '</b>.</p>';
    h += '</div>';
    if (j.status === 'OFFERED') {
      h += '<button class="d-btn" data-act="accept" data-id="' + j.id + '">' + (j.tier === 'NOW' ? 'Accept and leave now' : 'Accept') + '</button>' +
        '<button class="d-link" data-act="pass" data-id="' + j.id + '">Pass</button>';
    }
    if (!j.pause) {
      if (j.status === 'SCHEDULED' && !j.unlocked) {
        h += '<button class="d-btn" disabled>On my way</button><p class="d-small" style="margin-top:6px">You can set off an hour before the window.</p>' +
          '<button class="d-link" data-act="unlock" data-id="' + j.id + '">Demo: skip to the appointment</button>';
      }
      if ((j.status === 'SCHEDULED' && j.unlocked) || j.status === 'ACCEPTED') h += '<button class="d-btn" data-act="pro" data-step="enroute" data-id="' + j.id + '">On my way</button>';
      if (j.status === 'EN_ROUTE') h += '<button class="d-btn" data-act="pro" data-step="arrive" data-id="' + j.id + '">I’ve arrived</button>';
      if (j.status === 'ARRIVED') h += '<button class="d-btn" data-act="go" data-view="pin">Enter the homeowner’s code</button>';
      if (j.status === 'VERIFIED') h += '<button class="d-btn" data-act="go" data-view="findings">Send findings and price</button>';
      if (j.status === 'APPROVED') h += '<button class="d-btn" data-act="pro" data-step="start" data-id="' + j.id + '">Start work</button>';
      if (j.status === 'WORKING') h += '<button class="d-btn" data-act="pro" data-step="complete" data-id="' + j.id + '">Mark it done</button>';
    }
    if (j.diag) h += '<div class="d-card" style="margin-top:12px"><p class="d-small">Your findings</p><h3>' + esc(j.diag[0]) + '</h3>' + (j.total ? estimateTable(j) : '') + '</div>';
    if (['SCHEDULED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'VERIFIED', 'ESTIMATED', 'APPROVED', 'WORKING'].indexOf(j.status) >= 0) {
      h += '<button class="d-btn sec" data-act="chat" data-id="' + j.id + '">Message ' + (j.booker === 'pm' ? 'the property manager' : 'the homeowner') + (j.msgs.length ? ' (' + j.msgs.length + ')' : '') + '</button>';
    }
    var mv = nextMove(j);
    if (mv && mv.who !== 'pro' && KIOSK) {
      h += '<div class="d-card" style="margin-top:16px"><p class="d-small">It\u2019s the homeowner\u2019s move: tap it on their screen, on the left.</p>' +
        '<button class="d-link" data-act="ff" data-id="' + j.id + '">Or fast-forward: ' + esc(mv.label.toLowerCase()) + '</button></div>';
    } else if (mv && mv.who !== 'pro') {
      h += '<div class="d-card" style="margin-top:16px"><p class="d-small">Demo: it’s the ' + (mv.who === 'pm' ? 'property manager' : 'homeowner') + '’s move.</p>' +
        '<button class="d-btn sec" data-act="role" data-role="' + mv.who + '">Play their part</button>' +
        '<button class="d-link" data-act="ff" data-id="' + j.id + '">Fast-forward: ' + esc(mv.label.toLowerCase()) + '</button></div>';
    }
    if (j.status === 'CONFIRMED' || j.status === 'RELEASED') {
      if (j.status === 'CONFIRMED') j.seenPaid = true;
      h += '<button class="d-btn" data-act="go" data-view="home">Back to offers</button>';
    }
    return h + '</div>';
  }

  function pinView(j) {
    var dots = [0, 1, 2, 3].map(function (i) { return '<span>' + (V.pinEntry[i] ? '•' : '') + '</span>'; }).join('');
    return '<div class="d-pad"><button class="d-back" data-act="go" data-view="job">← Back</button><h1 class="d-h1">Homeowner’s code</h1>' +
      '<p class="d-sub">Ask for the 4-digit code on their screen. It proves you’re the pro they booked.</p>' +
      (V.err ? '<p class="d-error">' + esc(V.err) + '</p>' : '') +
      '<div class="d-pin">' + dots + '</div><div class="d-keys">' +
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(function (k) {
        return k === '' ? '<span></span>' : '<button class="d-key" data-act="key" data-k="' + k + '" aria-label="' + (k === '⌫' ? 'Delete' : k) + '">' + k + '</button>';
      }).join('') + '</div><p class="d-small" style="text-align:center;margin-top:12px">Demo: the code is ' + j.pin + '.</p></div>';
  }

  function findingsView(j) {
    var t = trade(j.trade);
    return '<div class="d-pad"><button class="d-back" data-act="go" data-view="job">← Back</button><h1 class="d-h1">Findings and price</h1>' +
      '<p class="d-sub">What you found, then your price. Nothing extra is added on top.</p>' +
      '<label class="d-field"><span>What’s wrong</span><input id="d-diag-t" value="' + esc(t.diag[0]) + '" /></label>' +
      '<label class="d-field"><span>In plain words</span><textarea id="d-diag-b">' + esc(t.diag[1]) + '</textarea></label>' +
      j.lines.map(function (l, i) {
        return '<div class="d-row"><label class="d-field" style="flex:1"><span>Line ' + (i + 1) + '</span><input id="d-l' + i + '" value="' + esc(l[0]) + '" /></label>' +
          '<label class="d-field" style="width:96px"><span>$</span><input id="d-a' + i + '" inputmode="decimal" value="' + l[1] + '" /></label></div>';
      }).join('') +
      '<button class="d-btn" data-act="send-estimate" data-id="' + j.id + '">Send to the ' + (j.booker === 'pm' ? 'property manager' : 'homeowner') + '</button></div>';
  }

  // Property manager
  function pmHome() {
    var h = '<div class="d-pad"><h1 class="d-h1">' + BUILDING.name + '</h1><p class="d-sub">4 units · one HIN for each</p>';
    h += '<div class="d-card"><ul class="d-list">' + BUILDING.units.map(function (u) {
      var who = u === '1A' ? (S.tenantIn ? TENANT.name + ' · ' + money(TENANT.rent) + ' due the 1st' : S.invite ? 'Invite sent · code ' + S.invite.code : 'Vacant') : 'Vacant';
      return '<li><div class="d-row"><b>Unit ' + u + '</b><span class="d-muted">' + esc(who) + '</span></div>' +
        (u === '1A' && !S.invite && !S.tenantIn ? '<button class="d-btn sec" data-act="go" data-view="invite">Invite a tenant</button>' : '') + '</li>';
    }).join('') + '</ul></div>';
    var reqs = S.requests.filter(function (r) { return r.status === 'SENT'; });
    h += '<h2 class="d-h2">Repair requests</h2>';
    if (!reqs.length) h += '<p class="d-small">' + (S.tenantIn ? 'Nothing waiting. Switch to the tenant to send one.' : 'Tenants send repair requests here.') + '</p>';
    reqs.forEach(function (r) {
      h += '<div class="d-card blue"><h3>' + esc(r.title) + '</h3><p>' + esc(r.body) + '</p><p class="d-small" style="margin-top:4px">Unit 1A · ' + esc(trade(r.trade).name) + '</p>' +
        '<button class="d-btn" data-act="approve-req" data-n="' + r.n + '">Approve and send to a pro</button><button class="d-link" data-act="decline-req" data-n="' + r.n + '">Decline</button></div>';
    });
    var jobs = activeFor('pm');
    if (jobs.length) {
      h += '<h2 class="d-h2">Unit jobs</h2>';
      jobs.forEach(function (j) {
        h += '<button class="d-choice" data-act="open" data-id="' + j.id + '"><div class="d-row"><b>' + esc(trade(j.trade).name) + ' · 1A</b><span class="d-small">#' + j.number + '</span></div>' +
          '<p class="d-muted" style="margin:4px 0 0">' + esc(statusLine(j)) + '</p></button>';
      });
    }
    return h + '</div>';
  }

  function inviteView() {
    return '<div class="d-pad"><button class="d-back" data-act="go" data-view="home">← Back</button><h1 class="d-h1">Invite a tenant</h1>' +
      '<p class="d-sub">Unit 1A. We text them a code to join.</p>' +
      '<label class="d-field"><span>Name</span><input value="' + TENANT.name + '" readonly /></label>' +
      '<label class="d-field"><span>Mobile</span><input value="' + TENANT.phone + '" readonly /></label>' +
      '<div class="d-row"><label class="d-field" style="flex:1"><span>Rent</span><input value="' + money(TENANT.rent) + '" readonly /></label>' +
      '<label class="d-field" style="flex:1"><span>Due on</span><input value="The 1st" readonly /></label></div>' +
      '<button class="d-btn" data-act="send-invite">Send invite</button></div>';
  }

  // Tenant
  function tnHome() {
    var h = '<div class="d-pad">';
    if (!S.tenantIn) {
      h += '<h1 class="d-h1">Welcome, Taylor.</h1>';
      if (!S.invite) {
        return h + '<p class="d-sub">Your landlord invites you by text. Once you join, you can send repair requests right from here.</p>' +
          '<div class="d-card"><p class="d-small">Demo: no invite yet.</p><button class="d-btn sec" data-act="role" data-role="pm">Play the landlord to send one</button></div></div>';
      }
      return h + '<p class="d-sub">' + BUILDING.name + ' invited you to unit 1A.</p>' +
        '<div class="d-card"><h3>' + BUILDING.name + ' · 1A</h3><p>' + money(TENANT.rent) + ' a month, due the 1st.</p></div>' +
        (V.err ? '<p class="d-error">' + esc(V.err) + '</p>' : '') +
        '<form data-form="join"><label class="d-field"><span>Code from the text</span><input id="d-code" inputmode="numeric" maxlength="6" placeholder="6 digits" /></label>' +
        '<button class="d-btn" type="submit">Join</button></form><p class="d-small" style="margin-top:8px">Demo: the code is ' + S.invite.code + '.</p></div>';
    }
    h += '<h1 class="d-h1">' + BUILDING.name + ' · 1A</h1><p class="d-sub">' + money(TENANT.rent) + ' due the 1st</p>';
    h += '<button class="d-btn" data-act="go" data-view="tn-request">Request a repair</button>';
    h += '<h2 class="d-h2">Your requests</h2>';
    if (!S.requests.length) h += '<p class="d-small">Requests go to your landlord. You’ll see each step here.</p>';
    else h += '<ul class="d-list">' + S.requests.map(function (r) {
      var j = r.job && job(r.job);
      var st = r.status === 'SENT' ? 'Sent to your landlord' : r.status === 'DECLINED' ? 'Your landlord declined this one' :
        j ? (j.status === 'OFFERED' ? 'Approved. Finding a pro.' : j.status === 'CONFIRMED' ? 'Fixed.' : 'Approved. ' + statusLine(j)) : 'Approved';
      return '<li><b>' + esc(r.title) + '</b><p class="d-muted" style="margin:2px 0 0">' + esc(st) + '</p></li>';
    }).join('') + '</ul>';
    return h + '</div>';
  }

  function tnRequest() {
    var cats = ['plumbing', 'hvac', 'electrical', 'appliance'];
    var d = S.draft && S.draft.tenant ? S.draft : (S.draft = { tenant: true, trade: 'plumbing' });
    return '<div class="d-pad"><button class="d-back" data-act="go" data-view="home">← Back</button><h1 class="d-h1">Request a repair</h1>' +
      '<p class="d-sub">It goes to your landlord, who sends a pro.</p><div class="d-chips">' + cats.map(function (c) {
        return '<button class="d-chip ' + (d.trade === c ? 'on' : '') + '" data-act="tn-cat" data-v="' + c + '">' + trade(c).name + '</button>';
      }).join('') + '</div>' +
      '<label class="d-field"><span>Title</span><input id="d-rt" maxlength="80" value="Bathroom sink drains slowly" /></label>' +
      '<label class="d-field"><span>Details</span><textarea id="d-rb" maxlength="300">The bathroom sink takes a few minutes to drain.</textarea></label>' +
      '<button class="d-btn" data-act="send-request">Send to my landlord</button></div>';
  }

  // ── Guide ("What's happening") ────────────────────────────────────
  function guide() {
    var j = V.focus && job(V.focus);
    if (!V.signedIn) return ['Sign in to start.', 'Use the demo login. It works for every role, and nothing here reaches a real pro or a real card.'];
    if (!V.role) return ['Pick who you want to be.', 'You can switch roles any time and keep the same job going, so you can see both sides of it.'];
    if (j && j.pause) return ['The job is paused.', 'A card didn’t go through. The homeowner has ' + PAUSE_MINUTES + ' minutes to update it, and both sides see the same clock. Fix the card and the job picks right back up; if time runs out, the pro is released and free to take another job.'];
    if (V.role === 'homeowner') {
      if (!j || V.view === 'home') return S.card === 'declined'
        ? ['Your card is set to decline.', 'Book an Express job, or approve an estimate, to see how NOHM pauses the job and gives you time to fix the card.']
        : ['Book a repair.', 'Tap a service. Standard gets you a pro in a day or two with no NOHM fee; Express is same day; NOHM NOW sends a pro who’s ready right now.'];
      return guideForJob(j);
    }
    if (V.role === 'pro') {
      if (!j || V.view === 'home') return S.proOnShift ? ['You’re on shift.', (KIOSK ? 'Offers show up here when the homeowner, on the left, books a repair.' : 'Offers show up here when a homeowner books your trade. Switch to the homeowner and book one, then come back.')] : ['You’re an approved pro.', 'Go on shift to start getting offers. Ready Now puts you live for four hours for NOHM NOW jobs.'];
      return guideForJob(j);
    }
    if (V.role === 'pm') return j && V.view === 'job' ? guideForJob(j) : S.tenantIn ? ['Your tenant is in.', 'When they send a repair request, approve it here and it goes to a pro. You approve the estimate and confirm the work.'] : ['Your building.', 'Invite a tenant to unit 1A. They get a code by text and join from the app.'];
    return S.tenantIn ? ['You’re in.', 'Send a repair request. Your landlord approves it and a pro takes it from there. You see every step.'] : ['Join your rental.', 'Your landlord invites you by text. Once you join, repair requests go straight to them.'];
  }
  function guideForJob(j) {
    var g = {
      MATCHING: ['Pick your pro.', 'With Standard you choose from pros in your trade who are open, with their ratings and how many jobs they’ve done on NOHM.'],
      OFFERED: j.tier === 'EXPRESS' ? ['Express goes to the closest pro.', 'They have ' + EXPRESS_SECONDS + ' seconds to take it before it moves to the next one. The Express fee is held when a pro accepts.'] : ['Waiting on the pro.', (KIOSK ? 'Your pro gets the offer on their screen and accepts it.' : 'Your pro gets the offer and accepts it. Switch to Service Pro to accept it yourself, or fast-forward.')],
      SCHEDULED: ['Booked.', 'The pro can set off an hour before your window. Until then you can message each other inside NOHM.'],
      ACCEPTED: ['Accepted.', 'Your pro is getting ready to head your way.'],
      EN_ROUTE: ['On the way.', 'You get a 4-digit code. The pro enters it at your door, which proves the right person is at your home.'],
      ARRIVED: ['At the door.', 'The pro enters your code, then checks the problem.'],
      VERIFIED: ['Checking the problem.', 'The pro sends what they found first, then a price. Nothing is added on top of their price.'],
      ESTIMATED: ['Your estimate.', 'Approving places a hold on the card. The charge only happens when you confirm the work is done.'],
      APPROVED: ['Approved.', 'The pro can start the work now.'],
      WORKING: ['Working.', 'The pro marks it done when they finish.'],
      COMPLETED: ['Is it fixed?', 'Confirm it and the card is charged. The repair is saved to the home’s permanent record.'],
      CONFIRMED: ['Done.', 'Saved to the home’s record under its HIN: what was fixed, by whom, and what it cost. It stays with the house.'],
      RELEASED: ['The pro was released.', 'The card wasn’t updated in time, so the job closed, any holds were released, and the pro is free for their next job. Book again any time.']
    };
    return g[j.status] || ['', ''];
  }

  // ── Render ────────────────────────────────────────────────────────
  var lastView = null;
  function render() {
    var scroller = root.querySelector('.d-screen');
    var keep = scroller && lastView === V.view + V.role + V.focus ? scroller.scrollTop : 0;
    var body;
    var j = V.focus && job(V.focus);
    if (!V.signedIn) body = signinView();
    else if (!V.role) body = rolesView();
    else if (V.view === 'inbox') body = inboxView();
    else if (V.view === 'chat' && j) body = chatView(j);
    else if (V.role === 'homeowner') {
      if (V.view === 'request' && S.draft) body = hoRequest();
      else if (V.view === 'job' && j) body = j.status === 'MATCHING' ? hoPick(j) : '<div class="d-pad">' + bookerJob(j) + '</div>';
      else body = hoHome();
    } else if (V.role === 'pro') {
      if (V.view === 'pin' && j) body = pinView(j);
      else if (V.view === 'findings' && j) body = findingsView(j);
      else if (V.view === 'job' && j) body = proJob(j);
      else body = proHome();
    } else if (V.role === 'pm') {
      if (V.view === 'invite') body = inviteView();
      else if (V.view === 'job' && j) body = '<div class="d-pad">' + bookerJob(j) + '</div>';
      else body = pmHome();
    } else {
      body = V.view === 'tn-request' ? tnRequest() : tnHome();
    }

    var top = '<div class="d-top"><span class="d-tag">Demo</span><span class="d-who">' +
      (V.role ? '<b>' + ROLES[V.role].label + '</b>' : V.signedIn ? 'Signed in' : 'Sample data only') + '</span>' +
      (V.role ? '<button class="d-mini" data-act="go" data-view="inbox">Inbox' + (unread(V.role) ? ' (' + unread(V.role) + ')' : '') + '</button>' +
        (KIOSK ? '' : '<button class="d-mini" data-act="switch">Switch</button>') : '') + '</div>';
    var g = guide();
    root.innerHTML = top + '<div class="d-screen">' + body + '</div>' +
      '<div class="d-hint"><span><b>' + esc(g[0]) + '</b> ' + esc(g[1]) + '</span></div>';
    if (opts.guide) {
      var gt = document.getElementById('guide-title'), gb = document.getElementById('guide-body');
      if (gt) gt.textContent = g[0];
      if (gb) gb.textContent = g[1];
    }
    var sc = root.querySelector('.d-screen');
    if (sc) sc.scrollTop = keep;
    lastView = V.view + V.role + V.focus;
  }

  // ── Actions ───────────────────────────────────────────────────────
  function val(id) { var el = root.querySelector('#' + id); return el ? el.value.trim() : ''; }
  function go(view, focus) { V.view = view; if (focus !== undefined) V.focus = focus; V.err = null; }

  var ACTIONS = {
    fill: function () {
      document.getElementById('d-email').value = EMAIL;
      document.getElementById('d-pass').value = PASSWORD;
      return false;
    },
    role: function (el) {
      V.role = el.dataset.role; V.err = null; V.pinEntry = '';
      // Stay on the same job when the new role is part of it.
      var j = V.view === 'job' && V.focus && job(V.focus);
      if (!(j && (V.role === 'pro' || j.booker === V.role))) go('home');
    },
    switch: function () { V.role = null; go('home'); },
    reset: function () { resetAll(); return false; },
    go: function (el) { go(el.dataset.view); },
    open: function (el) { go('job', el.dataset.id); var j = job(el.dataset.id); if (j && j.status === 'RELEASED') j.seenReleased = true; },
    chat: function (el) { go('chat', el.dataset.id); },
    card: function (el) { S.card = el.dataset.v; },
    trade: function (el) { S.draft = { trade: el.dataset.trade, issue: trade(el.dataset.trade).issue, tier: 'STANDARD', window: 'Morning (8–11 AM)' }; go('request'); },
    tier: function (el) { S.draft.issue = val('d-issue') || S.draft.issue; S.draft.tier = el.dataset.v; },
    window: function (el) { S.draft.issue = val('d-issue') || S.draft.issue; S.draft.window = el.dataset.v; },
    submit: function () {
      var d = S.draft;
      if (d.tier === 'EXPRESS') {
        var j = newJob({ trade: d.trade, issue: val('d-issue'), tier: 'EXPRESS' });
        j.status = 'OFFERED'; j.pro = 0; j.offerEnds = now() + EXPRESS_SECONDS * 1000;
        S.proOnShift = true; S.pro = 0;
        notify('pro', 'Express offer', 'A ' + trade(j.trade).name.toLowerCase() + ' job nearby. You have ' + EXPRESS_SECONDS + ' seconds to take it.');
        go('job', j.id);
      } else if (d.tier === 'NOW' && S.card === 'declined') {
        V.err = null;
        notify('homeowner', 'We didn’t book that', 'Your card didn’t go through, so no pro was booked. Update your card and try again.');
        go('inbox');
      } else {
        var k = newJob({ trade: d.trade, issue: val('d-issue'), tier: d.tier, window: d.window });
        go('job', k.id);
      }
      S.draft = null;
    },
    cancel: function (el) { var j = job(el.dataset.id); if (j) j.status = 'CANCELLED'; go('home'); },
    pick: function (el) {
      var j = job(el.dataset.id);
      j.pro = Number(el.dataset.n); S.pro = j.pro; j.status = 'OFFERED';
      if (j.tier === 'NOW') { S.proLive = true; notify('pro', 'NOHM NOW: leave now', 'A homeowner booked you. Accept and head out; you have 60 minutes.'); }
      else { S.proOnShift = true; notify('pro', 'New job offer', 'A ' + trade(j.trade).name.toLowerCase() + ' job for tomorrow, ' + j.window + '.'); }
    },
    shift: function () { S.proOnShift = !S.proOnShift; },
    live: function () { S.proLive = !S.proLive; },
    accept: function (el) { var j = job(el.dataset.id); S.pro = j.pro; proAccept(j); go('job', j.id); },
    pass: function (el) {
      var j = job(el.dataset.id);
      j.pro = (j.pro + 1) % PROS.length;
      if (j.tier === 'EXPRESS') j.offerEnds = now() + EXPRESS_SECONDS * 1000;
      notify(j.booker, 'Sent to the next pro', 'Your first pro couldn’t take it, so it went to ' + proOf(j).biz + '.');
      S.pro = j.pro;
    },
    unlock: function (el) { job(el.dataset.id).unlocked = true; },
    pro: function (el) {
      var j = job(el.dataset.id);
      ({ enroute: proEnRoute, arrive: proArrive, start: proStart, complete: proComplete })[el.dataset.step](j);
    },
    key: function (el) {
      var j = job(V.focus), k = el.dataset.k;
      V.err = null;
      if (k === '⌫') V.pinEntry = V.pinEntry.slice(0, -1);
      else if (V.pinEntry.length < 4) V.pinEntry += k;
      if (V.pinEntry.length === 4) {
        if (V.pinEntry === j.pin) { V.pinEntry = ''; proVerify(j); go('job'); }
        else { V.pinEntry = ''; V.err = 'That’s not the code. Ask the homeowner to check their screen.'; }
      }
    },
    'send-estimate': function (el) {
      var j = job(el.dataset.id);
      j.lines = j.lines.map(function (l, i) { return [val('d-l' + i) || l[0], Math.max(0, Number(val('d-a' + i)) || 0)]; });
      proEstimate(j);
      j.diag = [val('d-diag-t') || j.diag[0], val('d-diag-b') || j.diag[1]];
      go('job');
    },
    approve: function (el) { var j = job(el.dataset.id); bookerApprove(j); },
    confirm: function (el) { bookerConfirm(job(el.dataset.id)); },
    rate: function (el) { job(el.dataset.id).rating = Number(el.dataset.n); },
    fixcard: function (el) {
      var j = job(el.dataset.id);
      S.card = 'ok';
      if (j.pause.kind === 'ESTIMATE') { j.pause = null; bookerApprove(j); notify(j.booker, 'You’re all set', 'Your card went through, and your job is back on.'); }
      else resume(j);
    },
    skip30: function (el) { var j = job(el.dataset.id); if (j.pause) release(j); },
    ff: function (el) { var j = job(el.dataset.id), mv = nextMove(j); if (mv) mv.go(); },
    'send-invite': function () {
      S.invite = { code: String(100000 + Math.floor(Math.random() * 900000)) };
      notify('tenant', 'You’re invited to ' + BUILDING.name, 'Your landlord invited you to unit 1A. Your code is ' + S.invite.code + '.');
      go('home');
    },
    'tn-cat': function (el) { S.draft.trade = el.dataset.v; },
    'send-request': function () {
      S.requests.unshift({ n: now(), trade: S.draft.trade, title: val('d-rt') || 'Repair request', body: val('d-rb'), status: 'SENT' });
      notify('pm', 'New repair request', 'Unit 1A: ' + (val('d-rt') || 'Repair request'));
      S.draft = null;
      go('home');
    },
    'approve-req': function (el) {
      var r = S.requests.filter(function (x) { return String(x.n) === el.dataset.n; })[0];
      r.status = 'APPROVED';
      var j = newJob({ trade: r.trade, issue: r.title + '. ' + r.body, booker: 'pm', place: BUILDING.name + ' · 1A' });
      j.status = 'OFFERED'; r.job = j.id; S.proOnShift = true; S.pro = 0;
      notify('tenant', 'Approved', 'Your landlord approved “' + r.title + '”. A pro is on it.');
      notify('pro', 'New job offer', 'A ' + trade(j.trade).name.toLowerCase() + ' job at ' + BUILDING.name + ', booked by the property manager.');
    },
    'decline-req': function (el) {
      var r = S.requests.filter(function (x) { return String(x.n) === el.dataset.n; })[0];
      r.status = 'DECLINED';
      notify('tenant', 'Request declined', 'Your landlord declined “' + r.title + '”. Reach out to them with questions.');
    }
  };

  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    var fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    if (fn(el) !== false) renderAll();
  });

  root.addEventListener('submit', function (e) {
    var f = e.target, kind = f.dataset.form;
    e.preventDefault();
    if (kind === 'signin') {
      if (val('d-email').toLowerCase() === EMAIL && val('d-pass') === PASSWORD) { V.signedIn = true; V.role = null; go('home'); }
      else V.err = 'Use the demo login: ' + EMAIL + ' and password.';
    } else if (kind === 'chat') {
      var t = val('d-msg');
      if (t) {
        var j = job(f.dataset.id);
        j.msgs.push({ from: V.role === 'pro' ? 'pro' : 'booker', text: t });
        notify(V.role === 'pro' ? j.booker : 'pro', 'New message', t);
      }
    } else if (kind === 'join') {
      if (val('d-code') === S.invite.code) {
        S.tenantIn = true; V.err = null;
        notify('pm', 'Your tenant joined', TENANT.name + ' joined unit 1A.');
      } else V.err = 'That code doesn’t match. Check the text from your landlord.';
    }
    renderAll();
  });

    var app = { root: root, V: V, render: render, mode: MODE,
      act: function (name, data) { var fn = ACTIONS[name]; if (fn) { fn({ dataset: data || {} }); renderAll(); } } };
    apps.push(app);
    render();
    return app;
  }

  // Clocks: the pause countdown, and the Express offer timer.
  setInterval(function () {
    var changed = false;
    S.jobs.forEach(function (j) {
      if (j.pause && j.pause.ends <= now()) { release(j); changed = true; }
      if (j.status === 'OFFERED' && j.tier === 'EXPRESS' && j.offerEnds && j.offerEnds <= now()) {
        j.pro = (j.pro + 1) % PROS.length; j.offerEnds = now() + EXPRESS_SECONDS * 1000; S.pro = j.pro;
        notify(j.booker, 'Sent to the next pro', 'Your first pro didn’t answer in time, so it went to the next closest: ' + proOf(j).biz + '.');
        changed = true;
      }
    });
    if (changed) { renderAll(); return; }
    document.querySelectorAll('[data-ends]').forEach(function (el) { el.textContent = clock(Number(el.dataset.ends) - now()); });
    document.querySelectorAll('[data-offer]').forEach(function (el) { el.textContent = clock(Number(el.dataset.offer) - now()); });
  }, 1000);

  function resetAll() {
    S = fresh();
    if (apps.some(function (a) { return a.mode === 'kiosk'; })) S.proOnShift = true;
    apps.forEach(function (a) {
      var f = freshUI(a.mode === 'kiosk' ? a.V.role : null);
      if (a.mode !== 'kiosk') { f.signedIn = true; f.view = 'home'; }
      Object.keys(f).forEach(function (k) { a.V[k] = f[k]; });
    });
    renderAll();
  }

  window.NohmDemo = {
    apps: apps,
    reset: resetAll,
    world: function () { return S; },
    app: function (role) { for (var i = 0; i < apps.length; i++) if (apps[i].V.role === role) return apps[i]; return null; }
  };
  document.querySelectorAll('[data-nohm-demo]').forEach(function (el) {
    mount(el, { mode: el.getAttribute('data-nohm-demo'), role: el.getAttribute('data-role'), guide: el.hasAttribute('data-guide') });
  });
})();
