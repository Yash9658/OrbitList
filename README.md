# Social Profile Marketplace

A full-stack marketplace for buying and selling social media assets such as YouTube channels, Instagram pages, X accounts, TikTok profiles, Telegram communities, and similar digital properties.

## Structure

- `client/` React + TypeScript frontend
- `server/` Node.js + Express + TypeScript backend
- `shared/` shared types and constants
- `docs/` product and technical documentation

## Planned stack

- Frontend: React, Vite, React Router, TanStack Query, Zustand
- Backend: Node.js, Express, Socket.IO, Prisma
- Database: PostgreSQL
- Storage/Auth: Supabase
- Payments: Stripe

## Current status

This is the initial scaffold with:

- monorepo-style root structure
- starter React app and route layout
- starter Express API and Socket.IO server
- first-pass Prisma schema
- shared types and planning docs

## Local database

The project is configured to use a dedicated local PostgreSQL instance on port `5433`.

- Database name: `social_profile_marketplace`
- Username: `orbitlist`
- Port: `5433`

Useful commands:

```bash
npm run db:start --workspace server
npm run db:stop --workspace server
npm run prisma:generate --workspace server
npm exec --workspace server prisma migrate deploy
npm run prisma:seed --workspace server
```

Seeded login credentials:

- `seller@orbitlist.dev` / `Orbitlist123!`
- `buyer@orbitlist.dev` / `Orbitlist123!`
- `admin@orbitlist.dev` / `Orbitlist123!`
