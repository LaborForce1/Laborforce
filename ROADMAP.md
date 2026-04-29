# LaborForce Master Implementation Roadmap

This roadmap is the practical path from the current LaborForce MVP to a production-grade marketplace stack. The guiding strategy is to finish MVP stability first, harden the backend and data layer next, add infrastructure pieces after that, and only do framework migrations when they clearly help the product.

## Phase 0: Current Position

LaborForce already has:

- Working MVP flows on web
- Expo mobile app present
- Express API present
- PostgreSQL present
- Render deployment blueprint present

LaborForce does not yet have:

- Next.js
- Prisma
- Redis/BullMQ
- Realtime sockets
- Production-grade third-party integrations
- AWS production architecture

## Phase 1: Finish MVP Product Stability

Goal: make employer and worker flows clean and dependable before deeper architecture changes.

Work:

- Merge current employer-flow cleanup.
- End-to-end test both roles.
- Fix validation pain points.
- Fix stale UI/data refresh issues.
- Clean seed/demo data.
- Tighten API response consistency.
- Remove remaining dead ends.

Done when:

- Employer can go signup -> profile -> verify -> post job -> review applicant -> message.
- Worker can go signup -> profile -> browse -> apply -> track -> message.

## Phase 2: Data Model And Backend Foundation

Goal: move from raw SQL and scattered types toward a cleaner backend core.

Work:

- Introduce Prisma alongside the current PostgreSQL schema.
- Model users, jobs, applications, messages, verification, and payments.
- Create migrations.
- Centralize shared domain types.
- Standardize API response shapes.
- Formalize status enums and transitions.
- Add better input validation coverage.
- Define role and permission rules for employee, employer, customer, and admin.

Done when:

- Prisma is the source of truth.
- Status transitions are enforced centrally.
- Data contracts are cleaner and safer.

## Phase 3: Queues, Jobs, And Async Work

Goal: support real product actions that should not happen inline in requests.

Work:

- Add Redis.
- Add BullMQ.
- Create `apps/worker`.
- Move background jobs into the worker:
  - Reminders
  - No-response alerts
  - Expiration jobs
  - Refunds/forfeits
  - Review requests
  - Notification fanout
  - Upload processing
- Add retry/failure handling.
- Add basic job dashboards/logging.

Done when:

- Async work is off the main API.
- Delayed and retryable events are reliable.

## Phase 4: Realtime Messaging And Notification Infrastructure

Goal: make chat and unread counts feel like a real marketplace.

Work:

- Add Socket.IO or WebSockets.
- Add realtime inbox updates.
- Add realtime unread counts.
- Add typing/read state later if useful.
- Hook messaging events into notifications.
- Connect background jobs to Twilio, SendGrid, and OneSignal.

Done when:

- Chat no longer depends on manual refresh patterns.
- Notification pipeline exists.

## Phase 5: Core Third-Party Production Integrations

Goal: replace MVP/dev-mode shortcuts with real production flows.

Work:

- Persona production verification.
- Stripe and Stripe Connect.
- Twilio SMS.
- SendGrid email.
- OneSignal push.
- Google Maps geocoding/location.
- Uploads to S3 or Uploadcare.
- Malware scanning before final storage.

Done when:

- Verification is real.
- Payments are real.
- Notifications are real.
- Uploads are safe.

## Phase 6: Frontend Architecture Upgrade

Goal: move from the current single-file Vite web app toward a scalable frontend.

Recommended order:

1. Split current `App.tsx` into feature components.
2. Migrate web to Next.js.
3. Add Tailwind.
4. Add TanStack Query.
5. Add React Hook Form and Zod on the frontend.

Why this order:

- Splitting components reduces merge conflicts now.
- Next.js migration is easier after modularization.
- Query and form libraries help more once screens are modular.

Target structure:

- `apps/web`
- `apps/api`
- `apps/mobile`
- `apps/worker`
- `packages/ui`
- `packages/types`
- `packages/config`
- `packages/utils`

Done when:

- Web is modular.
- State fetching is standardized.
- Forms and validation are cleaner.
- Team can work without constant file conflicts.

## Phase 7: Infrastructure Migration To AWS

Goal: move from Render-style MVP hosting to the target AWS setup.

Work:

- RDS PostgreSQL.
- ECS/Fargate or Elastic Beanstalk for API.
- Worker deployment.
- S3 for uploads.
- CloudFront.
- Secrets Manager.
- CloudWatch.
- Sentry.
- Environment separation:
  - Development
  - Staging
  - Production

Done when:

- Infrastructure is production-grade.
- Secrets, logging, and storage are centralized.

## Phase 8: Trust, Moderation, And Platform Hardening

Goal: make the marketplace safer and more operationally real.

Work:

- Audit logs.
- Admin moderation tools.
- Document encryption strategy.
- Abuse/rate-limit hardening.
- Suspicious activity review.
- Stronger permission boundaries.
- Sensitive-data handling policy.

Done when:

- Platform operations and trust controls exist.

## Phase 9: Growth And Reach

Goal: expand usability and retention.

Work:

- Spanish/i18n.
- Analytics with PostHog or Mixpanel.
- Low-signal/offline strategy.
- Better search if PostgreSQL becomes insufficient.
- OpenSearch only if really needed.

Done when:

- Platform is ready to scale to more users and markets.

## Practical Priority Order

1. Finish and merge employer-flow cleanup.
2. MVP stabilization sweep.
3. Prisma migration.
4. Redis + BullMQ + `apps/worker`.
5. Realtime chat.
6. Persona + Stripe production flows.
7. Web architecture split, then Next.js migration.
8. AWS migration.
9. Hardening, moderation, analytics, and i18n.

## Immediate Phase 1 Checklist

Current focus: make the MVP loop dependable enough for a small beta.

- [x] Route employer draft publishing through deposit checkout instead of direct publish.
- [x] Block production payment simulation when Stripe is missing.
- [x] Block production business-verification simulation.
- [x] Add missing job ZIP field to the web draft form.
- [x] Add a manual-admin production verification path for employers and workers.
- [x] Add Stripe webhook handling for completed checkout deposits.
- [x] Add a repeatable beta smoke script from signup through messaging.
- [ ] Add full Stripe webhook handling for failed payments, refunds, and subscriptions.
- [ ] Add API tests for employer signup, profile update, verification, job draft, deposit publish, worker apply, and messaging.
- [ ] Run the beta smoke script against the deployed Render environment.
- [ ] Remove or clearly label demo-only surfaces outside the beta scope.
- [ ] Normalize API response shapes for success/error messages.
- [ ] Clean seed data so beta accounts and demo data do not blur together.
