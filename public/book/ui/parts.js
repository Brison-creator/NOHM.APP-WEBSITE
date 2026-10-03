// Pieces every /book screen shares: the heading, the Back/Continue
// footer, inline icons, and the fee-hold line.

import { h, button, money } from '../../nohm/dom.js';
import { lateAfternoonPremium } from '../lib/flow.js';

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

export function head(title, sub) {
  return h('header.b-head', [h('h1.b-h1', title), sub ? h('p.b-sub', sub) : null]);
}

export function footer(a, next, { label = 'Continue', disabled = false, back = true } = {}) {
  return h('div.b-foot', [back && a.canGoBack() ? button('Back', { kind: 'sec', onClick: () => a.back() }) : null, next ? button(label, { onClick: next, disabled, key: 'next' }) : null]);
}
