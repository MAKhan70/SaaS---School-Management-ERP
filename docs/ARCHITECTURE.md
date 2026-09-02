# Architecture

## Style

Start as a modular monolith deployed as a Next.js application with PostgreSQL. This keeps transactions and development simple while module boundaries, domain events, repositories, and background-job ports retain an extraction path.

```text
Browser / mobile web
        |
Next.js App Router
  UI -> server actions/route handlers -> application services
                                      -> policy enforcement
                                      -> repositories -> PostgreSQL
                                      -> job port -> worker/queue
                                      -> file port -> private object storage
```

## Layers and dependency direction

- Presentation: routes and components. It formats view models and captures intent; it owns no business rules.
- Application: use cases, transaction orchestration, authorization requests, and ports.
- Domain: entities, value objects, invariants, policies, and domain events without framework imports.
- Infrastructure: Prisma repositories, authentication adapters, queues, storage, observability, and providers.

Dependencies point inward. Route handlers may call application services; repositories may implement application ports. Domain code never imports Next.js or Prisma.

## Tenancy and scoping

`Trust -> School -> Campus` is hierarchical. Every tenant-owned aggregate contains `trustId`; school/campus identifiers refine scope but never replace the trust boundary. A verified session produces an immutable `RequestContext` containing actor, trust, active school/campus, roles, permissions, session ID, and correlation ID.

Application services accept this context. Repository methods require tenant scope and never expose unscoped `findUnique(id)` operations for tenant data. Composite unique constraints include tenant identifiers. PostgreSQL row-level security will be added before production data as defense in depth, with transaction-local trust context and deny-by-default policies.

## Request lifecycle

1. Edge-safe request controls set correlation and security headers.
2. Server authentication verifies the session, revocation state, and selected organization.
3. Zod parses request input at the boundary.
4. The authorization service evaluates permission, resource scope, and contextual policy.
5. An application service runs the use case in a transaction when needed.
6. Security-sensitive mutations write an audit event in the same transaction.
7. The handler returns a consistent response/error envelope and structured logs without sensitive values.

## APIs

REST endpoints live under `/api/v1`; `/api/health` is an infrastructure exception. OpenAPI is generated from shared Zod contracts. Mutation endpoints use idempotency keys where duplicate submissions are harmful. Pagination is cursor-based for large records. Public contracts are versioned; internal services are not exposed directly.

## Background work

Application services publish jobs through a typed `JobQueue` port. Initial categories are notifications, bulk imports, report generation, scheduled operations, and outbox delivery. Jobs include tenant scope, actor/correlation metadata, schema version, idempotency key, attempt policy, and no unnecessary personal data. The transactional outbox prevents database updates from racing queue publication.

## Runtime topology

- Stateless Next.js web instances
- PostgreSQL primary with backups and point-in-time recovery
- Redis-compatible queue/rate-limit/cache service when asynchronous work begins
- Separate worker process built from the same repository
- Private, encrypted object storage accessed through short-lived authorized URLs
- Central logs, metrics, traces, error reporting, and alerting

## Reliability and performance

Health has liveness and, later, dependency-aware readiness variants. Set timeouts on external calls, retry only transient/idempotent work, and apply circuit breaking at unstable providers. Use server rendering by default, keep client components narrow, paginate large tables, and measure Core Web Vitals and API latency.

## Localization

Message keys live outside domain rules. Persist canonical codes and UTC instants; resolve locale, timezone, date format, numbering, and INR display at presentation boundaries. Never persist formatted currency as the source of truth; money uses integer minor units plus currency.

## Deployment progression

1. Local Docker Compose and single CI pipeline
2. Staging with managed database, secrets, storage, and observability
3. Pilot production with backups, runbooks, rate limits, RLS, security tests, and disaster-recovery validation
4. Selective extraction only when scale, ownership, or isolation data justifies a service boundary

See decisions in [`docs/architecture/`](architecture/) and the consolidated decision index in [DECISIONS.md](DECISIONS.md).

Core database strategies:

- [Data model and ER diagram](DATA_MODEL.md)
- [Database indexing](architecture/DATABASE_INDEXING.md)
- [Tenant isolation](architecture/TENANT_ISOLATION.md)
- [Permission evaluation](architecture/PERMISSION_EVALUATION.md)
- [Audit and retention](architecture/AUDIT_AND_RETENTION.md)
- [Authentication and tenant onboarding](architecture/AUTHENTICATION_AND_ONBOARDING.md)
- [Analytics and responsible assistance](architecture/ANALYTICS_AND_RESPONSIBLE_AI.md)
- [Seed-data design](SEED_DATA.md)
