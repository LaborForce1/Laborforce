# LaborForce architecture

## Product rails

- `employee`: verified tradespeople, Proof Wall, job feed, Open to Work, certifications
- `employer`: verified businesses, deposit-backed listings, CRM, crew tools, premium back office
- `customer`: Quick Cash poster with escrow-protected one-off work

## Backend responsibilities

- `auth`: email/password auth, JWT access tokens, refresh tokens, Twilio phone verification entry point
- `verification`: Persona inquiry state, selfie checks, business documentation workflows
- `jobs`: local-first job listings with deposit-backed activation and expiry handling
- `quickCash`: customer posts, worker bids, escrow settlement, surge notifications
- `social`: Proof Wall and local trade community feed
- `crm`: premium Kanban pipeline and follow-up reminders
- `payments`: subscriptions, deposits, escrow, refunds, verification and boost fees
- `ai`: trade-aware assistant prompts and message persistence

## Next implementation milestones

1. Replace demo data with repositories backed by PostgreSQL queries or an ORM.
2. Add Stripe, Persona, Twilio, SendGrid, OneSignal, Uploadcare, and maps SDK clients.
3. Introduce background jobs for expiry, reminders, refund/forfeit automation, and review requests.
4. Add file malware scanning, refresh-token persistence, RBAC, and audit logging.
5. Expand web/mobile from shell screens into full route-based apps with auth state and forms.

