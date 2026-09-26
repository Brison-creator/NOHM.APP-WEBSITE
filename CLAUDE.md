# nohm.app website

Static site. Amplify serves `public/` as-is (see `amplify.yml`); there is no build step.

## Rules for every page

- **Design follows Tesla / Starlink:** white background, charcoal body text `#393c41`, near-black headings `#171a20`, medium-weight headings, 4px corners, lots of space.
- **Every page carries the top bar.** Link `/bar.css` in the head and open `<body>` with:
  ```html
  <header class="bar"><a href="/">NOHM</a></header>
  ```
  Also set `<meta name="theme-color" content="#000000" />` so the phone's status bar matches.
- **Wordmark font is Panchang** (600 for headlines, 700 in the bar). Load it from Fontshare:
  `https://api.fontshare.com/v2/css?f[]=panchang@600,700&display=swap`.
  Never commit the font files; the ITF Free Font License forbids redistributing them and this repo is public.
- Palette is white, black and NOHM blue, nothing else:
  - background `#ffffff`; top bar `#000000`
  - headlines and the wordmark `#171a20`; body text `#393c41`; small print `#86868b`
  - NOHM blue `#356CA3` for buttons, links and accents (button hover `#2c5b8b`)
- Never use "Keep money local" or anything about it, anywhere on the site.
- Marketing pages (homepage, `/homeowners`) link `/screens.css` for the shared screen template and footer, and `/download.js` so Download now opens the right store.
- Each page lives at `public/<path>/index.html` so clean URLs like `/privacy` work.
