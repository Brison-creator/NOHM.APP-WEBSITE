// The security marks under NOHM's forms: what protects the visitor here,
// stated plainly and only what's true. One 24px stroke icon each (the
// site's icon style), ink on white. `human` shows only when the server
// turned the "I'm human" check on; `card` only where a card is entered.

import { h } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const PATHS = {
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6zM12 15v2',
  shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM9 12l2 2 4-4',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM4 4l16 16',
};

function icon(name) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'b-trust-ic');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', PATHS[name]);
  svg.appendChild(p);
  return svg;
}

function mark(name, title, line) {
  return h('li.b-trust-item', [icon(name), h('span', [h('b', title), h('span.b-trust-line', line)])]);
}

/** @param opts { webConfig, card } */
export function trustMarks({ webConfig, card = false }) {
  const human = mark('shield', 'Human-verified', 'Protected by Cloudflare Turnstile');
  human.hidden = true;
  if (webConfig) webConfig().then((cfg) => { if (cfg.turnstileSiteKey) human.hidden = false; }).catch(() => {});
  return h('ul.b-trust', { 'aria-label': 'How NOHM protects you' }, [
    mark('lock', 'Encrypted', 'Every page and request over HTTPS'),
    human,
    card ? mark('card', 'Payments by Stripe', 'PCI DSS Level 1. NOHM never sees your card number') : null,
    mark('eye', 'Never sold', 'NOHM doesn’t sell your personal information'),
  ]);
}
