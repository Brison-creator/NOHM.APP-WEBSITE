# Web booking: `/book`

The website's request-a-service flow. A homeowner picks a service, says how soon, creates (or signs into) a NOHM account, adds the home, puts a card on file and sends the request, all against the same NOHM server and the same endpoints the app uses. Nothing is decided on the website: access, price, card-on-file, one-open-request-per-trade and the HIN are all the server's calls, exactly as in the app.

Branch: `web-booking`. Not merged. The lead engineer audits and integrates.

## What it does, step by step

| Step | Screen | Server calls |
|---|---|---|
| 1 | **Service**: search pill + one tile per bookable trade (`GET /trades`, `bookable !== false`). Typing searches trade names and the app's issue catalog; a hit jumps straight to details. | `GET /trades`, `GET /config/pricing` (public, on load; nothing else until sign-in) |
| 2 | **Issue**: the trade's five issues, copied from the app (`lib/issues.js`). Feeds the job title `"<Trade> · <Issue>"`, as the app does. | — |
| 3 | **Details**: free text (≤2000) + up to 5 photos (JPEG/PNG/WebP/HEIC). Each photo is shrunk in the browser as it's added (`lib/photos.js`: long edge 2048 px, JPEG 0.85, the camera's EXIF orientation baked in); a small one goes as it is, a HEIC the browser can't read goes as it is if it's within 10 MB. One that can't be used is named. | — |
| 4 | **Speed**: Standard (free), NOHM Express, NOHM NOW, with the regular price struck through while `hasLiveDiscount`. | — |
| 5 | **Schedule** (Standard only): today + 7 days, four arrival windows; windows that have closed today are disabled; late afternoon shows its +$20 premium. | — |
| 6 | **Account** (skipped when signed in): sign-up with a phone (name + phone, email optional → text code → account, no password) or with email (email, phone, password → text code → account), sign-in (email + password, with the new-browser text code; or phone code), optional Google. | `POST /auth/phone-signup/send-otp`, `/auth/phone-signup/verify-otp`; `/auth/check-exists`, `/auth/email-signup/send-otp`, `/auth/email-signup/verify-otp`; `/auth/login/email-password`, `/auth/login/verify-device-otp`, `/auth/login/send-otp`, `/auth/login/verify-otp`; `/auth/google/signin`, `/auth/social-signup/send-otp`, `/auth/google/signup-with-phone`; then `GET /auth/me`, `GET /properties`, `GET /stripe/customer/payment-method` |
| 7 | **Home**: pick one of the person's homes, or add one: address search → check → shell → confirm SINGLE, which issues the HIN. An address that already has a record (claimable, or owned by someone else) or is multi-unit is sent to the app; those flows (claim verification, unit pick, dispute) stay app-only. | `GET /places/autocomplete`, `GET /places/details`, `POST /properties/check-type`, `POST /properties/shell`, `POST /properties/:id/confirm` |
| 8 | **Card** (skipped when one is on file): Stripe.js card element → `confirmCardSetup` → server records it. | `POST /stripe/customer/setup-intent`, `POST /stripe/customer/confirm-card` |
| 9 | **Review**: every choice with an Edit link, the fee, the server's cancellation disclosure, and one button. On Express, if the server reports spendable NOHM Credits, an opt-in (off by default) to put them toward the fee; only `useCreditsForExpressFee: true` is sent, and the server decides how many apply when it holds the fee. | `GET /jobs/cancellation-terms`, `GET /nohmcredit/balance` (Express) |
| 10 | **Send**: Standard/Express → `POST /jobs`, then photos. NOW → the live list, pick a pro → `POST /now/dispatch`, then photos. Photos go **one per request** (the server appends each; its 25 MB request cap could otherwise refuse five at once), and the done screen names any that failed. | `POST /jobs`, `POST /jobs/:id/photos` (once per photo); `GET /now/live`, `POST /now/demand`, `POST /now/dispatch` |
| 11 | **Done**: Standard shows the matched pros and lets the person pick one; Express and NOW say what happens next. Everything after that (tracking, chat, PIN, estimate approval) points to the app. | `GET /jobs/:id`, `GET /jobs/:id/matched-contractors`, `POST /jobs/:id/select-contractor` |

