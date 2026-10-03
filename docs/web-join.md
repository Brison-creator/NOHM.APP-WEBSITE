# Web sign-up for pros and renters: `/join` and `/join/renter`

The same NOHM sign-up the app uses, then each role's onboarding against the server. A pro can do the long part (profile, documents, Stripe identity, the Standard) from a desk; a renter accepts the landlord's invite in two codes. Jobs, shifts, estimates, rent and repairs stay in the app.

Branch: `web-booking` (with `/book`). Not merged.

## Pro: `/join`

| Step | Screen | Server |
|---|---|---|
| Account | Sign up with `role: CONTRACTOR` (phone: first, last, mobile, optional email → text code; or email: first, last, email, mobile, password → text code), or sign in. Same shared screen as `/book`. | `POST /auth/phone-signup/send-otp`, `/verify-otp` or `/auth/email-signup/send-otp`, `/verify-otp`; sign-in routes; then `GET /auth/me`, `GET /contractors/dashboard` |
| Invite code (optional) | Right after sign-up (and from the profile's "Have an invite code?" link): the code is prefilled if the server has an invite for this phone; look it up (who sent it), then accept. Only a pro account at the invited phone can accept; a refusal shows the server's message. Skip moves on. | `GET /contractor-invites/check-phone`, `GET /contractor-invites/code/:code`, `POST /contractor-invites/accept { inviteCode }` |
| Profile | Name, business name, main trade + optional second (from `GET /trades`), home ZIP, radius 10/20/30, years, license number, service call fee, hourly rate, bio. One save. | `PATCH /contractors/profile` (the full DTO: `firstName, lastName, businessName, baseZip, serviceRadius` always; `primaryTradeId, secondaryTradeId, bio, licenseNumber, yearsExperience, serviceCallFeeRange, hourlyRateRange` when filled) |
| Documents | Headshot and driver's license (needed before dispatch), trade license when the trade needs one, proof of insurance. Each uploads on pick; replace any time before review; rejected ones say why. Skippable. | `POST /contractors/documents` (multipart `file` + `docType`), `GET /contractors/documents` |
| Payouts | Opens Stripe Connect in a new tab; this page polls status every 5 s and moves on when Stripe reports complete. | `GET /stripe/connect/status`, `POST /stripe/connect/create` or `/refresh` |
| Agreement | The NOHM Standard (the site's own list from `/local-pros`), signed by typing the account name. | `POST /contractors/video-complete` (best effort), `POST /contractors/attestation` |
| Submit | Review with Edit links; the four server-checked items block the button until done (profile, trade, Stripe, attestation); documents don't. | `POST /contractors/submit-review` |
| Status | Under review / almost there / action required / approved / live, from the dashboard. Rejected documents are listed with the reviewer's note and can be re-uploaded when the server allows. | `GET /contractors/dashboard` |

Where a returning pro lands is decided by `proStepFor(dashboard)` in `lib/pro-flow.js` from the server's `applicationStatus` and `checklist`. Nothing about progress is stored on the site; a reload re-asks the server.

Stripe's return and refresh pages (`/stripe/return`, `/stripe/refresh`) are static and shared with landlords' rent payouts, so they claim nothing about status: back from Stripe, open the NOHM app to see where you are (or go back to the nohm.app tab, which has been polling). They link no app route: the app has no universal link and Android no `nohm://` scheme.

## Renter: `/join/renter`

| Step | Screen | Server |
|---|---|---|
| Account | Sign up with `role: TENANT`, using the phone the landlord has (the invite is matched to it). | auth routes, then `GET /tenants/my-property` |
| Invite | Invites for this phone are listed (address, landlord, rent, due day, start); or type the 6-digit code from the landlord's text. | `GET /tenants/my-invites`, `GET /tenants/invite/:code`, `POST /tenants/invite/:code/send-otp` |
| Confirm | The one-time code we texted. | `POST /tenants/invite/:code/accept {otpCode}` |
| Done | The home (with its HIN), the lease line, the landlord; rent, repairs and documents point to the app. | `GET /tenants/my-property` |

An account of the wrong kind (a homeowner on `/join`, a pro on `/join/renter`) is told so and offered sign-out; a role can be added to an existing account in the app.

## Files

```
public/join/
  index.html, renter/index.html   the two pages (<body data-join="pro|renter">), sharing /book/book.css + join.css
  join.css                        step bar, selects, document rows
  app.js                          state, navigation, refresh() from the server, role check
  lib/pro-flow.js                 proStepFor, submitBlockers, docsMissing, profileProblems/profileBody, statusCopy, attestationProblem
  lib/renter-flow.js              code checks, renterStepFor, inviteLine
  ui/pro-screens.js               profile, documents, payouts, agreement, review, status
  ui/renter-screens.js            invite, confirm, done
public/nohm/                      shared by /book and /join (moved out of /book in this change)
  http.js, session.js, api.js, dom.js, format.js, google.js, signup.js, account.js
tools/join/
  flow.test.mjs                   7 tests on the rules and bodies
  e2e.mjs                         headless Chromium: pro end to end (Stripe tab + poll), renter end to end, wrong account type
```

Also: `public/menu.js` (Join as a Pro), `public/pros/index.html` (hero button and the join section point to `/join`; the mailto form stays), `public/renters/index.html` (hero button → `/join/renter`), `tools/book/stub-server.mjs` (pro and renter routes).

## Security and rules

- The server owns the application state and dispatch eligibility; the site never claims a pro is approved or live except from the dashboard.
- Bodies are exactly the server DTOs (`forbidNonWhitelisted`); `profileBody` is tested field by field.
- Documents go to the server's multipart route, 10 MB, image or PDF; nothing is stored on the site.
- Stripe identity happens on Stripe's page in its own tab; the site only holds the link for the click.
- The Standard text is the site's own list; no policy is invented.
- Same `?api=` localhost-only rule, no innerHTML, no token on public calls, as `/book`.

## Owner actions

1. The same `CORS_ORIGIN` change as `/book`.
2. `STRIPE_CONNECT_RETURN_URL` / `STRIPE_CONNECT_REFRESH_URL` on the server should be `https://nohm.app/stripe/return` and `https://nohm.app/stripe/refresh` (they're empty in `.env.example`). The refresh page is static; a pro who lands there goes back to `/join`, which makes a new link.
3. Approving pros is still the admin panel's job (`PATCH /admin/contractors/:id/approve`, document review). Nothing here changes that.

## Tests

```
node --test tools/join/*.test.mjs
node tools/book/stub-server.mjs 8787 &   # then
node tools/join/e2e.mjs                  # SHOTS=/tmp/shots for screenshots
```

## Open issues

- **Phone-first sign-up** (same as `/book`): a pro or renter still needs an email and password. A server `/auth/phone-signup` would cut the account step to one field.
- **Pro invites** (`/contractor-invites/*`, the app's "did someone invite you" step) aren't on the web yet; the server auto-matches by phone, so an invited pro loses nothing by signing up here, only the "invited by" attribution. Easy to add as a step after the account.
- **The onboarding video** has no URL the site can play; `video-complete` is sent best-effort and the server treats it as optional.
- **License state, insurance details, EIN/W-9**: no contractor-facing endpoints exist; the review collects them. If the server grows them, add fields to the profile screen.
- **Approval status by text** is server-side; the status page says "we text you".
