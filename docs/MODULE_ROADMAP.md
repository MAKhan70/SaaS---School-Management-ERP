# Module Roadmap

## Delivery principles

Build thin, end-to-end slices with tenant isolation, permissions, audit, tests, and operability included. Phase gates are evidence-based; calendar estimates follow discovery.

## Phase 0 — foundation (current)

Planning artifacts, modular structure, CI, local database, shell, standard states, health check, and baseline test.

Exit: lint, strict typecheck, tests, and build pass; no claim of production readiness.

## Phase 1 — identity and tenant kernel

Trust/school/campus provisioning; Auth.js email/password; membership selection; sessions/revocation; permission engine; audit writer; Prisma repositories; PostgreSQL RLS; administrator membership UI; security integration tests.

Exit: automated cross-tenant negative tests and an audited, revocable administrator session.

## Phase 2 — institution and academic structure

Boards, academic years/terms, classes, sections, streams, subjects, curriculum mappings, staff assignments, localized reference data, import validation.

## Phase 3 — student information and admissions (implemented foundation)

Applicant workflow, students/guardians, enrollment and transfers, document policy, identifiers, archival, consent, bulk import with review/rollback.

## Phase 4 — daily academic operations (attendance foundation implemented)

Timetable, attendance, leave, homework/assignments, class communications, teacher/parent/student dashboards, notifications through the job/outbox infrastructure.

## Phase 5 — fees and finance

Fee structures, concessions, invoices/demands, collections, receipts, refunds, reconciliation, gateways, immutable ledger, maker-checker controls, exports.

## Phase 6 — assessments and reporting (foundation implemented)

Versioned assessment rules, assigned-subject marks entry, moderation, grading, immutable publication snapshots, report-card job abstraction, promotion recommendations, locked registers, and correction workflows. Production board packs and PDF rendering remain later vertical slices.

## Phase 7 — campus operations (shared first slice implemented)

The permission-driven operational portfolio, tenant-scoped work queue, immutable state events, synthetic module seeds, and responsive workspaces cover timetable, homework, lesson planning, library, transport, hostel, HR, leave, payroll integration, health, visitors, reception, inventory, certificates, alumni, communications, events, activities, discipline, documents, and support. Dedicated aggregates and production adapters still launch independently after privacy and operational discovery; see [Operational Module Plan](OPERATIONAL_MODULE_PLAN.md).

## Phase 8 — platform maturity (analytics and responsible assistance foundation implemented)

Tenant-scoped authoritative analytics, aggregate exports, data-freshness reporting, accessible charts, local draft assistance, deterministic fallbacks, explainable staff-review indicators, and immutable review evidence are implemented. A data warehouse, external AI/provider approval, configurable workflow builder, public integrations, SSO/MFA, mobile/PWA strategy, advanced observability, resilience, and regional scaling remain later slices.

## Recommended next slice

Promote timetable/substitutions from the shared operational record into dedicated conflict-checked timetable aggregates, then connect teaching assignments and the consent-aware notification outbox.
