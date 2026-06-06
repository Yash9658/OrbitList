# Operations Guide

## Environment separation

- Local development: `server/.env`
- Staging template: `server/.env.staging.example`
- Production template: `server/.env.production.example`

Keep staging and production secrets in the deployment platform, not in Git.

## Database migrations

Recommended release order:

1. Run `prisma migrate deploy`
2. Run smoke tests
3. Start the new app version

Do not use `prisma db push` in staging or production.

## Backups

Recommended backup policy:

- Daily full PostgreSQL backups
- Point-in-time recovery enabled if your provider supports it
- Retain at least 7 daily backups and 4 weekly backups

App script support:

- `npm run jobs:backup --workspace server`

The backup job writes custom-format `.dump` files into `DATABASE_BACKUP_DIR` and prunes files older than `DATABASE_BACKUP_RETENTION_DAYS`.

Example PostgreSQL backup command:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=orbitlist-$(date +%F).dump
```

Restore example:

```bash
pg_restore --clean --if-exists --dbname="$DATABASE_URL" orbitlist-YYYY-MM-DD.dump
```

## Scheduled jobs

Run these on a scheduler such as Render cron jobs, Railway cron, GitHub Actions schedule, or a VPS cron:

- `npm run jobs:cleanup --workspace server`
- `npm run jobs:reminders --workspace server`
- `npm run jobs:email-retry --workspace server`
- `npm run jobs:backup --workspace server`

Or run the maintenance bundle together:

- `npm run jobs:run --workspace server`

## Protected transaction foundation

The current production-safe transaction layer supports:

- protected buyer checkout
- seller handoff submission
- buyer review/completion
- admin dispute handling

What it does not yet automate:

- connected-account payouts
- true escrow release logic
- chargebacks/refunds through the payment processor

That means it is a strong operational foundation, but not yet a full regulated escrow system.

## Monitoring

- Sentry for server exceptions and tracing
- `/api/health` for uptime checks
- `/api/health/readiness/phase-1` for launch-safety readiness
- Log aggregation for structured JSON logs

## Phase 1 readiness

Run this before a staging or production release:

- `npm run readiness:phase1 --workspace server`

What it verifies:

- secure cookie auth requirements
- allowed CORS origin configuration
- cloud upload readiness
- live email readiness
- monitoring presence
- environment separation scaffolding

## Release checklist

1. `npm run build`
2. `npm run test --workspace server`
3. `npm run readiness:phase1 --workspace server`
4. `prisma migrate deploy`
5. Confirm `/api/health`
6. Confirm `/api/health/readiness/phase-1`
7. Verify login, listing creation, messaging, uploads, billing, and admin review flows
