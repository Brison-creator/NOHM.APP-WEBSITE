// /join/landlord: after the account, the one way on. Rentals are added in
// the NOHM app (or at business.nohm.app on a computer), so this screen
// hands the new landlord to their phone's store, through /get so the tap
// is counted and an ad's tags reach Google Play.

import { h } from '../../nohm/dom.js';
import { prettyPhone } from '../../nohm/format.js';
import { landlordSource } from '../lib/landlord.js';

function badge(store, from) {
  const ios = store === 'ios';
  return h('li', [h(`a.store-badge.store-badge--${ios ? 'app-store' : 'google-play'}`, { href: `/get/?to=${store}&from=${from}`, 'aria-label': ios ? 'Download NOHM on the App Store' : 'Get NOHM on Google Play' }, [
    h('img', { src: ios ? '/img/badges/app-store.svg' : '/img/badges/google-play.png', width: ios ? 144 : 161, height: 48, alt: '' }),
  ])]);
}

export function doneScreen(a) {
  const u = a.state.user || {};
  const first = (u.firstName || '').trim();
  const android = /android/i.test(navigator.userAgent);
  const stores = android ? ['android', 'ios'] : ['ios', 'android'];
  return h('section.b-screen', [
    h('h1.b-h1', first ? `You’re in, ${first}.` : 'You’re in.'),
    h('p.b-sub', 'Your NOHM landlord account is ready.'),
    h('div.b-card.blue', [
      h('b', 'Next: add your rentals in the NOHM app.'),
      h('p', 'Sign in there with the same Google account or phone number. Then invite your tenants, turn on rent by bank, and let repairs come to you.'),
      h('div.store-cta', [h('ul.store-cta__badges', stores.map((s) => badge(s, 'join-landlord')))]),
    ]),
    h('p.b-small', ['On a computer? Sign in at ', h('a', { href: '/get/?to=business&from=join-landlord' }, 'business.nohm.app'), '.']),
    h('p.b-small', ['Signed in as ', h('b', u.email || prettyPhone(u.phone) || ''), ' · ', h('button.b-inline', { type: 'button', onClick: () => a.signOut() }, 'Sign out')]),
  ]);
}

/**
 * A new landlord account, counted in the site's access logs
 * (tools/ads/report.py): where they came from, never who.
 */
export function countSignup(search) {
  let tags = '';
  try { tags = sessionStorage.getItem('nohm:utm') || ''; } catch { /* no storage */ }
  fetch(`/join/landlord/?signup=done&src=${encodeURIComponent(landlordSource(search, tags))}`, { method: 'HEAD', cache: 'no-store' }).catch(() => {});
}
