# Assumptions

Last reviewed: 2026-09-01. Assumptions require product, legal, security, or institutional validation before the affected capability ships.

## Product and tenancy

- The educational trust is the contractual tenant and primary isolation boundary.
- Users may belong to multiple trusts and select one active organization per session.
- Schools and campuses require their own codes, branding, locale, calendar, and operating configuration within trust policy.
- A single deployment serves all supported boards; board behavior is configuration/version driven.
- The first production pilots will be India-hosted and use `Asia/Kolkata`, English, and INR defaults.

## Technology

- Node.js 22 LTS, pnpm, Next.js App Router, PostgreSQL, and Prisma are acceptable.
- A modular monolith is sufficient initially; no requirement currently justifies independent microservices.
- Managed PostgreSQL, object storage, secrets, and a Redis-compatible service will be available in hosted environments.
- Email/password is the first identity method; MFA and OIDC/SAML SSO are designed extension points, not foundation-release functionality.

## Data and compliance

- Aadhaar is not required for the initial product and will not be stored.
- Institutions are responsible for lawful basis and notices; the platform must supply controls, agreements, and evidence. This requires legal validation against applicable Indian law and board/state rules.
- Exact retention schedules, data residency, age-appropriate consent, record-transfer rules, and breach-notification obligations are unresolved.
- Academic and financial records are archived or corrected with history rather than hard-deleted.

## Operations

- Initial availability target assumption: 99.9% monthly, excluding announced maintenance.
- Initial recovery assumptions: RPO <= 15 minutes and RTO <= 4 hours; validate cost and institutional needs.
- Pilot scale assumption for design tests: 25 trusts, 200 schools, 500 campuses, 500,000 active students; load tests must replace these estimates.
- Integrations (payment gateways, SMS, email, biometrics, government/board systems) will use tenant-configured providers and asynchronous adapters.

## UX

- WCAG 2.2 AA is the target.
- Supported browsers will be current and previous major versions of Chrome, Edge, Firefox, and Safari; confirm device/browser reality in pilot discovery.
- Labels are translated from message catalogs; stored business codes remain locale-neutral.

## Foundation limitations

- Dashboard figures and identity are seeded demo fixtures and must never be confused with production records.
- The shell demonstrates role-filtered navigation only; it does not enforce authorization until the Phase 1 policy service exists.
- Health currently reports process liveness, not database readiness.
