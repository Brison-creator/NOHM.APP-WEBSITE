// Small pure helpers the booking flow shares. No DOM, no network, so
// tools/book tests them in Node.

/** "$20" or "$20.50" from cents. */
export function money(cents) {
  const n = Math.round(Number(cents) || 0);
  const dollars = n / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/**
 * A US phone as the server wants it (E.164, "+15125550123"). Accepts
 * what people type: "(512) 555-0123", "512.555.0123", "+1 512 555 0123".
 * Returns null when it isn't a US number.
 */
export function toE164US(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return null;
}

/** "(512) 555-0123" for display; anything else comes back as typed. */
export function prettyPhone(e164) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164 || '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164 || '';
}

export function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
}

/** The arrival windows, earliest first, as the app shows them. */
export const WINDOWS = [
  { key: 'MORNING', name: 'Morning', range: '8–11 AM', startHour: 8 },
  { key: 'MIDDAY', name: 'Midday', range: '11 AM–2 PM', startHour: 11 },
  { key: 'AFTERNOON', name: 'Afternoon', range: '2–5 PM', startHour: 14 },
  { key: 'LATE_AFTERNOON', name: 'Late afternoon', range: '5–8 PM', startHour: 17, premium: true },
];

export function windowByKey(key) {
  return WINDOWS.find((w) => w.key === key) || null;
}

/**
 * The next seven days a Standard job can be booked for (the server
 * allows today through +7). Each: { iso: 'YYYY-MM-DD', label }.
 */
export function bookableDays(now = new Date(), count = 7) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = localDateIso(d);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    out.push({ iso, label });
  }
  return out;
}

export function localDateIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * The scheduledDate the server expects: local midnight of the chosen
 * day, with the browser's offset at midnight ("2026-10-03T00:00:00-05:00"),
 * exactly what the app sends (date_iso.dart). The server adds the
 * window's start hour itself (time-window.util.ts windowOpensAt), so
 * sending the window's start here would book every job hours late.
 * Used for both POST /jobs and the cancellation terms shown before it.
 */
export function scheduledDateIso(dayIso, tzOffsetMinutesOf = (d) => d.getTimezoneOffset()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayIso || '')) return null;
  const [y, m, d] = dayIso.split('-').map(Number);
  const off = -tzOffsetMinutesOf(new Date(y, m - 1, d, 0, 0, 0)); // minutes east of UTC
  const sign = off < 0 ? '-' : '+';
  const p = (n) => String(Math.abs(n)).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}T00:00:00${sign}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

/** A window that has already ended today isn't offered for today. */
export function windowOpenOn(dayIso, windowKey, now = new Date()) {
  const w = windowByKey(windowKey);
  if (!w) return false;
  if (dayIso !== localDateIso(now)) return true;
  return now.getHours() < w.startHour + 3;
}

/** A random id for idempotency keys and the device id; UUID v4 shaped. */
export function randomId(bytes = crypto.getRandomValues(new Uint8Array(16))) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