The draft (everything but the photo files) lives in `sessionStorage`, so a sign-in or a reload keeps the person's place, and signing out clears it. Tokens live in `localStorage` with one device id per browser (`deviceType: 'web'`). When the server trusts the browser for an email it hands back a `deviceSecret`; the browser keeps it per email and sends it with the next password sign-in, as the app does, so a known browser isn't texted a code each time.

`scheduledDate` is the homeowner's **local midnight** of the chosen day with its offset (`2026-10-03T00:00:00-05:00`), exactly what the app sends; the server adds the window's start hour itself. The cancellation terms on the review step are asked for that same value.

## Files

```
public/book/
  index.html        the page (bar, progress line, #book, footer)
  book.css          the flow's styles: site palette, app shapes
  config.js         apiBase and store links (the Stripe key and Google client come from GET /config/web)
  app.js            state + navigation + submit; the only file that knows every piece
  lib/flow.js       the rules: step order, what each step needs, the exact server bodies, error routing
  lib/issues.js     the app's issue catalog, verbatim
  lib/photos.js     shrink each photo in the browser, upload one per request, name failures
  ui/screens.js     steps 1–5 (service → schedule), one function per step; re-exports the rest
  ui/home.js        steps 7–8: the home (HIN) and the card on file
  ui/send.js        steps 9–10: review, the NOHM NOW list, done
  ui/parts.js       heading, footer, icons, the fee-hold line
  ui/card.js        Stripe.js, loaded only on the card step
public/nohm/        shared with /join
  api.js            every endpoint by name, no logic
  http.js           bearer; one refresh then retry only on a 401 SESSION_EXPIRED (or a 401 with no code); ACCOUNT_* signs out with the server's message; ApiError{status, code, body}
  session.js        tokens, device id, named drafts (storage injected)
  format.js         phone → E.164, money, windows, local ISO dates, ids
  dom.js            h(), field(), button(): no innerHTML anywhere
  signup.js         the sign-up form's rules and body, by role
  account.js        the account screen (sign up, sign in, Google), by role
  google.js         Google Identity Services, loaded only if the server publishes a client id
  web-config.js     GET /config/web: the Stripe publishable key and Google client id; off (with a message) when missing
tools/book/
  flow.test.mjs     node --test: rules, bodies, error routing, session, http (15 tests)
  stub-server.mjs   serves public/ + a stand-in API with the real response shapes; logs every request
  e2e.mjs           headless Chromium against the stub, all runs in order; asserts the bodies sent
  e2e/lib.mjs       the shared browser, stub controls and steps
  e2e/booking.mjs   runs 1–5: Standard, Express, NOW, error paths
  e2e/extras.mjs    runs 6–8: photos, /config/web missing, phone sign-up
docs/web-booking.md this file
```

