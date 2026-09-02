# ADR-0004: Append-only audit and non-destructive records

- Status: Accepted
- Date: 2026-09-01

## Decision

Security-sensitive mutations emit immutable audit events in the same transaction. Material academic and financial changes are versioned, reversed, or corrected; hard deletion is not an ordinary use case.

## Consequences

Storage grows and retention/partitioning are required. Historical reconstruction and accountability improve. Audit payloads are allowlisted to avoid creating a shadow store of sensitive data.
