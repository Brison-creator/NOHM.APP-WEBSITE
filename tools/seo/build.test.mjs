// The topic pages are built by tools/seo/build.mjs; this fails while one
// on disk differs from what it builds (run the build, then commit).
//   Run: node --test tools/seo/*.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from './build.mjs';

test('every topic page, hub and the sitemap are as built', () => {
  for (const [f, html] of build()) {
    assert.ok(fs.existsSync(f), `${f} is missing: run node tools/seo/build.mjs`);
    assert.equal(fs.readFileSync(f, 'utf8'), html, `${f} is out of date: run node tools/seo/build.mjs`);
  }
});

test('no topic page names a town or promises coverage', () => {
  for (const [f, html] of build()) {
    if (!f.endsWith('index.html')) continue;
    assert.doesNotMatch(html, /\bnationwide\b|\bevery (city|town|state)\b|\bin your (city|town)\b/i, f);
  }
});
