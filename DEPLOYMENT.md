# IRONLOG Deployment Guide

This app is designed for free deployment from a GitHub repository using Vercel, Supabase, Razorpay, and OpenAI.

## Accounts You Need

- GitHub: stores the code.
- Vercel: hosts the site and serverless API routes.
- Supabase: sends email login links and stores auth users.
- Razorpay: accepts UPI/cards/netbanking and pays out to your bank account after KYC.
- OpenAI: powers the AI coach and meal photo scanner.

## 1. GitHub

Create a new GitHub repo, then push this folder:

```bash
git init
git add .
git commit -m "Deploy IRONLOG"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ironlog.git
git push -u origin main
```

## 2. Supabase Email Login

1. Create a Supabase project.
2. Go to Authentication > Providers > Email.
3. Enable email provider and magic links.
4. Go to Authentication > URL Configuration.
5. Add these redirect URLs:
   - `http://localhost:3000`
   - `https://YOUR_VERCEL_DOMAIN.vercel.app`
6. Copy `Project URL` and `anon public` key into Vercel env vars:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

## 3. Razorpay Payments

1. Create or log in to your Razorpay merchant account.
2. Complete KYC.
3. Add your settlement bank account or UPI details inside Razorpay.
4. Create API keys in Razorpay Dashboard.
5. Add these env vars in Vercel:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
6. Optional: create a webhook pointing to:
   - `https://YOUR_VERCEL_DOMAIN.vercel.app/api/razorpay-webhook`
7. Add the webhook secret to:
   - `RAZORPAY_WEBHOOK_SECRET`

The app creates Razorpay Orders for monthly `₹199` and yearly `₹2000`. Settlement goes to the bank/UPI configured in Razorpay, not to anything hardcoded in this repo.

## 4. OpenAI

Add these Vercel env vars:

```bash
OPENAI_API_KEY=sk-proj-your-key
OPENAI_MODEL=gpt-5-mini
```

The frontend calls `/api/coach` and `/api/analyze-food`. Those routes call OpenAI from the server so your key stays private.

## 5. Vercel

1. Go to Vercel > Add New Project.
2. Import the GitHub repo.
3. Framework preset: Other.
4. Output directory: `public`.
5. Add all env vars from `.env.example`.
6. Deploy.

## Production Checklist

- Replace test Razorpay keys with live keys.
- Confirm Razorpay KYC and settlement account are active.
- Verify Supabase redirect URLs match your final domain.
- Add Terms, Privacy, and Refund pages before public launch.
- Add legal/medical disclaimers for fitness and nutrition advice.
- Monitor OpenAI usage because "unlimited" AI chat still costs API money.
