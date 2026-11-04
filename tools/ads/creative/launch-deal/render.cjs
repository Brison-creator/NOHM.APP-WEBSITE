// The landlord launch-deal ad images (owner, 2026-11-03/04), drawn from
// ad.html: node tools/ads/creative/launch-deal/render.cjs
// writes square-1080.png (Feeds) and story-1080x1920.png (Stories; the
// top and bottom 250px are left for the Stories bar and button).
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const dir = __dirname;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 3100 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(dir, 'ad.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.locator('#sq').screenshot({ path: path.join(dir, 'square-1080.png') });
  await p.locator('#st').screenshot({ path: path.join(dir, 'story-1080x1920.png') });
  await b.close();
})();
