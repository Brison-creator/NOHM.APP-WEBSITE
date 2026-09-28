// Renders space-zoom.html to a video, frame by frame, with headless Chromium
// and ffmpeg. Serve the repo root over HTTP first (the page loads the fonts
// from public/fonts), then:
//
//   node tools/space-zoom/render.mjs <out.mp4> [width] [height] [end line]
//
// Env: BASE_URL (default http://127.0.0.1:4176), PLAYWRIGHT (path to the
// playwright module), FFMPEG (ffmpeg binary), FPS (default 30).
import { spawn } from 'node:child_process';

const [out, w = '1080', h = '1080', end] = process.argv.slice(2);
if (!out) { console.error('usage: render.mjs <out.mp4> [width] [height] [end line]'); process.exit(1); }
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4176';
const FPS = Number(process.env.FPS || 30);
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');

const query = new URLSearchParams({ w, h, render: '1' });
if (end !== undefined) query.set('end', end);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on('pageerror', (e) => { console.error('page error:', e.message); process.exit(1); });
await page.goto(`${BASE}/tools/space-zoom/space-zoom.html?${query}`, { waitUntil: 'load' });
await page.evaluate(() => window.film.ready);

// Lossless frames in, one high-quality master out.
const ff = spawn(process.env.FFMPEG || 'ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

let n = 0, more = true;
const started = Date.now();
while (more) {
  const [again, data] = await page.evaluate((fps) => {
    const again = window.film.frame(fps);
    return [again, document.getElementById('film').toDataURL('image/png').split(',')[1]];
  }, FPS);
  more = again;
  if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  if (++n % 60 === 0) console.log(`${n} frames, ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log(`${out}: ${n} frames at ${FPS}fps`);
