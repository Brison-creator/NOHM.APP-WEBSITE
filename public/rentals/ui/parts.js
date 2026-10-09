// Small pieces both /rentals views use: icons, the photo carousel, the
// Share button and the toast. Built with createElement and textContent
// only (nohm/dom.js), never innerHTML.

import { h } from '../../nohm/dom.js';

const SVG = 'http://www.w3.org/2000/svg';

/** A 24px stroke icon from one path. */
export function icon(d, size = 20) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
}

export const ICONS = {
  next: 'M9 5l7 7-7 7',
  prev: 'M15 5l-7 7 7 7',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4',
  back: 'M15 5l-7 7 7 7',
  home: 'M4 11l8-7 8 7v9H4zM9 20v-6h6v6',
};

/**
 * The photo carousel: swipe (the track scrolls and snaps), Previous and
 * Next arrows, and "2 / 5". [alt] names the place for screen readers.
 */
export function carousel(photos, alt, { eager = false } = {}) {
  const list = (photos || []).filter((p) => typeof p === 'string' && /^https?:\/\//.test(p));
  if (!list.length) return h('div.r-car.r-car--empty', { role: 'img', 'aria-label': `${alt}: no photos yet` }, [icon(ICONS.home, 40)]);
  const track = h('div.r-car-track', { tabIndex: 0, 'aria-label': `Photos of ${alt}` });
  list.forEach((src, i) => {
    track.append(
      h('div.r-car-slide', [
        h('img', { src, alt: `Photo ${i + 1} of ${list.length}, ${alt}`, loading: eager && i === 0 ? 'eager' : 'lazy', decoding: 'async', draggable: false }),
      ]),
    );
  });
  const count = h('span.r-car-count', `1 / ${list.length}`);
  const at = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
  const go = (d) => track.scrollTo({ left: Math.max(0, Math.min(list.length - 1, at() + d)) * track.clientWidth, behavior: 'smooth' });
  const prev = h('button.r-car-arrow.r-car-prev', { type: 'button', 'aria-label': 'Previous photo', onClick: (e) => { e.preventDefault(); go(-1); } }, [icon(ICONS.prev)]);
  const next = h('button.r-car-arrow.r-car-next', { type: 'button', 'aria-label': 'Next photo', onClick: (e) => { e.preventDefault(); go(1); } }, [icon(ICONS.next)]);
  const update = () => {
    const i = at();
    count.textContent = `${i + 1} / ${list.length}`;
    prev.hidden = i <= 0;
    next.hidden = i >= list.length - 1;
  };
  track.addEventListener('scroll', () => window.requestAnimationFrame(update), { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  });
  prev.hidden = true;
  next.hidden = list.length < 2;
  return h('div.r-car', [track, prev, next, list.length > 1 ? count : null]);
}

let toastTimer = null;
/** A short note at the bottom of the screen ("Link copied"). */
export function toast(text) {
  let el = document.getElementById('r-toast');
  if (!el) {
    el = h('div.r-toast', { id: 'r-toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/** The native share sheet, else the link copied. */
export async function shareLink(url, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    toast(url);
  }
}

/** The round Share button. */
export function shareButton(url, title, label = 'Share') {
  return h('button.r-share', { type: 'button', 'aria-label': `${label} ${title}`, onClick: (e) => { e.preventDefault(); shareLink(url, title); } }, [icon(ICONS.share, 18), h('span', label)]);
}
