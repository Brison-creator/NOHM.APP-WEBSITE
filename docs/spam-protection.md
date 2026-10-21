# Spam protection: the website side

The server runs the spam checks (Cloudflare Turnstile, its own rules, rate limits). The website adds two signals, says what the server answers, keeps AI training crawlers out, and discloses it in the Privacy Policy. Nothing on the site blocks a send: the server decides.

## `formTrap` on exactly these requests

Body field `formTrap: { hp: string, ms: number }`, next to `humanToken` (which is unchanged):

| Form | Request | Where |
|---|---|---|
| `/pro` (the flyer's short form) | `POST /recruit/interest` | `public/pro/pro.js` |
| `/rentals/?l=<slug>` Contact | `POST /listings/public/:slug/inquire` | `public/rentals/ui/listing-view.js`, body in `lib/listing.js` `contactBody` |
| Account screen on `/book`, `/join`, `/join/renter`: email sign-up, phone sign-up, Google's phone step, sign-in by text code, and "Send a new code" on each | `POST /auth/email-signup/send-otp`, `/auth/phone-signup/send-otp`, `/auth/social-signup/send-otp`, `/auth/login/send-otp` | `public/nohm/account.js` → `public/nohm/api.js` |
| Password sign-in | `POST /auth/login/email-password` | same |

No other request carries it: the server's whitelist refuses an unknown field with a 400. `api.js` takes it only as the last argument of those five calls; the verify calls, check-exists and Google sign-in have no place for it. `tools/book/form-traps.test.mjs` checks that list.

- **`hp`**: the value of a decoy text input. People never see it, so it's `''`; a bot that fills every field sends something.
- **`ms`**: whole milliseconds (`performance.now()`, rounded, never negative, at most 2147483647) from when the form was shown to the send. On the account screen the clock restarts each time a new step is drawn (sign-up ↔ sign-in, the code screen); "Send a new code" is timed from when the code screen appeared.

## The decoy (`public/nohm/form-traps.js`)

`addFormTrap(form)` (or `formTrap()` and its `el`) puts it last in the form, after the button, so a password manager never takes it for the username field.

- A `div` pushed off-screen (`position: absolute; left: -10000px; 1px × 1px; overflow: hidden`), not `display: none`, which bots skip. It adds no layout or sideways scroll.
- `aria-hidden="true"` on the wrapper; the input has `tabindex="-1"`, so screen readers and the keyboard never reach it.
- `<input type="text" name="nohm_extra_field" autocomplete="off">` inside a `<label>` reading "Leave this empty" (no `id`, so nothing clashes). The name has no word browsers or password managers fill (email, name, phone, address, company, website, url, fax…), plus the LastPass, 1Password, Bitwarden and Dashlane ignore marks.
- One per screen: the account screen keeps one decoy and moves it into whichever form is showing, so it never stacks and keeps a bot's value across steps.
- Built with `createElement`, never HTML strings.

## What the server can answer

- **400 `TRY_AGAIN`**: the server's message, where that form shows errors. Password sign-in used to turn every 400 into "That email and password don't match"; a `TRY_AGAIN` now shows the server's words.
- **400 `BAD_EMAIL`** (a throwaway address): under the email field on email sign-up, phone sign-up, password sign-in, `/pro` and rental Contact. Phone sign-up sends the email only with the code, so there it shows as the code screen's error, not under the code.

## Ship order

The server must take `formTrap` before this goes live. A server without it refuses every sign-up and sign-in from the site (`property formTrap should not exist`). The stub's legacy mode doesn't model that.

## robots.txt

`User-agent: * / Allow: /` and the sitemap stay. AI training crawlers get their own `Disallow: /` groups: GPTBot, ClaudeBot, anthropic-ai, Google-Extended, Applebot-Extended, CCBot, Bytespider, meta-externalagent, cohere-ai, cohere-training-data-crawler, Diffbot, Omgilibot. AI search and answer bots (OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, Claude-SearchBot, Claude-User) aren't named, so `*` lets them in and NOHM still comes up when someone asks an AI for a local pro. `tools/site/site.test.mjs` checks both lists, and that no blocked name would match a search bot's.

## Privacy Policy

`/privacy` section **I.1 Spam and Bot Protection** (last updated October 21, 2026): Turnstile on the forms that send a code, a message or an application (what Cloudflare processes, and a link to its privacy policy), and NOHM's own checks (the hidden field, the time a form took, per-network limits, throwaway emails, spam phrases, too many links), used only against spam and abuse. Keep it in step if a check is added or dropped.

## Tests

```
node --test tools/site/*.test.mjs tools/join/*.test.mjs tools/book/*.test.mjs tools/rentals/*.test.mjs
node tools/book/stub-server.mjs 8787 &   # then
node tools/join/e2e.mjs                  # /pro lead and the renter's send-otp carry formTrap; one decoy on /pro
node tools/book/e2e.mjs                  # run 14 (e2e/traps.mjs): decoy, tab order, TRY_AGAIN, BAD_EMAIL
node tools/rentals/e2e.mjs               # starts its own stubs: formTrap on the inquiry, TRY_AGAIN, BAD_EMAIL
```

Both stubs take `formTrap` only on these routes (a 400 anywhere else), check its shape, answer a filled decoy with `TRY_AGAIN`, and an `@mailinator.com` email with `BAD_EMAIL`. They don't judge `ms`: a headless run fills a form faster than a person.
