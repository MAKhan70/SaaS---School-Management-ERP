# NASAQ Academic Systems — Coding Agent Guide

These instructions apply to the entire repository. More specific `AGENTS.md` files may add constraints for their directory, but they must not weaken the security, tenancy, data-integrity, or validation rules in this file.

## Product context

This repository contains a secure, modular, multi-tenant School Management SaaS platform for Indian schools. It supports CBSE, CISCE (including ICSE and ISC), and configurable Indian State Board workflows across educational trusts, schools, campuses, and branches.

The Educational Trust is the top-level tenant boundary. A trust may operate multiple schools, and a school may operate multiple campuses. The product serves pre-primary through Grade 12 and multiple role-specific portals. Build small, reviewable vertical slices; do not implement entire school modules speculatively.

## Working procedure

### Before editing

- Read `README.md`.
- Read the documents relevant to the task in `docs/`, including applicable architectural decisions in `docs/architecture/`.
- Inspect existing implementations before creating new components, services, schemas, utilities, or abstraction layers.
- Check `prisma/schema.prisma` before changing data models.
- Check the existing permission catalogue and `docs/PERMISSION_MODEL.md` before adding roles or permissions. Do not authorize behavior by role name alone.
- Inspect `package.json` and use the repository's actual scripts and package manager.
- Check for uncommitted or unrelated work and preserve it.
- Create a short task plan before making substantial changes.

### While editing

- Keep changes within the assigned scope and make them easy to review.
- Do not rewrite, reformat, or otherwise modify unrelated files.
- Do not introduce a dependency unless it is necessary and an existing dependency or platform capability cannot reasonably solve the problem.
- Reuse existing components, services, schemas, contracts, utilities, and patterns.
- Keep business logic out of React components and route handlers. Put it in the appropriate domain or application service.
- Maintain explicit tenant context (`trustId`, then `schoolId` or `campusId` where relevant) at service and repository boundaries.
- Enforce authentication, authorization, permissions, and resource scope on the server. Hidden UI controls are not authorization.
- Validate every external or untrusted input at the server boundary, using the existing Zod patterns.
- Add immutable audit events for security-sensitive mutations, ideally in the same database transaction as the mutation.
- Never display, expose, commit, or log secrets, credentials, tokens, Aadhaar numbers, sensitive student data, health details, or unnecessary personal identifiers. Mask sensitive identifiers where an approved use case requires display.
- Keep TypeScript strict. Avoid `any`; model unknown input as `unknown` and narrow it safely.
- Never use `@ts-ignore` without a nearby explanation of why it is unavoidable, the risk it contains, and how it will be removed. Prefer `@ts-expect-error` for a verified, intentional compiler error.
- Use database transactions for multi-record business operations and for changes that must remain consistent with audit or outbox records.
- Add comments only when they explain non-obvious business rules, security constraints, or architectural trade-offs. Do not narrate straightforward code.
- Preserve backwards compatibility for public APIs, events, persisted data, and supported workflows unless the task explicitly approves a breaking change and its migration path.
- Store timestamps in UTC and resolve tenant-local timezone and locale only at presentation boundaries. The initial default timezone is `Asia/Kolkata`.
- Keep user-facing copy translatable; do not embed English labels in domain rules.
- Never claim that behavior works unless the relevant automated validation has passed.

## UI standards

- Reuse existing shadcn/ui components and shared components before creating new UI primitives.
- Maintain mobile-first, responsive behavior across supported viewport sizes.
- Include meaningful loading, empty, error, disabled, and permission-denied states where the flow can enter those states.
- Use semantic HTML, accessible names and labels, visible focus states, keyboard-friendly controls, and sensible focus management.
- Keep page structure, spacing, validation, feedback, colour tokens, and interaction patterns visually consistent with the existing application shell.
- Use Indian terminology, INR currency formatting, tenant-configured date formats, and India-friendly number formatting where applicable.
- Do not hardcode tenant names, school names, campus names, academic years, boards, currencies, locale-specific labels, or permission decisions. Resolve them from configuration, tenant context, or translatable message catalogues.
- Do not use emojis in production application UI unless the task explicitly requests them.
- Keep client components narrow and keep privileged data and authorization decisions on the server.

