# New-pro training (on hold, not served)

Draft of `/train`: hands-on lessons where the trainee plays the pro and the
lesson plays the homeowner. Parked here (Amplify serves `public/` only) until
it's decided whether training runs on this web demo or on the real app on the
web (see `docs/DEMO-SERVER.md` in the app repo).

- `index.html`, `train.css`: the page and its layout (lesson list; steps beside
  the pro's phone on wide screens, above it on phones). `train.js` (the lessons)
  wasn't written yet.
- `demo-engine-training-mode.patch`: the changes to
  `public/how-it-works/demo.js` it needs: a `train` mode (always the pro; the
  phone says "Waiting on the homeowner" and hides the door code), change
  listeners, and `NohmDemo.sim` to play the homeowner's side
  (`git apply tools/drafts/train/demo-engine-training-mode.patch`).

Planned lessons (copy only from published pages: /pros, /step-in):
1. Take your first job (go on shift; 30 minutes to accept or pass)
2. Head out and arrive (a booked job unlocks an hour before its window)
3. The door code (nothing unlocks until it's entered)
4. Findings, then your price
5. Do the work, get paid
6. Express: 90 seconds to take it
7. When a card doesn't go through (the 30-minute pause)
8. NOHM Now: 60 for 60
9. When NOHM steps in (quiz: no-shows, safety, unapproved charges; the NOHM
   Standard keeps you in good standing)
