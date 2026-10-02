# InstaService: what they do, what we take, what we skip

Research notes from instaservice.com and a walk through their iOS app (October 2, 2026). Reference only; NOHM's copy and rules come from the NOHM Marketing Plan and the app.

## The business

- On-demand (within the hour) or scheduled home services in three categories: **Handyman, Plumbing, Cleaning**. ~48 fixed-price service pages, e.g. `/plumbing/emergency-plumbing-service-near-you`, `/handyman/tv-mounting-service`, `/cleaning/full-house-cleaning`.
- Claims 4.8/5 from 9K+ reviews, 50,000+ customers, 8,000+ pros, "all 50 states". SEO pages for every state and `/service-areas/{state}-{city}/{category}`.
- Pros: free to join, background check, Stripe Connect payouts within 48 h (24 h at 20+ jobs/week); pros carry their own insurance.
- Money: card charged after the service; a hold verifies the card. Cancellation: free up to 3 h before a scheduled job, $30 after; $30 to cancel on-demand once a pro is dispatched. Reschedule free up to 1 h before. Minimum 1 h. Book up to 7 days out. Weekend/holiday surcharges "indicated during booking".
- Extras: $30 sign-up credit, referral program, promo codes per service (FLOW30, HANDY9, SHINE20), tip the pro (5/10/15 %), gift a service, subscriptions for cleaning (monthly −20 %, bi-weekly −30 %, weekly −40 %), "Ask AI" tab, Quotes tab for custom work, Offers tab.

## Their app flow (from the screenshots)

1. Three onboarding slides → **phone number → 6-digit code** (no email, no password).
2. Map: "Your default location has been set to 72022" → Continue. iOS asks for always-on location.
3. **Personal details** form: first, last, email (+ "Verify"), mobile, referral code, state, "where did you hear about us" → Submit → confetti "+$30 credits".
4. **View All Services**: search bar, category chips (All / Cleaning / Handyman / Plumbing), list rows with photo, struck-through price, yellow price badge, "/hr", "with code FLOW30", Add button, More Details.
5. **Service page**: "Starts at ~~$270.00~~ $220.00", options (bathrooms 1–6, half baths, cleaning type), subscription plan, long description, what's included checklist, 3-step "how it works", "Gift this service", sticky Add To Cart.
6. **Cart**: items, Tip your pro, Order Summary (service, offer, tip, total), "temporary hold" note, terms line, Confirm Booking.
7. **Select Date and Time** sheet: Schedule / Instant Service toggle, month calendar, arrival window, "Priority fees apply to high-demand dates."
8. **Address**: map pin, ZIP, address, apartment, save as Home/Work/Family/Other.
9. **Pay**: Stripe sheet (Apple Pay, Link, Card, Bank) → Add card (number, MM/YY, CVC, country, ZIP, Link checkbox) → Confirm and Pay.

Roughly 9 screens and 20+ fields before a pro is assigned.

## What NOHM's `/book` takes from it

- One search pill at the top, category tiles under it, the deal price struck through (we show Express/NOW's regular fee struck through during launch pricing, from `/config/pricing`, never a hand-typed number).
- The three-step "describe → pick a time → connected" story, told by the flow itself instead of a graphic.
- A visible calendar sense: seven day chips and the four arrival windows, with closed windows disabled.
- Card on file with a "nothing is charged now" line; the server's own cancellation disclosure on the review screen.
- The sticky, single blue button per screen.

## What we deliberately don't copy

- **No cart, no tip, no promo codes, no subscriptions.** NOHM's price is the pro's estimate, approved in the app; the website only shows NOHM's own fee. Tips and codes would be invented policy (CLAUDE.md: don't invent policies).
- **No ZIP gate and no service-area pages.** NOHM never lists coverage areas; coverage follows pro onboarding.
- **No profile form** (referral, state, "where did you hear about us"). Sign-up is first name, last name, email, mobile, password, code. Phone-first sign-up (their best move) needs a server endpoint; see `docs/web-booking.md` open issues.
- **No always-on location.** The address comes from the person, through the same places lookup the app uses.
- **No $30 credit banner, no confetti.** NOHM awards credits server-side on booking; the site doesn't promise money.
- **No fixed per-service prices** ("Starts at $220"). NOHM's Standard is free to request; the pro's estimate comes later.
- Their fixed-scope catalog (TV mounting, furniture assembly) is a handyman model; NOHM's trades are licensed-trade first (HVAC, plumbing, electrical, appliance, roofing), so the catalog is the server's `/trades` list and the app's issue catalog, nothing more.

## Where they're better today, worth closing

1. **Phone + code sign-up** (one field) vs our five fields and a code.
2. **"Instant Service" toggle** on the schedule sheet: one tap switches on-demand ↔ scheduled. Ours is the Speed step; close enough, but a toggle on the review screen would be a nice shortcut.
3. **Apple Pay / Link** in the card step. Stripe's Payment Element could replace the card element in `ui/card.js` once the server's SetupIntent allows those methods (`payment_method_types: ['card']` today).
4. **A tracking screen on the web** after booking; ours sends people to the app.
