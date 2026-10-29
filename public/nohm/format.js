// Small pure helpers the booking flow shares. No DOM, no network, so
// tools/book tests them in Node.

/** "$20" or "$20.50" from cents. */
export function money(cents) {
  const n = Math.round(Number(cents) || 0);
  const abs = Math.abs(n) / 100;
  const text = Number.isInteger(abs) ? `$${abs}` : `$${abs.toFixed(2)}`;
  return n < 0 ? `−${text}` : text;
}

/**
 * A US phone as the server wants it (E.164, "+15125550123"). Accepts
 * what people type: "(512) 555-0123", "512.555.0123", "+1 512 555 0123".
 * Returns null when it isn't a US number.
 */
export function toE164US(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
  // NANP: area code and exchange start with 2–9.
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? `+1${digits}` : null;
}

/** "(512) 555-0123" for display; anything else comes back as typed. */
export function prettyPhone(e164) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164 || '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164 || '';
}

/**
 * A Home ID (HIN) as anyone sees it, the way the app shows it (shownHin in
 * hin_format.dart): only its last four, card style. "ACD4F7HJK" →
 * "•••• 7HJK"; "H27KQM4XRT9WPD3NC8" → "•••• 3NC8". The whole code is
 * printed only on NOHM's official records (owner, 2026-10-17: "we never
 * display the full HIN to anyone"). "" for none.
 */
export function homeId(hin) {
  const s = String(hin || '').replace(/[\s\-‐-―_.]/g, '').toUpperCase();
  return s ? `•••• ${s.slice(-4)}` : '';
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

// ── Days and times at the home ────────────────────────────────────
//
// A booking's day and arrival window are the home's, in the home's own
// time zone (the server keeps it on the property: `timezone`, an IANA
// name like "America/Chicago"), never the browser's: a browser in UTC
// booking a Chicago home still means Chicago's Tuesday, 11 AM. Each
// helper takes that zone; without one (the server hasn't said) the
// browser's own zone stands in.

/** True for an IANA zone this browser knows. */
export function isTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The browser's own zone, or null when it can't say. */
export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** The wall clock in `tz` (else the browser's zone) at an instant: { year, month, day, hour, minute, second }. */
export function zonedParts(at, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: isTimeZone(tz) ? tz : undefined, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const p = {};
  for (const x of f.formatToParts(at)) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { year: p.year, month: p.month, day: p.day, hour: p.hour % 24, minute: p.minute, second: p.second };
}

/** Minutes east of UTC in `tz` at an instant (Chicago in October: −300). */
export function zoneOffsetMinutes(at, tz) {
  const t = Math.floor(at.getTime() / 1000) * 1000;
  const p = zonedParts(new Date(t), tz);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t) / 60000);
}

const isoOf = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** The date in `tz` at an instant: "YYYY-MM-DD". */
export function dateIn(at, tz) {
  const p = zonedParts(at, tz);
  return isoOf(p.year, p.month, p.day);
}

/** "CDT": the zone's short name at an instant, to say whose clock a window is on. */
export function zoneShortName(tz, at = new Date()) {
  if (!isTimeZone(tz)) return '';
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(at).find((x) => x.type === 'timeZoneName');
  return part ? part.value : '';
}

/**
 * How far out Standard starts: 48 hours or more after booking, never
 * sooner (owner, 2026-10-29: "standard is 48 hours out no sooner no
 * matter what"). The server can set it with standardLeadHours on
 * GET /config/pricing (book/lib/flow.js standardLeadHours).
 */
export const STANDARD_LEAD_HOURS = 48;

/**
 * The instant a window opens at the home (`tz`, else the browser's zone),
 * or null for a bad day or window. The earlier of its start hour on the
 * home's wall clock and the home's midnight plus that many hours (the
 * two differ by an hour on a clock-change day), so the 48 hours hold
 * however the server counts it.
 */
export function windowOpensAt(dayIso, windowKey, tz = null) {
  const w = windowByKey(windowKey);
  const midnight = Date.parse(scheduledDateIso(dayIso, tz) || '');
  if (!w || Number.isNaN(midnight)) return null;
  const [y, m, d] = dayIso.split('-').map(Number);
  // As scheduledDateIso: a first guess from the offset at that wall time
  // read as UTC, then the offset at the instant the guess names.
  const wall = Date.UTC(y, m - 1, d, w.startHour);
  const off = zoneOffsetMinutes(new Date(wall - zoneOffsetMinutes(new Date(wall), tz) * 60000), tz);
  return new Date(Math.min(wall - off * 60000, midnight + w.startHour * 3600000));
}

/**
 * Whether a Standard window can be booked: it opens `leadHours` (48) or
 * more from now, at the home. Nothing sooner is ever offered.
 */
export function windowOpenOn(dayIso, windowKey, now = new Date(), tz = null, leadHours = STANDARD_LEAD_HOURS) {
  const at = windowOpensAt(dayIso, windowKey, tz);
  return Boolean(at) && at.getTime() - now.getTime() >= leadHours * 3600000;
}

/**
 * The days a Standard job can be booked for, counted at the home (`tz`):
 * the first `count` days with a window that opens `leadHours` (48) or
 * more from now, so the first is two or three days out. Never today
 * either (owner, 2026-10-09: "Standard service isn't allowed to be booked
 * same day"; the server refuses that in the home's time, standard-day.ts).
 * Each: { iso: 'YYYY-MM-DD', label }.
 */
export function bookableDays(now = new Date(), count = 7, tz = null, leadHours = STANDARD_LEAD_HOURS) {
  const t = zonedParts(now, tz);
  const out = [];
  const last = count + Math.ceil(leadHours / 24) + 1;
  for (let i = 1; out.length < count && i <= last; i++) {
    // Calendar arithmetic on the home's date, in UTC so no zone moves it.
    const d = new Date(Date.UTC(t.year, t.month - 1, t.day + i));
    const iso = isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    if (!WINDOWS.some((w) => windowOpenOn(iso, w.key, now, tz, leadHours))) continue;
    const label = i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
    out.push({ iso, label });
  }
  return out;
}

/**
 * The scheduledDate the server expects: midnight at the home on the
 * chosen day, with the home's offset at that midnight
 * ("2026-10-03T00:00:00-05:00" for Chicago), the shape the app sends
 * (date_iso.dart). The server adds the window's start hour itself
 * (time-window.util.ts windowOpensAt), so the offset sets the real
 * arrival time: the browser's offset would move a Chicago visit by
 * hours whenever the browser isn't on Chicago time. Used for both
 * POST /jobs and the cancellation terms shown before it.
 */
export function scheduledDateIso(dayIso, tz = null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayIso || '')) return null;
  const [y, m, d] = dayIso.split('-').map(Number);
  // The offset at that wall-clock midnight: a first guess from the offset
  // at UTC midnight, then read again at the instant the guess names.
  const wall = Date.UTC(y, m - 1, d);
  const off = zoneOffsetMinutes(new Date(wall - zoneOffsetMinutes(new Date(wall), tz) * 60000), tz);
  const sign = off < 0 ? '-' : '+';
  const p = (n) => String(Math.abs(n)).padStart(2, '0');
  return `${isoOf(y, m, d)}T00:00:00${sign}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

/** A random id for idempotency keys and the device id; UUID v4 shaped. */
export function randomId(bytes = crypto.getRandomValues(new Uint8Array(16))) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
