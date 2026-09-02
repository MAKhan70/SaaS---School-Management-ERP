# Tenant-Isolation Strategy

## Boundary

Educational Trust is the isolation boundary. School and campus refine authorization scope but never replace `trustId`.

## Defense layers

1. **Verified request context:** authentication resolves an immutable server-side `TenantContext`; client-supplied trust claims are never accepted without membership verification.
2. **Application services:** every tenant use case accepts context and evaluates permission and resource scope.
3. **Repositories:** repository APIs require context and include explicit `trustId` predicates. Unscoped tenant-data `findUnique(id)` methods are prohibited.
4. **Composite integrity:** tenant keys participate in child foreign keys so a row cannot reference another trust's school, campus, person, section, or profile.
5. **PostgreSQL RLS:** transaction-local `app.current_trust_id` policies deny tenant-table reads and writes outside the active trust, including queries that omit application filters.
6. **Restricted runtime role:** `nasaq_app` does not own the schema and cannot bypass RLS. Migrations run through a separate owner identity.
7. **Tests:** every tenant-data feature includes application-layer and RLS cross-tenant negative tests.

## Transaction pattern

`withTenant` validates context, opens a transaction, calls `set_config('app.current_trust_id', trustId, true)`, and performs the repository operation within that transaction. The `true` flag makes the value transaction-local, preventing a pooled connection from leaking tenant state to its next borrower.

Production database connections must use the restricted `nasaq_app`-equivalent login. Database owners or superusers are migration/operations identities and must never serve application traffic.

## Global tables

`Platform`, `Permission`, `User`, `UserProfile`, `Session`, authentication controls, and the minimal `UserTrustAccess` directory are global. Access to them still requires server authorization. `UserTrustAccess` contains only user/trust linkage and effective status so sign-in can select a trust before RLS context exists; school, campus, roles, and tenant-owned personal data are resolved only after setting that trust's transaction context. `Person` remains tenant-owned so personal data is never silently merged across trusts. System roles are globally readable templates; tenant roles and all assignments remain trust-scoped.

## Background work

Every job envelope carries `trustId`, actor/correlation metadata, and an idempotency key. Workers establish the same transaction-local tenant context before reading or writing. Job payloads must not carry more personal data than the handler requires.

## Failure behavior

Missing tenant context yields no tenant rows under RLS. Cross-tenant identifiers return `404` when existence is sensitive or `403` when the caller may know the resource exists. Denials are safely audited without leaking the other tenant's identifiers.

Admissions forms, applications, activities, follow-ups, documents, schedules, seat plans, and notification previews use forced RLS and composite trust/school foreign keys. The global public-form directory is the narrow exception: it contains only an opaque key and tenant routing identifiers, never applicant data. Public services resolve that key and establish transaction-local trust context before reading form definitions or writing submissions.

Attendance statuses, assignments, sessions, records, changes, approvals, leaves, shifts, devices, device events, and notification previews all use forced RLS. Composite foreign keys retain the trust/school/campus/academic-year chain. Attendance repositories never accept a client-selected trust, and integration workers must establish the device's verified trust context before event ingestion or processing.

Examination rules, assessments, subject offerings, components, registers, marks, change evidence, moderation/reopening requests, results, publication snapshots, templates, and generation requests all use forced RLS. Operational rows retain explicit school/campus/academic-year scope, and composite foreign keys reject cross-tenant or cross-school links. Report workers must establish the generation request's verified trust context before loading snapshots or persisting storage metadata.
