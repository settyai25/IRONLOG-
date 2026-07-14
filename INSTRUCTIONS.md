# IRONLOG — Project Instruction Set
Generated from project chat history · current as of this handoff

This document captures everything decided, built, and fixed so far, so it can be handed to
yourself later, another developer, or another AI assistant without losing context.

---

## 1. Original goal

A single, self-contained fitness and nutrition platform that behaves like a personal trainer:

- Photograph a meal → AI identifies it and returns gram-precise nutrition (calories, protein,
  carbs, fat, fiber, key vitamins/minerals).
- Daily nutrient targets shown as **left-to-right progress bars** (amount taken / target / amount
  remaining) — not rings — for protein, calories, carbs, fat, and fiber.
- Both **veg and non-veg** food suggestions always available side by side; the user picks either,
  regardless of a saved default preference.
- **Sleep & Recovery** tracking: bedtime, wake time, quality → a computed recovery score, trended
  by week/month/year.
- **Workout logging**: type, duration, RPE, optional manually-entered fitness-band data (avg/max
  heart rate, calories) — no live band vendor integration exists (would need vendor OAuth).
- **AI Coach chat**: free-text questions (cutting, bulking, plateaus, recovery) answered with the
  user's real profile and today's logs as context.
- **Email + OTP login**, a profile that persists, and a **Growth tab** — charts only — showing
  weight trend, protein-adherence trend, and recovery trend over time.
- Eventually: monetization via **Razorpay** (₹0 trial / ₹199 monthly / ₹2000 yearly).

## 2. Two parallel codebases exist — know which one you're using

### A) Single-file version (`ironlog.html`)
Built first, entirely in this chat. One HTML file, vanilla JS, no backend.
- Storage: browser `localStorage`, namespaced per logged-in email.
- AI calls (food scan, diet plan, coach): call `api.anthropic.com` **directly from the browser**,
  using an Anthropic API key the user pastes into an in-app "AI settings" modal. The key is
  stored in that browser's `localStorage` only.
- Auth: email + on-screen OTP (demo-mode — there is no real mail server, so the code is shown on
  screen instead of emailed).
- Deployable as a static site (e.g. GitHub Pages) with no server at all.
- Includes a PWA manifest + service worker so it can be "installed" (Add to Home Screen) on
  mobile/desktop — this is not a native Play Store / App Store app.
- **Known limitation, by design**: the API key lives in the browser and is visible to anyone with
  access to that browser/device. Fine for personal, single-user use; not safe to share the link
  publicly with a key saved.

### B) Backend version (current, hardened — this is the one in the latest zip)
A different, larger build the user supplied (not generated in this chat originally), consisting
of a static frontend (`public/`) plus Vercel serverless functions (`api/`). This is the more
"real product" direction: Supabase auth, OpenAI-backed AI routes, Razorpay subscriptions.

```
public/index.html   — landing page + app shell (all in one HTML file)
public/styles.css    — all styling
public/app.js        — all frontend logic (tabs, state, API calls, Supabase client, Razorpay checkout)
api/config.js         — exposes Supabase URL + anon key to the frontend (anon key is meant to be public)
api/analyze-food.js   — food photo → nutrition, calls OpenAI, now requires login (see §3)
api/coach.js           — AI coach chat, calls OpenAI, now requires login (see §3)
api/create-payment.js  — creates a Razorpay order (server-side, uses Razorpay secret key)
api/verify-payment.js  — verifies Razorpay payment signature (server-side)
api/razorpay-webhook.js — receives Razorpay webhook events (currently only logs them, see §4)
api/_utils.js           — shared helpers, including the new requireSupabaseUser() auth check
vercel.json              — Vercel routing/config
package.json              — Node project manifest (type: module), no external deps needed (uses fetch)
.env.example               — placeholder env var names only, no real secrets
docs/DEPLOYMENT.md          — step-by-step Vercel + Supabase + Razorpay deployment guide
docs/API_AND_PAYMENT_NOTES.md — explains the auth/payment architecture and known gaps
```

This version needs **Vercel** (or an equivalent Node serverless host) — GitHub Pages alone cannot
run the `api/*.js` functions, since GitHub Pages only serves static files.

