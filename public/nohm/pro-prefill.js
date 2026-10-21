// What a pro typed on nohm.app/pro (the supply-house flyer's short form),
// carried to /join in this tab only (sessionStorage), so the full sign-up
// starts filled in and nobody types it twice. Only these fields, only
// well-formed values; a browser that blocks storage simply starts empty.

const KEY = 'nohm.proPrefill';
const FIELDS = { firstName: 60, lastName: 60, phone: 30, email: 254, tradeId: 40, businessName: 40, zip: 5 };

/** The kept fields, trimmed and capped; null when nothing is left. */
export function cleanPrefill(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const [k, max] of Object.entries(FIELDS)) {
    const v = typeof r[k] === 'string' ? r[k].replace(/\s+/g, ' ').trim().slice(0, max) : '';
    if (v) out[k] = v;
  }
  if (out.zip && !/^\d{5}$/.test(out.zip)) delete out.zip;
  if (out.tradeId && !/^[A-Za-z0-9_-]+$/.test(out.tradeId)) delete out.tradeId;
  return Object.keys(out).length ? out : null;
}

export function savePrefill(storage, values) {
  try {
    const v = cleanPrefill(values);
    if (v) storage.setItem(KEY, JSON.stringify(v));
  } catch { /* storage blocked: /join starts empty */ }
}

export function readPrefill(storage) {
  try {
    return cleanPrefill(JSON.parse(storage.getItem(KEY) || 'null'));
  } catch {
    return null;
  }
}

export function clearPrefill(storage) {
  try { storage.removeItem(KEY); } catch { /* fine */ }
}
