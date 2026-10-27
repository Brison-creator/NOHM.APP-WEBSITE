// The landlord ad page's email form (nohm.app/go/landlords): the rules,
// without a browser. A name and a real email; the server (POST
// /waitlist/landlord) checks the same again, emails the landlord the app's
// links and tells NOHM.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Problems per field, in the words shown under it; {} when it can go. */
export function leadProblems(f) {
  const e = {};
  if (!(f.name || '').trim()) e.name = 'Your name';
  if (!EMAIL.test((f.email || '').trim())) e.email = 'A real email address';
  return e;
}

/** Where they came from, for the lead: the ad, Instagram, or the page itself. */
export function leadSource(search) {
  const q = new URLSearchParams(search || '');
  const src = (q.get('utm_source') || '').toLowerCase();
  if (src === 'instagram' || src === 'ig') return 'ig-landlords';
  if (src === 'facebook' || src === 'fb' || q.has('fbclid')) return 'fb-landlords';
  return 'lp-landlords';
}

/** POST /waitlist/landlord, less the human check's token and the traps. */
export function leadBody(f, source) {
  const t = (s) => (s || '').replace(/\s+/g, ' ').trim();
  return { name: t(f.name), email: t(f.email).toLowerCase(), source };
}

/** Said when the server says no. */
export function leadError(ex) {
  if (ex && ex.status === 429) return 'Too many tries from here. Wait a bit, or call or text 888-230-NOHM.';
  return (ex && ex.message) || 'That didn’t go through. Try again, or call or text 888-230-NOHM.';
}
