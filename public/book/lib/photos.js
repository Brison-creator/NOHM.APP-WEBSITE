// Photos for a request: made small in the browser before they go, then
// sent one per request.
//
// The server caps any one request at 25 MB (request-limits.ts) and each
// photo at 10 MB (jobs.controller.ts POST /jobs/:id/photos, field
// `files`, up to 5, appended to the job's photos). Five phone photos in
// one request could pass 25 MB and lose them all to a 413, so each
// photo is resized (long edge 2048 px, JPEG 0.85, the camera's
// orientation baked in) and uploaded on its own; one that fails is
// named, and the others still land.
//
// The decision logic is pure and takes its decoder and encoder as
// arguments, so tools/book tests it in Node; the browser versions are
// at the bottom.

import { LIMITS } from './flow.js';

export const PHOTO = {
  maxEdge: 2048,
  quality: 0.85,
  /** A second, smaller try if a photo is still over the server's limit. */
  retryQuality: 0.7,
  /** A photo already this small, and within maxEdge, is sent as it is. */
  keepUnderBytes: 1.5 * 1024 * 1024,
  /** The server's per-photo limit. */
  maxBytes: LIMITS.photoBytes,
};

const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif)$/;
const SEND_AS_IS = /^image\/(jpeg|png|webp)$/;

export class PhotoError extends Error {
  constructor(name, message) {
    super(message);
    this.name = 'PhotoError';
    this.fileName = name;
  }
}

/** The size that fits inside maxEdge on the long side, keeping the shape. */
export function fitWithin(width, height, maxEdge = PHOTO.maxEdge) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const long = Math.max(w, h);
  if (long <= maxEdge) return { width: w, height: h };
  const k = maxEdge / long;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

/** "IMG_2041.HEIC" → "IMG_2041.jpg". */
export function jpegName(name) {
  const base = String(name || 'photo').replace(/\.[^./\\]+$/, '') || 'photo';
  return `${base}.jpg`;
}

function typeOf(file) {
  if (file.type) return file.type.toLowerCase();
  // Some browsers leave HEIC untyped.
  return /\.(heic|heif)$/i.test(file.name || '') ? 'image/heic' : '';
}

/**
 * Make one photo ready to send. Resolves to the File to upload (the
 * original when it's already small, or a resized JPEG); rejects with a
 * PhotoError that names the photo.
 *
 * deps.decode(file) → { width, height, source, close() } with the
 *   camera's orientation already applied (width/height as seen).
 * deps.encode(source, width, height, quality) → Blob (image/jpeg).
 * deps.makeFile(blob, name) → File.
 */
export async function preparePhoto(file, deps = browserPhotoDeps()) {
  const name = file.name || 'photo';
  const type = typeOf(file);
  if (!ACCEPTED.test(type)) throw new PhotoError(name, `${name} isn’t a photo NOHM can take. Use a JPEG, PNG, WebP or HEIC.`);

  let img;
  try {
    img = await deps.decode(file);
  } catch {
    // A browser that can't read it (HEIC outside Safari): the server
    // takes HEIC as it is, if it's within its limit.
    if (file.size <= PHOTO.maxBytes) return file;
    throw new PhotoError(name, `${name} is too large and this browser can’t shrink it. Try a JPEG, or a smaller photo.`);
  }
  try {
    const size = fitWithin(img.width, img.height);
    const fits = size.width === Math.round(img.width) && size.height === Math.round(img.height);
    if (fits && file.size <= PHOTO.keepUnderBytes && SEND_AS_IS.test(type)) return file;
    let blob = await deps.encode(img.source, size.width, size.height, PHOTO.quality);
    if (blob && blob.size > PHOTO.maxBytes) blob = await deps.encode(img.source, size.width, size.height, PHOTO.retryQuality);
    if (!blob || !blob.size) throw new PhotoError(name, `${name} couldn’t be prepared. Try another photo.`);
    if (blob.size > PHOTO.maxBytes) throw new PhotoError(name, `${name} is still over 10 MB after shrinking. Try another photo.`);
    return deps.makeFile(blob, jpegName(name), file);
  } finally {
    try { img.close && img.close(); } catch { /* nothing to free */ }
  }
}

/**
 * Upload each photo in its own request, in order. Resolves to the ones
 * that failed: [{ name, message }] (empty when all landed).
 */
export async function uploadEach(photos, uploadOne) {
  const failed = [];
  for (const f of photos || []) {
    try {
      await uploadOne(f);
    } catch (ex) {
      failed.push({ name: f.name || 'photo', message: (ex && ex.message) || 'It didn’t upload.' });
    }
  }
  return failed;
}

/** The line that says which photos didn't make it, or null. */
export function photoFailureText(failed) {
  if (!failed || !failed.length) return null;
  if (failed.length === 1) {
    const f = failed[0];
    return `Your request went out, but the photo ${f.name} didn’t upload (${f.message.replace(/\.$/, '')}). You can add it in the app.`;
  }
  return `Your request went out, but ${failed.length} photos didn’t upload: ${failed.map((f) => f.name).join(', ')}. You can add them in the app.`;
}

// ── In the browser ───────────────────────────────────────────────

export function browserPhotoDeps() {
  return {
    async decode(file) {
      // createImageBitmap applies the photo's EXIF orientation with
      // 'from-image'; <img> does by default (CSS image-orientation).
      if (typeof createImageBitmap === 'function') {
        try {
          const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
          return { width: bmp.width, height: bmp.height, source: bmp, close: () => bmp.close() };
        } catch { /* older Safari: no options, or no Blob support; use <img> */ }
      }
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return { width: img.naturalWidth, height: img.naturalHeight, source: img, close: () => URL.revokeObjectURL(url) };
      } catch (e) {
        URL.revokeObjectURL(url);
        throw e;
      }
    },
    encode(source, width, height, quality) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // a transparent PNG becomes white, not black
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, width, height);
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    },
    makeFile(blob, name, original) {
      return new File([blob], name, { type: 'image/jpeg', lastModified: original && original.lastModified });
    },
  };
}
