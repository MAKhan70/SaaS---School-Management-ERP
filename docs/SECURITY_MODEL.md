# Security Model

## Objectives

Protect children, families, staff, institutional operations, and financial records; prevent cross-tenant disclosure; preserve trustworthy academic and audit history; and provide evidence for incident response.

## Trust boundaries and threats

Internet clients, authenticated users, administrators, provider webhooks, job payloads, uploaded files, internal support access, and third-party integrations are untrusted until verified. Principal threats are broken object authorization, tenant-context confusion, privilege escalation, account takeover, unsafe bulk import/files, data export abuse, injection, audit tampering, and sensitive data in logs.

## Identity and sessions

- Opaque database sessions with built-in Node.js scrypt password hashes. Hashes are versioned so a later Argon2id migration can be performed without changing the authentication contract.
- HttpOnly, Secure, SameSite cookies; session identifiers are rotated and server-revocable.
- Organization selection is verified against active membership on every session refresh.
- MFA-ready challenge state and recovery controls; SSO/OIDC identities link to a user and still require tenant membership.
- Password reset, MFA change, role change, exports, and impersonation revoke or re-evaluate sessions.
- Password-recovery and email-verification tokens are random, short-lived, single-use, and stored only as keyed hashes. Recovery responses do not reveal account existence.
- Repeated failures are throttled by hashed identity/network keys and lock active accounts temporarily. Disabled, locked, and archived accounts fail with the same public credential error.
- Support impersonation, if introduced, requires approval, visible banners, short expiry, reason, and separate audit events.

## Authorization

Deny by default. Route middleware is convenience only; every server use case checks a permission and resource scope. Repository methods require tenant context. Sensitive operations add contextual controls such as four-eyes approval, academic-period status, ownership, or campus restriction.

## Data protection

- TLS in transit; managed encryption at rest; field-level encryption for approved high-risk fields.
- No Aadhaar storage by default. If a future legal use case is approved, store the minimum, tokenize/encrypt it, restrict purpose, and display only a mask.
- Private files use malware scanning, MIME/signature validation, size limits, random object keys, and short-lived URLs after authorization.
- Secrets come from a managed secret store, never Git or client bundles.
- Logs use allowlisted structured fields and redact credentials, tokens, student health details, and direct identifiers.

## Application controls

- Zod validation and output encoding; parameterized Prisma queries.
- CSRF protections appropriate to cookie-authenticated mutations and strict origin checks.
- Rate limits by IP, identity, tenant, and endpoint sensitivity; stricter limits for sign-in, reset, OTP, export, and search.
- Security headers: CSP rollout with nonces, HSTS in production, frame restrictions, content-type protection, and restrictive referrer policy.
- Dependency, secret, static-analysis, container, and license checks in CI as the delivery system matures.

## Audit

Security-sensitive actions write append-only audit events with tenant, actor, effective actor, action, resource, timestamp, request/correlation ID, source, outcome, and safe change metadata. Events are immutable to application roles, exported to tamper-evident retention, monitored, and never contain secrets or unnecessary sensitive values.

## Operations

Least-privilege production access, separation of duties, time-bound access, backup encryption and restoration drills, incident runbooks, key rotation, vulnerability response SLAs, and tenant-notification procedures are required before production. Availability and recovery targets are assumptions until agreed with pilot institutions.

## Verification gates before real data

Threat model review; tenant-isolation integration/property tests; authorization matrix tests; RLS policies and database tests; dependency and container scans; backup restoration; external penetration test; privacy/retention review; logging-redaction tests; and incident exercise.

The implemented transaction-local RLS approach is documented in [Tenant-Isolation Strategy](architecture/TENANT_ISOLATION.md). Audit payload and archival constraints are documented in [Audit Events, Retention, and Archival](architecture/AUDIT_AND_RETENTION.md).
