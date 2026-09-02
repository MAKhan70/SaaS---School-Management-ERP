# ADR-0005: Typed job port and transactional outbox

- Status: Accepted
- Date: 2026-09-01

## Decision

Modules enqueue versioned, tenant-scoped jobs through an application port. A transactional outbox persists publication intent with business changes; a worker dispatches to the selected queue provider.

## Consequences

Jobs are retried safely through idempotency and observable state. The foundation avoids binding domain code to a queue vendor. Outbox cleanup, poison-message handling, and privacy-safe payload contracts are operational requirements.
