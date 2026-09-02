# Deployment

## Environments

Development uses Docker Compose and synthetic data. Staging must mirror production topology and security but use separate accounts, keys, buckets, domains, and databases. Production uses stateless web instances, managed PostgreSQL with PITR, private object storage, managed secrets, central logs/error monitoring, TLS ingress, and an edge rate limiter/WAF.

## Supabase project setup

The configured project reference is `cgfndruorxgoaucqkvxs`. Copy `.env.supabase.example` into the deployment secret manager, replace every placeholder, and never commit the populated file. Use the Supabase transaction pooler URL for `DATABASE_URL` and the direct TLS URL for `DIRECT_DATABASE_URL`; Prisma migrations must not run through transaction pooling.

```bash
supabase login
supabase link --project-ref cgfndruorxgoaucqkvxs
pnpm prisma:migrate:deploy
pnpm prisma:seed
supabase functions deploy send-client-invite
supabase secrets set RESEND_API_KEY=... SUPABASE_INVITE_FROM_EMAIL=...
```

Before the one-time seed, set `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_NAME`, and a strong `PLATFORM_ADMIN_PASSWORD` in the command environment. They bootstrap the NASAQ operator onto the synthetic internal sandbox account and are not persisted as configuration. Remove the password variable immediately after seeding and require a password change/MFA enrollment before production use. If these variables are omitted, the fictional operator has no usable password unless `DEMO_USER_PASSWORD` is deliberately set.

The supplied publishable key is committed only in the example catalogue because it is designed for public clients. Obtain the database password and service-role key from the project dashboard. Rotate either immediately if it is ever exposed. Apply the migrations with the project owner connection, then configure application traffic with the least-privileged `nasaq_app` role described in the tenant-isolation architecture; do not run web traffic as `postgres`.

Use `.env.staging.example` and `.env.production.example` only as key catalogues. Never copy placeholder values into a live environment or commit populated environment files.

## Identities and configuration

- `DATABASE_URL`: restricted runtime login, never owner/superuser, TLS required.
- `DIRECT_DATABASE_URL`: migration identity only; do not inject into web containers after migration.
- `APP_ORIGIN`: exact canonical HTTPS origin used for mutation-origin validation.
- `AUTH_SECRET` and `STUDENT_DATA_ENCRYPTION_KEY`: independent managed secrets, injected at runtime and rotated under an approved procedure.
- `OBJECT_STORAGE_BUCKET`: environment-specific private bucket. Upload capability stays disabled until the file-security blocker in `SECURITY_REVIEW.md` is closed.

Terminate TLS at an approved ingress, pin `Host`/`X-Forwarded-Host`, strip client-supplied forwarding headers, and pass the verified client address. Restrict database network access to application and migration workloads.

## Release sequence

1. Build from an immutable commit using `pnpm install --frozen-lockfile` and the Dockerfile.
2. Pass formatting, audit, migration checks, lint, typecheck, unit, integration, Playwright smoke/E2E, Prisma validation, and build gates.
3. Back up and create a recovery point. Test migrations on a recent sanitized production-size clone.
4. Scale down background mutations, run `pnpm prisma:migrate:deploy` once with the migration identity, and verify migration state.
5. Deploy the application with the runtime identity. Wait for `/api/health`, then `/api/ready` before routing traffic.
6. Run smoke tests, verify security headers/log ingestion/error capture, and watch latency/errors/database saturation.
7. Roll back application images if necessary. Never roll back schema by editing migration history; use a reviewed forward correction or restore only under the recovery runbook.

## Container

The runtime is non-root and exposes port 3000. The Docker health check uses liveness so a transient database outage does not restart every web process. The orchestrator must use readiness to remove instances from service. Run with a read-only root filesystem where supported and provide writable ephemeral storage only if a dependency demonstrably needs it.

## CSP rollout

The enforced CSP covers low-breakage `base-uri`, `object-src`, `frame-ancestors`, and `form-action` directives. Before adding `script-src` or Trusted Types, deploy report-only policies in staging, inventory Next.js inline scripts and integrations, filter PII/query strings from reports, and only then enforce a nonce/hash design.
