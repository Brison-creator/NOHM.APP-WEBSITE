// Home-screen icons for the booth (and /try): the NOHM wordmark in Sora 800,
// white on the site's near-black. Run from the repo root:
//   PLAYWRIGHT=/path/to/playwright node tools/booth/make-icons.mjs
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const font = readFileSync('public/fonts/sora/sora-latin-700-800.woff2').toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [size, file] of [[512, 'icon-512.png'], [192, 'icon-192.png'], [180, 'apple-touch-icon.png']]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>
    @font-face { font-family: Sora; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 700 800; }
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: #171a20; }
    body { display: grid; place-items: center; }
    b { font: 800 ${Math.round(size * 0.22)}px/1 Sora; letter-spacing: -0.04em; color: #fff; }
  </style><b>NOHM</b>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/booth/${file}` });
}
await browser.close();
console.log('wrote public/booth/icon-512.png, icon-192.png, apple-touch-icon.png');
