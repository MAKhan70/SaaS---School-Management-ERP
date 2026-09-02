# ADR-0002: Trust-first tenant isolation

- Status: Accepted
- Date: 2026-09-01

## Decision

Educational Trust is the tenant boundary. Every tenant-owned record stores `trustId`. Service and repository APIs require verified tenant context; database row-level security becomes a second enforcement layer before production data.

## Consequences

Some data is intentionally denormalized with `trustId`, enabling clear indexing, constraints, policies, and incident analysis. Migrations and tests must prevent parent/child tenant mismatch. Global support access cannot bypass the same audited authorization path.
