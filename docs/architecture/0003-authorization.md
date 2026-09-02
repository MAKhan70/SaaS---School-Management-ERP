# ADR-0003: Permission- and scope-based authorization

- Status: Accepted
- Date: 2026-09-01

## Decision

Roles are permission bundles. Server-side decisions combine permission, membership scope, resource tenant/scope, and contextual policy. Deny is the default.

## Consequences

Role names may change without rewriting business logic. UI navigation may use the same permission catalogue for presentation but can never be the enforcement point. Policy tests become part of every use-case test suite.
