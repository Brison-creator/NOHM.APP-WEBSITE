# nohm.app website

Static site. Amplify serves `public/` as-is (see `amplify.yml`); there is no build step.

## Rules for every page

- **Layout copies tesla.com.** Homepage: full-screen photo carousel with the title and a pair of buttons (gray main, white second) over the photo, the bar clear over the photo until you scroll, gray cards below, and on phones a Download button pinned to the bottom.
- **Keep explanations short, Tesla style:** a photo, a short title, one line. Use the feature row (`/features.css` + `/features.js`) for that; lists become short spec lists.
- Every page loads `/menu.js`, which puts the **Menu** button in the bar and builds the full-screen menu. New pages go in its list.

- **Design follows Tesla / Starlink:** white background, charcoal body text `#393c41`, near-black headings `#171a20`, medium-weight headings, 4px corners, lots of space.
- **Every page carries the top bar.** Link `/bar.css` in the head and open `<body>` with:
  ```html
  <header class="bar"><a href="/">NOHM</a></header>
  ```
  Also set `<meta name="theme-color" content="#26272b" />` so the phone's status bar matches.
- **Wordmark font is Panchang** (600 for headlines, 700 in the bar). Load it from Fontshare:
  `https://api.fontshare.com/v2/css?f[]=panchang@600,700&display=swap`.
  Never commit the font files; the ITF Free Font License forbids redistributing them and this repo is public.
- Palette is white, black and NOHM blue, nothing else:
  - background `#ffffff`; top bar near-black with a touch of gray (`#26272b` → `#16171a`, hairline `#3a3b40`); `theme-color` `#26272b`
  - headlines and the wordmark `#171a20`; body text `#393c41`; small print `#86868b`
  - buttons are gray: `#e6e7e9` with `#171a20` text (hover `#d9dadd`); store links `#5c5e62`
  - NOHM blue `#356CA3` only for the tagline and links inside text
- Copy about pros and the NOHM Standard comes from the NOHM Marketing Plan (section 5); don't invent policies.
- Never use "Keep money local" or anything about it, anywhere on the site.
- Marketing pages (homepage, `/homeowners`) link `/screens.css` for the shared screen template and footer, and `/download.js` so Download now opens the right store.
- Each page lives at `public/<path>/index.html` so clean URLs like `/privacy` work.
