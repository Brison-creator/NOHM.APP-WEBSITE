// node --test tools/book
// Photos are shrunk before they go (long edge 2048, JPEG 0.85) and sent
// one per request, so five phone photos can't pass the server's 25 MB
// request cap together and all be lost; a failure names the photo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO, fitWithin, jpegName, preparePhoto, uploadEach, photoFailureText, PhotoError } from '../../public/book/lib/photos.js';
import { createApi } from '../../public/nohm/api.js';

const MB = 1024 * 1024;
const file = (name, type, size) => ({ name, type, size, lastModified: 1 });

/** A fake decoder/encoder that records what it was asked. */
function fakeDeps({ width = 4032, height = 3024, decodeFails = false, sizes = [1.2 * MB] } = {}) {
  const calls = { encode: [], closed: 0 };
  return {
    calls,
    async decode() {
      if (decodeFails) throw new Error('cannot decode');
      return { width, height, source: 'SRC', close: () => calls.closed++ };
    },
    async encode(source, w, h, quality) {
      calls.encode.push({ source, w, h, quality });
      return { size: sizes[Math.min(calls.encode.length - 1, sizes.length - 1)], type: 'image/jpeg' };
    },
    makeFile: (blob, name) => ({ name, type: 'image/jpeg', size: blob.size }),
  };
}

test('fitWithin keeps the shape and caps the long edge', () => {
  assert.deepEqual(fitWithin(4032, 3024), { width: 2048, height: 1536 });
  assert.deepEqual(fitWithin(3024, 4032), { width: 1536, height: 2048 });
  assert.deepEqual(fitWithin(1000, 3000), { width: 683, height: 2048 });
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
  assert.equal(PHOTO.maxEdge, 2048);
  assert.equal(PHOTO.quality, 0.85);
});

test('jpegName swaps the extension', () => {
  assert.equal(jpegName('IMG_2041.HEIC'), 'IMG_2041.jpg');
  assert.equal(jpegName('leak.png'), 'leak.jpg');
  assert.equal(jpegName('noext'), 'noext.jpg');
});

test('a 12 MB phone photo becomes a 2048 px JPEG at 0.85, oriented as decoded', async () => {
  // decode() hands back the size as seen (orientation applied), so a portrait photo stays portrait.
  const deps = fakeDeps({ width: 3024, height: 4032 });
  const out = await preparePhoto(file('IMG_1.jpg', 'image/jpeg', 12 * MB), deps);
  assert.deepEqual(deps.calls.encode, [{ source: 'SRC', w: 1536, h: 2048, quality: 0.85 }]);
  assert.equal(out.type, 'image/jpeg');
  assert.equal(out.name, 'IMG_1.jpg');
  assert.ok(out.size <= PHOTO.maxBytes);
  assert.equal(deps.calls.closed, 1, 'the decoded image is freed');
});

test('a small photo within 2048 px goes as it is (its own orientation tag intact)', async () => {
  const deps = fakeDeps({ width: 1200, height: 900 });
  const f = file('small.jpg', 'image/jpeg', 300 * 1024);
  assert.equal(await preparePhoto(f, deps), f);
  assert.equal(deps.calls.encode.length, 0);
});

test('a big-pixel but small-byte photo is still resized', async () => {
  const deps = fakeDeps({ width: 4000, height: 3000 });
  await preparePhoto(file('wide.png', 'image/png', 900 * 1024), deps);
  assert.equal(deps.calls.encode[0].w, 2048);
});

test('still over 10 MB after the first try: one smaller try, then a named refusal', async () => {
  const twice = fakeDeps({ sizes: [11 * MB, 3 * MB] });
  const ok = await preparePhoto(file('a.jpg', 'image/jpeg', 20 * MB), twice);
  assert.deepEqual(twice.calls.encode.map((c) => c.quality), [0.85, 0.7]);
  assert.equal(ok.size, 3 * MB);
  const never = fakeDeps({ sizes: [11 * MB, 11 * MB] });
  await assert.rejects(preparePhoto(file('b.jpg', 'image/jpeg', 20 * MB), never), (e) => e instanceof PhotoError && e.fileName === 'b.jpg' && /b\.jpg/.test(e.message));
});

test('a HEIC the browser can’t read goes as it is when within the server’s limit, else is named', async () => {
  const f = file('IMG_9.HEIC', 'image/heic', 3 * MB);
  assert.equal(await preparePhoto(f, fakeDeps({ decodeFails: true })), f);
  await assert.rejects(preparePhoto(file('IMG_8.HEIC', 'image/heic', 14 * MB), fakeDeps({ decodeFails: true })), /IMG_8\.HEIC/);
  assert.equal(await preparePhoto(file('x.heic', '', 2 * MB), fakeDeps({ decodeFails: true })).then((r) => r.name), 'x.heic', 'untyped HEIC is recognized by name');
});

test('anything that isn’t a photo is refused by name', async () => {
  await assert.rejects(preparePhoto(file('notes.pdf', 'application/pdf', MB), fakeDeps()), /notes\.pdf/);
  await assert.rejects(preparePhoto(file('anim.gif', 'image/gif', MB), fakeDeps()), /anim\.gif/);
});

test('uploads go one photo per request, in order; a failure is named and the rest still land', async () => {
  const photos = [{ name: 'a.jpg' }, { name: 'b.jpg' }, { name: 'c.jpg' }];
  const sent = [];
  const failed = await uploadEach(photos, async (f) => {
    sent.push(f.name);
    if (f.name === 'b.jpg') throw new Error('That upload is too large.');
  });
  assert.deepEqual(sent, ['a.jpg', 'b.jpg', 'c.jpg']);
  assert.deepEqual(failed, [{ name: 'b.jpg', message: 'That upload is too large.' }]);
  assert.deepEqual(await uploadEach([], async () => {}), []);
  assert.deepEqual(await uploadEach(undefined, async () => {}), []);
});

test('the failure line names the photo', () => {
  assert.equal(photoFailureText([]), null);
  assert.match(photoFailureText([{ name: 'b.jpg', message: 'That upload is too large.' }]), /the photo b\.jpg didn’t upload \(That upload is too large\)\. You can add it in the app\./);
  assert.match(photoFailureText([{ name: 'a.jpg', message: 'x' }, { name: 'c.jpg', message: 'y' }]), /2 photos didn’t upload: a\.jpg, c\.jpg/);
});

test('the endpoint sends exactly one file per request, as `files`', async () => {
  const forms = [];
  globalThis.FormData ??= class { constructor() { this.parts = []; } append(...a) { this.parts.push(a); } };
  const http = { postForm: async (path, form) => { forms.push({ path, form }); return {}; } };
  const api = createApi(http, { deviceFields: () => ({}) });
  assert.equal(api.jobs.uploadPhotos, undefined, 'no several-photos-in-one-request call');
  const f = new Blob(['x'], { type: 'image/jpeg' });
  await api.jobs.uploadPhoto('j-1', Object.assign(f, { name: 'a.jpg' }));
  assert.equal(forms.length, 1);
  assert.equal(forms[0].path, '/jobs/j-1/photos');
  const entries = [...forms[0].form.entries()];
  assert.equal(entries.length, 1);
  assert.equal(entries[0][0], 'files');
});
