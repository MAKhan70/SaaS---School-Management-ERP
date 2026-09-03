# NASAQ Academic Systems

> Intelligent Systems for Smarter Campuses

Technical foundation for a multi-tenant School Management SaaS serving Indian educational trusts, schools, and campuses from pre-primary through Grade 12.

## Current status

This repository contains the multi-tenant foundation plus implemented vertical slices for authentication/onboarding, school setup, student information, admissions, attendance, examinations/reporting, fees, role-specific dashboards, analytics, responsible local assisted drafting, and the first shared slice of the operational module portfolio. Production integrations and dedicated high-risk operational aggregates remain intentionally separate.

It also includes the NASAQ platform control plane at `/platform/clients` for permission-protected client provisioning, per-tenant feature entitlements, master-administrator invitations, and time-bound audited client test access. See [the control-plane architecture](docs/architecture/PLATFORM_ADMIN_CONTROL_PLANE.md) and [Supabase deployment setup](docs/DEPLOYMENT.md#supabase-project-setup).

## Prerequisites

- Node.js 22 LTS
- pnpm 10+
- Docker Desktop (for PostgreSQL)

## Local setup

```bash
pnpm install
Copy-Item .env.example .env.local
docker compose up -d db
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:seed
pnpm dev
```

Open <http://localhost:3000>. Liveness is available at <http://localhost:3000/api/health>; database readiness is available at <http://localhost:3000/api/ready>.

For a private browser preview that stays on GitHub and connects to the Supabase starter database, follow [GitHub Codespaces Starter Preview](docs/STARTER_PREVIEW.md).

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm test:security
pnpm test:smoke
pnpm migrations:check
pnpm build
```

## Architecture at a glance

The initial system is a modular monolith in Next.js. Educational Trust is the tenant boundary; schools and campuses are nested operational scopes. Server-side services require an immutable tenant context, repositories apply explicit scope, composite foreign keys prevent tenant mismatch, and PostgreSQL row-level security provides database defense in depth.

Read [the architecture](docs/ARCHITECTURE.md), [security model](docs/SECURITY_MODEL.md), and [module roadmap](docs/MODULE_ROADMAP.md) before implementing a module.

## Important limitations

- Dashboard metrics are calculated by tenant-scoped server query services. Timetable, homework, lesson-plan, learning-resource, announcement, meeting, and task content remains a seeded non-authoritative read model until those source modules are implemented.
- Operational modules currently share a tenant-scoped work-record and immutable event kernel. Restricted modules store metadata only; clinical, payroll, safeguarding, identity-document, live-location, and other confidential payloads require their planned dedicated encrypted aggregates before production use.
- AI assistance is draft-only and uses a local mock provider in development. External providers, autonomous decisions, predictive student labels, and sensitive-attribute scoring are not enabled. See [Responsible analytics and AI](docs/RESPONSIBLE_AI.md).
- The production-readiness review permits synthetic-data staging only until the blockers in [Production Security Review](docs/SECURITY_REVIEW.md) are closed.
- Password-reset delivery is a port and requires an email provider before production use.
- MFA persistence and policy hooks are ready, but challenge enrollment and verification are not enabled yet.
- Report-card PDF generation is an adapter-backed queue and QR verification is a placeholder; no renderer, signing service, public verification endpoint, or object storage is connected.
- Background workers, object storage, external email/SMS integrations, and OpenAPI generation are designed but not connected.

## Common commands

| Command                   | Purpose                               |
| ------------------------- | ------------------------------------- |
| `pnpm dev`                | Start the local Next.js server        |
| `pnpm lint`               | Run ESLint with zero warnings allowed |
| `pnpm typecheck`          | Run strict TypeScript checking        |
| `pnpm test`               | Run Vitest once                       |
| `pnpm test:integration`   | Run PostgreSQL integration tests      |
| `pnpm test:e2e`           | Run Playwright browser journeys       |
| `pnpm test:security`      | Run focused security regressions      |
| `pnpm test:smoke`         | Run performance/accessibility smoke   |
| `pnpm test:watch`         | Run Vitest in watch mode              |
| `pnpm build`              | Create a production build             |
| `pnpm prisma:validate`    | Validate the Prisma schema            |
| `pnpm prisma:migrate:dev` | Create/apply development migrations   |
| `pnpm prisma:seed`        | Seed fictional development data       |
| `pnpm migrations:check`   | Check migration naming and safety     |
| `pnpm format:check`       | Check Prettier formatting             |