Also changed: `customHttp.yml` (Amplify headers: `X-Frame-Options: DENY` and `frame-ancestors 'none'` on `/book` and `/join`, `nosniff`, referrer policy, and CORS on `/fonts` for Stripe's card iframe), `public/menu.js` (Book a Pro), `public/index.html` and `public/services/index.html` (the four bookable cards link to `/book?trade=<slug>`), `CLAUDE.md`.

## Security boundaries

- **The server decides everything.** The page sends only the fields the DTOs accept (the server's `forbidNonWhitelisted` would 400 anything else); `lib/flow.js` builds the bodies and tests pin them.
- **No secrets on the site.** The Stripe key is the publishable one, read from the server (`GET /config/web`), never stored in the site. Card numbers go to Stripe, never to NOHM. The server's secret key is the only thing that can charge.
- **`?api=` works on localhost only** (`app.js`): on nohm.app a link can't point the page at someone else's server.
- **Nothing is innerHTML.** `ui/dom.js` builds elements; text the person or the server supplies is always a text node.
- **Public routes send no token** (`auth: false`), so a stale token can't 401 the catalog.
- **Idempotency**: one key per draft, kept across retries, so a double tap or a 409 never makes two jobs.
- **401s**: only `SESSION_EXPIRED` (or a 401 without a code, from an older server) refreshes the token and resends; any other 401, such as a wrong text code, is the answer and is never sent twice (a resend would spend another of the code's attempts). A code starting `ACCOUNT_` (paused, blocked, deleted), on the 401 or on a 403 from `/auth/refresh`, signs the browser out and shows the server's message on a "You've been signed out" screen.
- **Server errors route like the app**: `PAYMENT_METHOD_REQUIRED` → card step, `PRICE_CHANGED` → reload pricing and ask again, `DUPLICATE_TRADE_REQUEST` → show the open job, `PRO_UNAVAILABLE`/`PRO_JUST_BOOKED` → pick again, 401 → sign in.

## Owner actions before it works on nohm.app

1. **CORS.** Set the server's `CORS_ORIGIN` to include `https://nohm.app,https://www.nohm.app` (it's a comma-separated env var; the code falls back to localhost only). No code change needed. The page never sends `X-NOHM-Context`, which CORS doesn't allow (`allowedHeaders: ['Content-Type', 'Authorization']` in `backend/src/main.ts`); a person with both homeowner and property-manager hats gets the server's default side on the web. To let the site pick the home side, the server change is that one line: `allowedHeaders: ['Content-Type', 'Authorization', 'X-NOHM-Context'],` (then the site can send `X-NOHM-Context: home`).
2. **Stripe and Google come from the server.** The page reads `GET /config/web` (`{ stripePublishableKey, googleClientId }`, from the server's `STRIPE_PUBLISHABLE_KEY` and `GOOGLE_CLIENT_ID`). If the call fails or a value is empty, the card step says card entry isn't available and the account step says Google isn't available; there is no fallback key in the site. For Google, add `https://nohm.app` to that client's authorized JavaScript origins.
3. **Apple sign-in** isn't on the web flow. It needs an Apple Services ID, a return URL and a server callback for the web; email and Google cover sign-up until then.
4. Run the full flow once against the real server before linking the page from the homepage hero. The site uses the live Stripe key, so a test card is refused: use a real account and card (the owner's), book a Standard job for a later day, then cancel it in the app inside the free window. It creates a real job and real texts, so it's the owner's run, not an automated one.

## Tests

```
node --test tools/book/*.test.mjs          # 15 unit tests, no browser
node tools/book/stub-server.mjs 8787 &     # then:
node tools/book/e2e.mjs                    # Standard, Express (card missing, reload), NOW; checks every body sent
SHOTS=/tmp/shots node tools/book/e2e.mjs   # the same, with a screenshot per screen
```

The stub answers the real response shapes but none of the real rules; it exists to drive the page. The e2e run can't exercise Stripe.js or Google (external scripts); the card step is verified up to the point where Stripe's iframe would mount, and the server-side `confirm-card` path is covered by the Express run (card absent → card step; card present → fee sent).

## Open issues

- **Multi-unit homes and claims** are sent to the app on purpose; the web could carry them later with the same endpoints.
- **Late-afternoon premium** is shown from a site constant (`WINDOWS[].premiumCents`, $20, matching `LATE_AFTERNOON_FEE` in `job-shared.ts`); the server doesn't publish it in `/config/pricing`. If that fee changes server-side, change `lib/format.js` too, or add it to the pricing map.
- **Tracking after booking** stays in the app. A `/book/job/:id` page that polls `GET /jobs/:id` would let the web show status; the pro's live location and chat are app-only for now.