## Database standards

- Every tenant-owned entity must include appropriate trust, school, or campus scoping. `schoolId` or `campusId` refines but does not replace the trust boundary.
- Every tenant-scoped query must explicitly apply verified scope. Do not expose unscoped repository methods such as tenant-data `findUnique(id)`.
- Use foreign keys, composite foreign keys where needed for tenant integrity, indexes, and uniqueness constraints to enforce invariants in the database.
- Add a migration for every schema change and update `docs/DATA_MODEL.md` when contracts or relationships change.
- Never silently edit, reorder, or delete migration history that may have been applied in another environment. Correct it with a new migration unless an approved, documented reset is explicitly in scope.
- Prefer soft deletion, archival, versioning, correction, or reversal for academic, attendance, examination, audit, and financial records. Avoid destructive hard deletion of historical records.
- Add `createdAt` and `updatedAt` timestamps to mutable entities.
- Add `createdBy` and `updatedBy` actor references where traceability is required; use append-only events where field-level history must be reconstructed.
- Use integer minor units and an ISO currency code for money. Do not persist formatted currency as the source of truth.
- Use transactions and database constraints for cross-record invariants. Application validation alone is insufficient.
- Validate Prisma changes with the repository command and add tenant-isolation database tests before declaring the change complete.

## Testing standards

For each completed task, add or update the layers of testing applicable to the changed behavior:

- Unit tests for domain rules, policies, validation, formatting, and isolated components.
- Integration tests for APIs, application services, repositories, database constraints, transactions, and provider adapters.
- Authorization tests for allowed and denied permission/resource-scope combinations.
- Tenant-isolation tests whenever tenant-owned data is read or mutated, including explicit cross-tenant negative cases.
- Playwright coverage for business-critical user journeys and browser-level regressions.
- Successful, invalid, unauthenticated, unauthorized, forbidden, conflict, and not-found scenarios where they are meaningful.
- Accessibility checks for critical UI flows where practical.

Do not delete, weaken, skip, or rewrite tests merely to obtain a passing result. Fix the underlying defect or document a genuine external blocker.

## Required validation

Before reporting completion, inspect `package.json` and run the repository's actual commands for every applicable category:

- Formatting
- Linting
- TypeScript checking
- Unit tests
- Integration tests
- End-to-end tests when relevant
- Prisma validation and migrations when the database changes
- Production build

The current baseline commands are:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use any dedicated integration or end-to-end scripts added to `package.json`; do not invent a passing substitute when a required script is absent. For schema changes, also run `pnpm prisma:validate` and the appropriate Prisma migration command against an approved development database.

If a command fails, investigate and fix the underlying issue. Report commands that could not be run and the specific reason; do not describe unexecuted validation as passing.

## Project layout

- `src/app`: Next.js routes, layouts, loading/error boundaries, and route handlers
- `src/components`: reusable presentation components
- `src/config`: navigation and application configuration
- `src/lib`: cross-cutting infrastructure helpers
- `src/modules`: bounded business modules with domain, application, and infrastructure layers when warranted
- `src/server`: authentication, authorization, persistence, jobs, logging, and HTTP concerns
- `prisma`: database schema, migrations, and seed entry point
- `docs`: product, architecture, security, permissions, data model, assumptions, and decisions
- `tests`: unit and integration tests
- `e2e`: Playwright tests for critical user journeys

## Completion report

At the end of every task, provide:

- Summary
- Files modified
- Database migrations, including `None` when no migration was required
- Tests added or updated
- Commands executed
- Validation results, clearly distinguishing passed, failed, and not run
- Assumptions
- Known limitations or unresolved risks
- Recommended next task
