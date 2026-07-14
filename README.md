# IRONLOG

IRONLOG is a deployable fitness tracker and landing page built from the attached prototype. It includes:

- Landing page and responsive app shell
- Email magic-link login through Supabase
- 30-day free trial
- Razorpay checkout for `₹199/month` and `₹2000/year`
- Dashboard for macros, workouts, sleep/recovery, photos, and progress
- AI coach and meal-photo nutrition analysis through serverless OpenAI API routes

## Deploy For Free From GitHub

1. Create a GitHub repository and push this folder.
2. Create a free Supabase project. Enable Email auth and add your deployed URL in Auth redirect URLs.
3. Create a Razorpay merchant account. Complete KYC and add your bank account/UPI in Razorpay. That is where payouts go.
4. Import the GitHub repository into Vercel's free Hobby plan.
5. Add the environment variables from `.env.example` in Vercel Project Settings.
6. Deploy.

Full setup is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Local Development

```bash
npm run dev
```

Vercel CLI is needed for local serverless routes. You can also open `public/index.html` directly to preview the UI, but AI and payments need the API routes.

## Notes

Razorpay receives customer payments and sends payouts to the bank/UPI details configured in your Razorpay dashboard. Do not put bank account numbers, UPI IDs, Razorpay secrets, or OpenAI keys into frontend files.
