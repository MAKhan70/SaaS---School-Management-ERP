# Release Checklist

Mark each item with evidence. A waiver names the risk owner, reason, expiry, compensating control, and follow-up date. Security/privacy/tenant-isolation, data-integrity, restore, or migration failures cannot be waived by an engineer alone.

## Change control

- [ ] Scope, acceptance criteria, migration impact, threat/privacy impact, and rollback/forward-fix plan reviewed.
- [ ] No unrelated changes, secrets, real personal data, skipped tests, suppressed warnings, or unexplained dependency additions.
- [ ] API/event/data compatibility preserved or approved migration path communicated.

## Automated gates

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm format:check`
- [ ] `pnpm audit --prod --audit-level moderate`
- [ ] `pnpm migrations:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm prisma:validate`
- [ ] `pnpm prisma:migrate:deploy` on an isolated release database
- [ ] `pnpm prisma:seed` with synthetic data where applicable
- [ ] `pnpm test:integration`
- [ ] `pnpm build`
- [ ] `pnpm test:smoke` and the relevant full `pnpm test:e2e`

## Security and privacy

- [ ] Authentication, authorization, IDOR, tenant-isolation, validation, rate limit, export, audit, logging, and error paths reviewed for changed endpoints.
- [ ] Runtime database identity cannot bypass forced RLS; cross-tenant negative tests pass.
- [ ] Production secrets are managed, independent, rotated as required, and absent from image/logs/client bundles.
- [ ] Uploads remain disabled unless quarantine, signature/MIME checks, malware scanning, private storage, authorized download and retention controls are verified.
- [ ] Dependency/container/secret scans reviewed; no unexplained moderate-or-higher production advisory.

## Database and recovery

- [ ] Migration tested against a recent production-size sanitized clone; lock, duration, disk and compatibility impact recorded.
- [ ] Pre-deploy recovery point confirmed; PITR/restore drill is within schedule and RPO/RTO.
- [ ] New query plans and indexes reviewed with representative data; no unbounded interactive reads.

## Experience and operations

- [ ] Critical paths checked at 320/360/768/1280 px, 200% zoom, keyboard only, reduced motion, and target screen readers.
- [ ] Liveness/readiness, dashboards, alerts, structured-log ingestion, error monitoring and audit export verified in staging.
- [ ] On-call owner, runbooks, provider status, release/rollback authority, maintenance communication and post-deploy monitoring window confirmed.

## Go/no-go

- [ ] Product owner, engineering owner, security/privacy owner, database/operations owner and tenant liaison approve.
- [ ] Release identifier, image digest, migration list, evidence links, approvers, start/end time and outcome recorded.
