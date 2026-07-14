# API And Payment Notes

## Why Keys Are Server-Side

The original prototype called an AI API directly from browser JavaScript. That exposes secrets to every visitor. This version moves AI calls into:

- `api/coach.js`
- `api/analyze-food.js`

The browser only calls your own `/api/...` endpoints.

## Auth requirement (added)

`api/coach.js` and `api/analyze-food.js` now require a valid, logged-in Supabase session —
every request must include `Authorization: Bearer <supabase access_token>`, and the server
verifies that token against Supabase before calling OpenAI. Previously these two routes had
**no check at all**, meaning anyone who found the URL (not just your app's users) could call
them directly, unlimited times, and run up your OpenAI bill. That hole is now closed.

## Razorpay Flow

1. User logs in with email.
2. App starts a 30-day free trial.
3. After trial, the app displays plan buttons.
4. User selects monthly or yearly.
5. `/api/create-payment` creates a Razorpay order.
6. Razorpay Checkout collects payment.
7. `/api/verify-payment` verifies the signature.
8. The browser stores a paid access marker.

**Known limitation — read before accepting real payments:** step 8 stores the "paid" marker only
in the browser's `localStorage`. There is no database recording who actually paid, so:
- A technically curious user can open dev tools and set their own "paid until" date for free —
  this does **not** grant them extra AI usage (that's now gated by login, per above), but it does
  unlock any UI-only "premium" features with zero payment.
- A genuine paying customer who switches browsers/devices, or clears site data, loses their
  "paid" status even though they paid — there's nothing server-side to restore it from.
- The Razorpay webhook (`api/razorpay-webhook.js`) currently only logs events; it doesn't write
  anywhere yet.

**The proper fix** is a `subscriptions` table in Supabase (user_id, plan, paid_until), written by
`verify-payment.js` and the webhook using a Supabase **service-role** key (never exposed to the
browser), and read on login to decide access. This is a real, scoped addition — say the word and
I'll build it before you turn on live Razorpay keys.

## Plan Prices

- Monthly: `₹199`
- Yearly: `₹2000`
- Trial: 30 days

## No-Limit AI Warning

The app UI does not set a user-facing question limit, but OpenAI charges by usage. Login is now
required to call the AI routes at all, which removes anonymous abuse, but a logged-in user still
has no per-day cap. In production, add a simple per-user daily counter (e.g., a Supabase row
incremented per call) to avoid surprise costs.

