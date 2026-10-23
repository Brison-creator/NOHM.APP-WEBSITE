// Site-wide checks, no browser: every indexable page carries its
// canonical and share tags, the sitemap and robots.txt agree with the
// pages, and every internal link, image, script and stylesheet points
// at a file in public/.  Run: node --test tools/site/*.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const HOST = 'https://nohm.app';

// Pages kept out of the sitemap on purpose (not in the menu).
const UNLISTED = ['/try/', '/dispatch/'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const files = walk(ROOT);
const html = files.filter((f) => f.endsWith('.html'));
const urlOf = (f) => '/' + path.relative(ROOT, path.dirname(f)).split(path.sep).join('/').replace(/^\/?$/, '').replace(/([^/])$/, '$1/');
const read = (f) => fs.readFileSync(f, 'utf8');
const noindex = (s) => /<meta name="robots" content="noindex/.test(s);
const pages = html.filter((f) => path.basename(f) === 'index.html').map((f) => ({ f, url: urlOf(f), s: read(f) }));
const indexable = pages.filter((p) => !noindex(p.s));
const meta = (s, attr, name) => (s.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`)) || [])[1];

test('every indexable page has its canonical, Open Graph and Twitter tags', () => {
  assert.ok(indexable.length >= 20, `found ${indexable.length} pages`);
  for (const { url, s } of indexable) {
    const canon = s.match(/<link rel="canonical" href="([^"]*)"/g) || [];
    assert.deepEqual(canon, [`<link rel="canonical" href="${HOST}${url}"`], `${url}: one canonical, its own URL`);
    assert.equal(meta(s, 'property', 'og:url'), HOST + url, `${url}: og:url`);
    assert.equal(meta(s, 'property', 'og:title'), s.match(/<title>([^<]*)<\/title>/)[1], `${url}: og:title is the title`);
    assert.equal(meta(s, 'property', 'og:description'), meta(s, 'name', 'description'), `${url}: og:description`);
    const img = meta(s, 'property', 'og:image');
    assert.ok(img && img.startsWith(HOST + '/') && fs.existsSync(path.join(ROOT, img.slice(HOST.length))), `${url}: og:image ${img}`);
    assert.equal(meta(s, 'name', 'twitter:card'), 'summary_large_image', `${url}: twitter:card`);
  }
});

test('noindex pages carry no canonical and stay out of the sitemap', () => {
  const sitemap = read(path.join(ROOT, 'sitemap.xml'));
  for (const { url, s } of pages.filter((p) => noindex(p.s))) {
    assert.ok(!/rel="canonical"/.test(s), `${url} is noindex but has a canonical`);
    assert.ok(!sitemap.includes(`${HOST}${url}<`), `${url} is noindex but in the sitemap`);
  }
});

test('the sitemap lists every indexable page, and only those', () => {
  const locs = [...read(path.join(ROOT, 'sitemap.xml')).matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length, 'no duplicates');
  const want = indexable.map((p) => HOST + p.url).filter((u) => !UNLISTED.includes(u.slice(HOST.length))).sort();
  assert.deepEqual([...locs].sort(), want);
});

// robots.txt as groups (RFC 9309): one or more User-agent lines, then their rules.
function robotsGroups(text) {
  const groups = [];
  let g = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key === 'sitemap') continue;
    if (key === 'user-agent') {
      if (!g || g.rules.length) groups.push((g = { agents: [], rules: [] }));
      g.agents.push(m[2].toLowerCase());
    } else if (g) g.rules.push(`${key}: ${m[2]}`);
  }
  return groups;
}
// The group a crawler follows: the one naming its token, else `*`.
const groupFor = (groups, token) => groups.find((g) => g.agents.includes(token.toLowerCase())) || groups.find((g) => g.agents.includes('*'));

// AI training crawlers are kept out; AI search and answer bots are let in,
// so NOHM still comes up when someone asks an AI for a local pro.
const AI_TRAINING = ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider', 'meta-externalagent', 'cohere-ai', 'cohere-training-data-crawler', 'Diffbot', 'Omgilibot'];
const AI_SEARCH = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User'];

test('robots.txt allows crawling and names the sitemap', () => {
  const robots = read(path.join(ROOT, 'robots.txt'));
  const groups = robotsGroups(robots);
  const all = groups.find((g) => g.agents.includes('*'));
  assert.ok(all, 'a User-agent: * group');
  assert.deepEqual(all.rules, ['allow: /'], 'everyone else may crawl everything');
  for (const token of ['Googlebot', 'Bingbot', 'Applebot', 'DuckDuckBot']) assert.equal(groupFor(groups, token), all, `${token} follows *`);
  assert.match(robots, new RegExp(`^Sitemap: ${HOST}/sitemap.xml$`, 'm'));
});

test('robots.txt blocks AI training crawlers and leaves AI search and answer bots allowed', () => {
  const robots = read(path.join(ROOT, 'robots.txt'));
  const groups = robotsGroups(robots);
  const all = groups.find((g) => g.agents.includes('*'));
  for (const token of AI_TRAINING) {
    const g = groupFor(groups, token);
    assert.notEqual(g, all, `${token} has its own group`);
    assert.deepEqual(g.rules, ['disallow: /'], `${token} is kept out of the whole site`);
  }
  for (const token of AI_SEARCH) {
    assert.equal(groupFor(groups, token), all, `${token} follows * (allowed)`);
    // A crawler that matches by substring must not catch a search bot either.
    for (const blocked of AI_TRAINING) assert.ok(!token.toLowerCase().includes(blocked.toLowerCase()), `${blocked} would also match ${token}`);
  }
  // Nothing else is disallowed: every group but * is a training crawler's.
  const named = groups.filter((g) => g !== all).flatMap((g) => g.agents);
  assert.deepEqual(named.sort(), AI_TRAINING.map((t) => t.toLowerCase()).sort());
  assert.match(robots, /^#.*training.*search/im, 'a comment says why');
});

test('the 404 page is noindex and uses root-relative assets', () => {
  const s = read(path.join(ROOT, '404.html'));
  assert.ok(noindex(s));
  for (const m of s.matchAll(/(?:href|src)="([^"#:]+)"/g)) assert.ok(m[1].startsWith('/'), `relative link ${m[1]} breaks on a deep 404`);
});

// Resolves a site path the way Amplify does: a file, or a folder's index.html.
function exists(p) {
  const clean = decodeURIComponent(p.split(/[?#]/)[0]);
  const file = path.join(ROOT, clean);
  if (!file.startsWith(ROOT)) return false;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return true;
  return fs.existsSync(path.join(file, 'index.html'));
}

test('every internal link and asset resolves to a file in public/', () => {
  const sources = files.filter((f) => /\.(html|css)$/.test(f) || f === path.join(ROOT, 'menu.js'));
  const broken = [];
  let checked = 0;
  for (const f of sources) {
    const s = read(f);
    const refs = [
      ...[...s.matchAll(/\s(?:href|src|poster|content)="([^"]*)"/g)].map((m) => m[1]),
      ...[...s.matchAll(/\ssrcset="([^"]*)"/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().split(/\s+/)[0])),
      ...[...s.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]),
    ];
    for (let r of refs) {
      if (r.startsWith(HOST + '/')) r = r.slice(HOST.length);
      if (!r || /^(?:[a-z]+:|\/\/|#|\$\{|data:)/i.test(r) || /[{}<>+' ]/.test(r)) continue;
      if (!r.startsWith('/') && !/\.[a-z0-9]+(?:[?#].*)?$/i.test(r) && !r.endsWith('/')) continue; // not a path (meta text)
      const abs = r.startsWith('/') ? r : '/' + path.posix.join(path.relative(ROOT, path.dirname(f)).split(path.sep).join('/'), r);
      checked++;
      if (!exists(abs)) broken.push(`${path.relative(ROOT, f)} → ${r}`);
    }
  }
  assert.ok(checked > 200, `checked ${checked} links`);
  assert.deepEqual(broken, []);
});

test('structured data (JSON-LD) parses and names schema.org', () => {
  for (const { url, s } of pages) {
    for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const data = JSON.parse(m[1]);
      assert.equal(data['@context'], 'https://schema.org', `${url}: @context`);
    }
  }
});
