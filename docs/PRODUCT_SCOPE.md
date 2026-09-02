# Product Scope

## Product promise

NASAQ Academic Systems gives Indian educational trusts one secure operating system for multiple schools and campuses while preserving each institution's academic structure, board requirements, language, and local operating practices.

## Supported institutional model

- Educational Trust is the SaaS tenant and billing/customer boundary.
- A trust owns one or more schools.
- A school operates one or more campuses or branches.
- Academic structure supports pre-primary through Grade 12, academic years, terms, classes, sections, streams, subjects, and configurable boards (CBSE, CISCE/ICSE/ISC, and Indian State Boards).
- Initial locales are English, Hindi, and Marathi; additional locale catalogs are configurable.

## Personas

Platform and trust administrators, school/campus administrators, teachers, students, parents/guardians, accountants, HR staff, librarians, transport and hostel staff, nurses, security staff, and auditors.

## Product domains

1. Platform, tenancy, identity, permissions, and audit
2. Institution and academic structure
3. Admissions, student information, guardians, and enrollment
4. Staff, HR, timetable, and substitution
5. Attendance, leave, communications, and notifications
6. Fees, concessions, collections, refunds, and finance integration
7. Assessments, examinations, grading, report cards, and board exports
8. Library, transport, hostel, health, visitors, and security
9. Documents, bulk imports/exports, reports, analytics, and integrations

## First-foundation release

In scope: architecture and security artifacts, development tooling, CI, local PostgreSQL, minimal tenant-aware data foundation, app shell, placeholder sign-in, demo dashboard, standard UI states, global error handling, health check, and one automated test.

Out of scope: production authentication, operational modules, payment collection, biometric integration, real notifications, file uploads, production deployment, student/staff personal data, and board-specific workflows.

## Non-functional targets

- No known cross-tenant access path; tenant scope is mandatory at every data boundary.
- WCAG 2.2 AA as the UI target.
- API operations are idempotent where retries are expected.
- Audit records for security-sensitive mutations are append-only.
- India-first formatting with UTC persistence and tenant-local presentation.
- Horizontal application scaling; state resides in PostgreSQL, object storage, cache, or job infrastructure.

## Success criteria for future releases

Measures will be finalized with pilot schools: weekly active users by role, attendance completion by cutoff, fee reconciliation accuracy, report-card generation success, notification delivery, support burden, performance percentiles, availability, and security/audit exceptions.
