// Tells Bing, Yandex, Seznam, Naver and the other IndexNow search engines
// about new or changed pages, so they crawl them soon instead of whenever.
// (Google doesn't use IndexNow: it reads public/sitemap.xml; submit that
// once in Google Search Console.) The key is public by design: the file
// public/ecb25b48b0805c3e853955893651b50b.txt proves nohm.app owns it.
//
//   node tools/seo/indexnow.mjs                 every page in the sitemap
//   node tools/seo/indexnow.mjs /landlords/forms/   only pages under a path
//
// Run it after a push has gone live (Amplify, about a minute).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const KEY = 'ecb25b48b0805c3e853955893651b50b';
const HOST = 'nohm.app';
const under = process.argv[2] || '/';
const urls = [...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]*)<\/loc>/g)]
  .map((m) => m[1])
  .filter((u) => new URL(u).pathname.startsWith(under));
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow: ${urls.length} URL(s) under ${under}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
