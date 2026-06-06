# Deployment Guide

## Recommended split

- Frontend: Vercel
- Backend API: Render
- Database: managed PostgreSQL / Supabase Postgres
- Storage: Supabase Storage
- Payments: Stripe
- Monitoring: Sentry

This repo includes:

- `client/vercel.json` for React Router rewrites on Vercel
- `render.yaml` for the backend Render web service

## Frontend deployment

Deploy the `client/` app as a Vercel project.

- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Required frontend environment variable:

- `VITE_API_BASE_URL=https://your-api-domain/api`
- `VITE_SOCKET_URL=https://your-api-domain`

The included `client/vercel.json` rewrite ensures React Router routes resolve correctly.

## Backend deployment

Deploy the backend from the root repository using the included Render Blueprint.

Render settings from `render.yaml`:

- Build command: `npm ci && npm run prisma:generate --workspace server && npm run build --workspace server`
- Pre-deploy command: `npm exec prisma migrate deploy --workspace server`
- Start command: `npm run start --workspace server`
- Health check path: `/api/health`

Required backend environment variables:

- `PORT`
- `CLIENT_URL`
- `DATABASE_URL`
- `JWT_SECRET`
- `ACCESS_TOKEN_TTL_MINUTES`
- `REFRESH_SESSION_TTL_DAYS`
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAME_SITE`
- `ALLOWED_CORS_ORIGINS`
- `JSON_BODY_LIMIT_MB`
- `AUTH_RATE_LIMIT_WINDOW_MINUTES`
- `AUTH_RATE_LIMIT_MAX`
- `MESSAGE_RATE_LIMIT_WINDOW_MINUTES`
- `MESSAGE_RATE_LIMIT_MAX`
- `UPLOAD_RATE_LIMIT_WINDOW_MINUTES`
- `UPLOAD_RATE_LIMIT_MAX`

Optional but recommended:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SUPABASE_STORAGE_FOLDER`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_FEATURED_LISTING_PRICE_USD`
- `STRIPE_CURRENCY`
- `RESEND_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_TRACES_SAMPLE_RATE`

If `RESEND_API_KEY` is omitted, emails are written to the configured outbox instead of being sent live. Add Resend before a real public launch.

## Cookie settings for production

Use:

- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAME_SITE=none` when frontend and backend are on different hosted domains
- `AUTH_COOKIE_SAME_SITE=lax` only when frontend and backend are same-site

If frontend and backend use different domains or subdomains, set:

- `ALLOWED_CORS_ORIGINS=https://your-frontend-domain`
- `CLIENT_URL=https://your-frontend-domain`
- `AUTH_COOKIE_DOMAIN=.your-domain.com` when appropriate

## Stripe webhook

Set the Stripe webhook endpoint to:

- `https://your-api-domain/api/billing/webhooks/stripe`

## Deployment order

1. Push this repository to GitHub.
2. Create/confirm the production Postgres database.
3. Create/confirm Supabase Storage bucket for uploads.
4. Deploy backend on Render using `render.yaml`.
5. Set all required Render environment variables.
6. Confirm `https://your-api-domain/api/health` returns success.
7. Deploy frontend on Vercel with root directory `client`.
8. Set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` in Vercel.
9. Update Render `CLIENT_URL` and `ALLOWED_CORS_ORIGINS` to the final Vercel URL.
10. Redeploy backend after final URL changes.

## Smoke test after deploy

1. Open `/api/health`
2. Log in with a seeded or real account
3. Upload proof media
4. Create a listing
5. Open buyer-seller messaging
6. Complete a billing flow
7. Confirm logs and monitoring events appear