## 3. Security fix already applied — read this before doing anything else

When originally supplied, `api/analyze-food.js` and `api/coach.js` had **no authentication
check at all**. Anyone who discovered the deployed URL — not just the app's own users — could
call them directly, unlimited times, and run up the OpenAI bill with zero login required.

**Fixed**: added `requireSupabaseUser()` in `api/_utils.js`, which verifies the caller's bearer
token against Supabase's own `/auth/v1/user` endpoint before either route does anything. The
frontend (`public/app.js`) now sends `Authorization: Bearer <supabase access_token>` on both
calls, and shows "please sign in" if there's no session. This is already in the current files —
no further action needed for this specific gap.

## 4. Known limitation still open — decide before accepting real payments

"Paid" status is currently stored **only in the browser's `localStorage`**, not in any database.
Consequences:
- A paying customer who switches devices or clears site data loses access, even though they paid.
- A non-paying user can set their own "paid until" date via browser dev tools — this no longer
  grants extra AI usage (that's gated by login now, per §3), but it would unlock any UI-only
  premium features for free.
- `api/razorpay-webhook.js` currently only logs incoming events; it doesn't persist them anywhere.

**Recommended real fix** (not yet built): a `subscriptions` table in Supabase (`user_id`, `plan`,
`paid_until`), written by `verify-payment.js` and the webhook using a Supabase **service-role**
key (server-side only, never exposed to the browser), and checked on login/API calls to decide
real access. Flag this to whoever picks up the project next — do not go live with real Razorpay
keys until this is addressed, or accept the risk knowingly.

## 5. Deployment — quick reference

**Backend version (recommended path):**
1. Push the project files to a GitHub repo under `github.com/settyai25`.
2. Import that repo into Vercel (free Hobby tier) — Framework: Other, Output directory: `public`.
3. Add environment variables in Vercel from `.env.example`: Supabase URL/anon key, OpenAI key,
   Razorpay key/secret.
4. Deploy. Full walkthrough: `docs/DEPLOYMENT.md`.

**Single-file version, if used instead:**
1. Repo must be named exactly `settyai25.github.io` (GitHub Pages user site).
2. The app file must be named `index.html` at the repo root (this was the cause of an earlier
   404 — the file had been named `ironlog.html`).
3. Settings → Pages → Deploy from a branch → `main` → `/ (root)`.
4. Each user pastes their own Anthropic API key into "AI settings" inside the app for the AI
   features to work (see §2A limitation).

**Play Store / App Store**: not yet covered in depth in this project. Turning either version into
an installable "app" without a native rewrite means wrapping the PWA (e.g. via PWABuilder or
Capacitor/Trusted Web Activity for Android). Google Play Console has a one-time developer
registration fee (verify current amount on Google's site — it has changed over time and was not
confirmed as free). This is an open next step, not yet executed.

## 6. Design language, for consistency in future work

- Palette: near-black graphite background (`#12151a`), bone-white text (`#f2f0ea`), red accent
  (`#e14e3c`) for intensity/effort, green (`#6fbf73`) for recovery/good, amber (`#e0a93f`) for
  caution/remaining, blue (`#5c8ac9`) for data.
- Type: "Big Shoulders Display" for headings/numbers (condensed, athletic), "Inter" for body,
  "IBM Plex Mono" for data/stat labels.
- Tone: a decades-experienced personal trainer — direct, encouraging, practical, not clinical.

## 7. Open next steps, roughly prioritized

1. Decide whether to build the real Supabase `subscriptions` table before enabling live Razorpay
   keys (§4) — currently the single highest-impact fix for the backend version.
2. Add a per-user daily usage cap on the AI routes to control OpenAI cost exposure.
3. Decide which of the two codebases (§2) is the one going forward — they've diverged and
   shouldn't be developed in parallel.
4. If Play Store / App Store distribution is wanted, scope the PWA-wrapping step separately.
5. Cross-device data sync (currently local-only in both versions) would need a real database for
   user data, not just for payments.

---
*This document is a snapshot of decisions and fixes made through this point in the project. It is
not auto-updating — regenerate it after significant future changes if you want it to stay accurate.*
