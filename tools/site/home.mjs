// The home page is the landlord page (owner, 2026-11-20: "Change the home
// page of NOHM to this one"). public/index.html is BUILT here from
// public/landlords/index.html, so the two never drift apart: change
// /landlords, then run
//
//   node tools/site/home.mjs
//
// and never edit public/index.html by hand (tools/site/home.test.mjs fails
// when it is out of date). The home copy differs only in what the site's
// front door must carry:
//   - its own address in the canonical and share tags, and its own title;
//   - the "You're invited" share picture and Apple's app bar, because the
//     app's family invite text links https://nohm.app itself;
//   - the site's Organization / WebSite / app data for search engines;
//   - two cards under the opening, Homeowner and Contractor, and a line for
//     renters: the way out of the landlord pages for everyone else.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
export const SOURCE = path.join(ROOT, 'landlords', 'index.html');
export const TARGET = path.join(ROOT, 'index.html');

const HOST = 'https://nohm.app';
const TITLE = 'NOHM: Landlord App for Rent, Leases &amp; Repairs';

const LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization', '@id': `${HOST}/#org`, name: 'NOHM', url: `${HOST}/`, logo: `${HOST}/icon-512.png`,
      email: 'support@nohm.app', founder: { '@type': 'Person', name: 'Brison McPhail' },
      contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', telephone: '+1-888-230-6646', email: 'support@nohm.app', url: `${HOST}/support/` },
    },
    { '@type': 'WebSite', '@id': `${HOST}/#site`, name: 'NOHM', url: `${HOST}/`, publisher: { '@id': `${HOST}/#org` } },
    {
      '@type': 'MobileApplication', '@id': `${HOST}/#app`, name: 'NOHM', operatingSystem: 'iOS, Android',
      applicationCategory: 'LifestyleApplication', url: `${HOST}/get/`, publisher: { '@id': `${HOST}/#org` },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      downloadUrl: ['https://apps.apple.com/us/app/nohm-app/id6761128513', 'https://play.google.com/store/apps/details?id=com.nohm.app'],
    },
  ],
};

const SHARE = `  <!-- The black NOHM "You're invited" card (owner, 2026-10-23): the app's
       family invite text links https://nohm.app itself, so this is the
       picture its link preview shows. -->
  <meta property="og:image" content="${HOST}/img/og-invite.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="NOHM. You’re invited." />
`;

const APP_BAR = `  <!-- Safari on iPhone shows Apple's "NOHM – GET" bar (OPEN once the app
       is on the phone): one tap to the App Store from the family invite
       text, which links this page (owner, 2026-10-23). -->
  <meta name="apple-itunes-app" content="app-id=6761128513" />
`;

const OTHERS_STYLE = `  <style>
    /* Home page only: the way out of the landlord pages for homeowners and
       pros (owner, 2026-11-20: "put homeowner and contractor cards so they
       can click it out of that area"). A photo each, of them. */
    .others { max-width: 1040px; margin: 0 auto; padding: 28px 22px 0; }
    .others h2 { margin: 0 0 14px; font-size: 15px; line-height: 1.3; font-weight: var(--weight-ui-strong); color: #5c5e62; }
    .others-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .others a.card { position: relative; display: block; overflow: hidden; border-radius: 16px; aspect-ratio: 4 / 3; background: #16171a; color: #fff; text-decoration: none; }
    .others a.card img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .others a.card::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0, 0, 0, 0.78), rgba(0, 0, 0, 0.1) 62%); }
    .others a.card span { position: absolute; z-index: 1; left: 14px; right: 14px; bottom: 12px; }
    .others a.card b { display: block; font-family: var(--font-display); font-weight: var(--weight-heading); font-size: clamp(18px, 2.4vw, 26px); line-height: 1.15; letter-spacing: var(--tracking-headline); }
    .others a.card i { display: block; margin-top: 3px; font-style: normal; font-size: 14px; line-height: 1.3; }
    .others p { margin: 12px 0 0; font-size: 15px; color: #5c5e62; }
    .others p a { color: #171a20; font-weight: var(--weight-ui-strong); text-underline-offset: 3px; }
    @media (min-width: 900px) { .others { padding-top: 40px; } .others-row { gap: 20px; } .others a.card { aspect-ratio: 16 / 7; } .others a.card span { left: 24px; bottom: 20px; } .others a.card i { font-size: 16px; } }
  </style>
`;

