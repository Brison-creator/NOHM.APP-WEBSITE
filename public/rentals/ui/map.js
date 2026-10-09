// The map on /rentals: Leaflet 1.9.4, vendored in /vendor/leaflet-1.9.4
// (BSD-2-Clause, its LICENSE beside it), with OpenStreetMap's tiles.
// Loaded only when a map is shown. Pins are the listing's own stored
// point; a listing without one isn't on the map. Popups are elements
// built here, never HTML strings, and the OpenStreetMap credit is our
// own link (Leaflet's attribution control, which takes HTML, is off).

import { h } from '../../nohm/dom.js';

const BASE = '/vendor/leaflet-1.9.4';
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const BLUE = '#356CA3';
let loading = null;

/** Leaflet, once per page (rejects when it can't load). */
export function loadLeaflet() {
  if (window.L && window.L.version) return Promise.resolve(window.L);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      if (!document.querySelector(`link[href="${BASE}/leaflet.css"]`)) {
        document.head.append(h('link', { rel: 'stylesheet', href: `${BASE}/leaflet.css` }));
      }
      const s = document.createElement('script');
      s.src = `${BASE}/leaflet.js`;
      s.onload = () => (window.L ? resolve(window.L) : reject(new Error('no Leaflet')));
      s.onerror = () => {
        loading = null;
        reject(new Error('Leaflet didn’t load'));
      };
      document.head.append(s);
    });
  }
  return loading;
}

/**
 * A map in [host] with a pin per point: [{ at: [lat, lng], label, popup?: Node }].
 * Resolves to { map, refresh } or shows a plain note when it can't.
 */
export async function showMap(host, points, { zoom = 15 } = {}) {
  host.classList.add('r-map');
  const canvas = h('div.r-map-canvas');
  const credit = h('a.r-map-credit', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener' }, '© OpenStreetMap contributors');
  host.append(canvas, credit);
  let L;
  try {
    L = await loadLeaflet();
  } catch {
    host.replaceChildren(h('p.r-note', 'The map isn’t available right now.'));
    return null;
  }
  const map = L.map(canvas, { attributionControl: false, scrollWheelZoom: false, zoomControl: true });
  L.tileLayer(TILES, { maxZoom: 19, crossOrigin: true }).addTo(map);
  const latlngs = [];
  for (const p of points) {
    const marker = L.circleMarker(p.at, { radius: 9, color: '#ffffff', weight: 2, fillColor: BLUE, fillOpacity: 1 }).addTo(map);
    // An element, not a string: Leaflet puts a string in as HTML.
    if (p.label) marker.bindTooltip(h('span', p.label), { direction: 'top', offset: [0, -8] });
    if (p.popup) marker.bindPopup(p.popup, { maxWidth: 260, minWidth: 220 });
    latlngs.push(p.at);
  }
  const fit = () => {
    map.invalidateSize();
    if (latlngs.length === 1) map.setView(latlngs[0], zoom);
    else if (latlngs.length) map.fitBounds(latlngs, { padding: [36, 36], maxZoom: zoom });
  };
  fit();
  return { map, refresh: fit };
}
