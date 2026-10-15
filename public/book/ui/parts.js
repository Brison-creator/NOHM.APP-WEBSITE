// Pieces every /book screen shares: the heading, the Back/Continue
// footer, inline icons, and the fee-hold line.

import { h, button, money } from '../../nohm/dom.js';
import { lateAfternoonPremium } from '../lib/flow.js';
import { scheduledDateIso, zoneShortName, browserTimeZone } from '../../nohm/format.js';

export const svg = (d) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  s.appendChild(p);
  return s;
};

// Express and NOHM NOW hold the fee when the request is sent; the server
// releases it if no pro can come. Said the same way on every screen.
export const HOLD = 'The fee is held on your card when you send the request, and released if no pro can come.';

/** "+$20" for Late Afternoon when the server publishes it, else nothing. */
export function premiumText(a) {
  const cents = lateAfternoonPremium(a.state.pricing);
  return cents ? `+${money(cents)}` : null;
}

/**
 * " CDT" after a window when the home keeps another clock than this
 * browser, so "11 AM" reads as the home's 11 AM; empty when they match
 * or the home's zone isn't known.
 */
export function homeClock(tz, dayIso) {
  if (!tz || tz === browserTimeZone()) return '';
  const at = scheduledDateIso(dayIso, tz);
  const name = zoneShortName(tz, at ? new Date(at) : new Date());
  return name ? ` ${name}` : '';
}

export function head(title, sub) {
  return h('header.b-head', [h('h1.b-h1', title), sub ? h('p.b-sub', sub) : null]);
}

export function footer(a, next, { label = 'Continue', disabled = false, back = true } = {}) {
  return h('div.b-foot', [back && a.canGoBack() ? button('Back', { kind: 'sec', onClick: () => a.back() }) : null, next ? button(label, { onClick: next, disabled, key: 'next' }) : null]);
}
