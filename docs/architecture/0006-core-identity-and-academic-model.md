# ADR-0006: Separate global identity from tenant-owned people and history

- Status: Accepted
- Date: 2026-09-01

## Context

Users can participate in multiple trusts, schools, and campuses, while personal records, school roles, guardian relationships, academic placement, and staff history belong to a tenant. A single current-school or current-role field would erase history and create cross-tenant privacy risk.

## Decision

Keep `User` and `UserProfile` global. Store a separate tenant-owned `Person`, with effective-dated `SchoolMembership`, `UserRoleAssignment`, `StudentEnrollment`, `GuardianRelationship`, and `StaffAssignment` records. Board rules use versioned `BoardConfiguration` rows, and academic placement always references an `AcademicYear` and `Section`.

## Consequences

The model supports multi-school users, different roles by scope, multiple guardians/children, transfers, and historical reconstruction. Queries are more explicit and require effective-date logic. Composite tenant foreign keys and RLS add schema complexity but materially reduce cross-tenant failure modes.
