# LaborForce

LaborForce is a monorepo scaffold for a verified blue collar workforce platform spanning:

- `apps/api`: Node.js + Express API with PostgreSQL schema and integration-ready services
- `apps/web`: React web client for onboarding, feeds, CRM, subscriptions, and dashboards
- `apps/mobile`: React Native / Expo client for iOS and Android flows
- `packages/shared`: shared domain types used across API and clients

## Current scope

This initial build provides:

- A production-minded data model and SQL schema for the core LaborForce entities
- JWT-based auth scaffolding with refresh-token support hooks
- Domain routes for users, jobs, Quick Cash, social feed, CRM, messages, reviews, AI, payments, and verification
- Web and mobile app shells wired to the same user-role model and feed concepts
- Integration modules for Stripe, Persona, Twilio, SendGrid, OneSignal, Uploadcare, Google Maps, and AI providers

## Quick start

1. Copy `.env.example` to `.env` and fill in your credentials.
2. Create the PostgreSQL database and run [`apps/api/src/db/schema.sql`](/Users/michaelhantz/Desktop/laborforce/apps/api/src/db/schema.sql).
3. Install dependencies:

```bash
npm install
```

4. Start each app in its own terminal:

```bash
npm run dev:api
npm run dev:web
npm run dev:mobile
```

## Database setup

If you already have PostgreSQL available, point `DATABASE_URL` at it and run:

```bash
PATH="$PWD/.tools/node/bin:$PATH" npm run db:init --workspace @laborforce/api
PATH="$PWD/.tools/node/bin:$PATH" npm run db:seed --workspace @laborforce/api
```

Seeded credentials:

- verified employer: `dispatch@northsidehvac.com`
- verified worker: `maria@laborforce.app`
- password for both: `LaborForce123!`

## Architecture notes

- Employers must be business-verified before posting jobs.
- Jobs and Quick Cash items are designed to be location-first and expiry-driven.
- Payments are modeled around Stripe deposits, escrow, subscriptions, and verification upsells.
- AI conversations are persisted with `conversation_id` values prefixed by `ai_chat_`.
- Personally sensitive verification data should remain encrypted and access-controlled in production.
