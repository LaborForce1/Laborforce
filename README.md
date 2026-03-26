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

## Beta launch focus

The current best beta scope is intentionally narrow:

- user signup and login
- employer job posting
- county-based location entry
- draft to publish flow with deposit handling
- worker job browsing
- verified-only direct messaging with SMS notification hooks

Leave these out of the beta pitch until they are fully wired:

- Quick Cash
- CRM automation
- social feed and Proof Wall
- AI assistant workflows
- marketplace and groups

## Next launch steps

1. Deploy the API and PostgreSQL to Render.
2. Deploy the web app to Vercel or Render.
3. Add real Stripe keys and test deposit checkout.
4. Add Twilio messaging credentials to turn on SMS alerts for new messages.
5. Invite a small beta group and watch the hiring flow.
6. Fix friction before expanding scope.

## Deploy to the web now

The repo now includes a Render blueprint at [render.yaml](/Users/michaelhantz/Desktop/laborforce/render.yaml).

Fastest path:

1. Push your latest code to GitHub.
2. In Render, click `New +` then `Blueprint`.
3. Connect the GitHub repo: `LaborForce1/Laborforce`.
4. Render will create:
   - `laborforce-db`
   - `laborforce-api`
   - `laborforce-web`
5. Set these two values in Render after the services exist:
   - `WEB_URL` on `laborforce-api` = your public web URL
   - `VITE_API_URL` on `laborforce-web` = your public API URL plus `/api`
6. Run the database init and seed commands in the Render API shell:

```bash
npm run db:init --workspace @laborforce/api
npm run db:seed --workspace @laborforce/api
```

Once that is done, your app will be live on the web instead of only on your laptop.
