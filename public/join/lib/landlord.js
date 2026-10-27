// /join/landlord without a browser: where a new landlord came from, for
// the count (never who). The ad's tags are the address's own, or the ones
// /menu.js kept for the tab from the visit's first page.

/** 'fb-landlords', 'ig-landlords', 'card' (the handout's QR), or 'web'. */
export function landlordSource(search, tags) {
  const q = new URLSearchParams(search || '');
  new URLSearchParams(tags || '').forEach((v, k) => { if (!q.has(k)) q.set(k, v); });
  const src = (q.get('utm_source') || '').toLowerCase();
  if (src === 'instagram' || src === 'ig') return 'ig-landlords';
  if (src === 'facebook' || src === 'fb' || q.has('fbclid')) return 'fb-landlords';
  if ((q.get('from') || '').startsWith('card')) return 'card';
  return 'web';
}