const OTHERS = `
    <section class="others" aria-labelledby="others-title">
      <h2 id="others-title">Not a landlord?</h2>
      <div class="others-row">
        <a class="card" href="/homeowners/">
          <picture>
            <source type="image/webp" srcset="/img/ready-960.webp" />
            <img src="/img/ready-960.jpg" width="960" height="640" loading="lazy" style="object-position:30% 35%" alt="A homeowner in her kitchen, phone in hand, as a NOHM pro arrives at the door" />
          </picture>
          <span><b>Homeowner</b><i>Something broke? Book a local pro.</i></span>
        </a>
        <a class="card" href="/pros/">
          <picture>
            <source type="image/webp" srcset="/img/prep-960.webp" />
            <img src="/img/prep-960.jpg" width="960" height="640" loading="lazy" style="object-position:40% 35%" alt="A contractor in his work van, getting ready for the next job" />
          </picture>
          <span><b>Contractor</b><i>Get repair jobs near you.</i></span>
        </a>
      </div>
      <p>Renting? <a href="/renters/">See what tenants get.</a></p>
    </section>
`;

// Replaces exactly one match, and says so loudly when /landlords changed
// shape under it (a silent miss would ship a half-built home page).
function once(s, what, pattern, to) {
  const hits = s.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')) || [];
  if (hits.length !== 1) throw new Error(`home.mjs: expected one ${what} in /landlords/index.html, found ${hits.length}`);
  return s.replace(pattern, to);
}

export function build(landlords) {
  let s = landlords;
  s = once(s, 'charset line', /  <meta charset="utf-8" \/>\n/,
    '  <meta charset="utf-8" />\n  <!-- BUILT by tools/site/home.mjs from /landlords/index.html. Do not edit this file: change /landlords, then run node tools/site/home.mjs -->\n');
  s = once(s, 'title', /<title>[^<]*<\/title>/, `<title>${TITLE}</title>`);
  s = once(s, 'og:title', /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${TITLE}" />`);
  s = once(s, 'canonical', /<link rel="canonical" href="https:\/\/nohm\.app\/landlords\/" \/>/, `<link rel="canonical" href="${HOST}/" />`);
  s = once(s, 'og:url', /<meta property="og:url" content="https:\/\/nohm\.app\/landlords\/" \/>/, `<meta property="og:url" content="${HOST}/" />`);
  s = once(s, 'share picture', /  <meta property="og:image" content="[^"]*" \/>\n  <meta property="og:image:width" content="[^"]*" \/>\n  <meta property="og:image:height" content="[^"]*" \/>\n  <meta property="og:image:alt" content="[^"]*" \/>\n/, SHARE);
  s = once(s, 'twitter:card', /  <meta name="twitter:card" content="summary_large_image" \/>\n/, `  <meta name="twitter:card" content="summary_large_image" />\n${APP_BAR}`);
  s = once(s, '</head>', /<\/head>/, `${OTHERS_STYLE}  <script type="application/ld+json">${JSON.stringify(LD)}</script>\n</head>`);
  // The row goes right under the opening photo: after the first section.
  const top = s.indexOf('<section class="top">');
  const end = s.indexOf('</section>', top);
  if (top < 0 || end < 0) throw new Error('home.mjs: the opening section of /landlords/index.html was not found');
  const at = end + '</section>'.length;
  s = s.slice(0, at) + '\n' + OTHERS.replace(/\n$/, '') + s.slice(at);
  return s;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(TARGET, build(fs.readFileSync(SOURCE, 'utf8')));
  console.log('public/index.html built from /landlords/index.html');
}
