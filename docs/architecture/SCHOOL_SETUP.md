# School setup and academic structure

## Scope and boundaries

The Educational Trust remains the tenant boundary. School and campus identifiers refine that boundary and are carried explicitly by every configuration repository operation. The setup module does not implement attendance, examinations, or fees.

`AcademicYear.schoolId` is optional only for backwards compatibility with the original trust-wide seed model. New setup operations always create school-scoped years. Services may read a legacy trust-wide year for an authorised school, but all new terms, periods, calendars, grading scales, and numbering rules retain an explicit `schoolId`.

## Configuration lifecycle

- Board, grading-scale, and numbering rules are versioned. Updates create a new version; historical versions are retained.
- Grades, sections, streams, departments, subjects, rooms, terms, periods, calendar entries, houses, and working-day rules use active/archive lifecycles.
- The setup API exposes no destructive delete operation. Foreign keys use `RESTRICT`, and unsafe removal is represented as archival with a required reason and immutable audit event.
- Future academic years begin in `PLANNED`. Copying a year creates a planned target and copies terms, weekly working-day rules, and periods. Term dates shift relative to the new start date; holidays are deliberately not copied because statutory dates vary by year.
- Active school-scoped academic years use a PostgreSQL exclusion constraint over inclusive date ranges. The application repeats the check to return a useful error, while the database remains the final concurrency-safe guard.

## Board support

`BoardType` supports CBSE, CISCE, Maharashtra State Board, other configurable State Boards, and custom school configurations. Board rules are JSON because their shape varies by board and version, but every write is validated as an object and recorded as an immutable audit event. The seed contains fictional CBSE and Maharashtra State Board examples; class and subject names remain tenant data.

## Calendar and time

Weekly working-day rules use ISO weekdays 1 (Monday) through 7 (Sunday). Dated calendar overrides distinguish working days, holidays, non-working days, and school events. Period boundaries are stored as integer minutes after local midnight; UTC remains the storage rule for event timestamps, while campus timezone supplies presentation context.

## Import and export

The authenticated template endpoints provide tenant-neutral CSV headers for grades, subjects, rooms, and holidays. Templates contain no operational or personal data. Bulk row ingestion is intentionally deferred until field-level preview, validation, duplicate handling, and transaction semantics are designed.

## Authorization and audit

The school setup workspace and mutation service require `academic.structure.manage` within the active trust and school scope. Profile edits additionally require institution permissions, and trust-profile edits require `institutions.trust.manage`. Every successful mutation writes an `AuditEvent` in the same transaction as the change. Database RLS protects every new tenant-owned table.
