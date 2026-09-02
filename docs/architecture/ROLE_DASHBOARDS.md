# Role-specific dashboard architecture

## Boundary

`DashboardQueryService` is the reusable server-side query boundary. It validates date and institutional filters, resolves only schools and campuses present in the authenticated context, opens a transaction with the verified trust RLS setting, enforces the portal permission, and returns a presentation-ready view model. React components render values; they do not calculate major metrics or decide authorization.

## Experience selection and resource scope

Portal selection is deterministic from stable permission keys, never role names. Tenant-defined roles can therefore supply an existing portal permission without application changes. When multiple portal permissions are deliberately granted, the order is administrator, principal, teacher, student, parent, then accountant.

- Administrator, principal, and accountant queries are constrained by the active trust and selected authorized school/campus/year.
- Teacher queries include only effective `AttendanceTeachingAssignment` rows for the signed-in user; related sections drive timetable, attendance, gradebook, and feed queries.
- Student queries require self scope and resolve the student profile through `Person.userId` plus an active enrollment.
- Parent queries require linked-children scope and an effective `GuardianRelationship`; the selected child must be in that authorized set.

PostgreSQL RLS on `dashboard_feed_items` provides defense in depth. Composite foreign keys prevent a feed item from combining trust, school, campus, year, section, or student records from incompatible scopes.

## Sources and freshness

Enrollment, attendance, admissions, examinations, published results, fees, receipts, and approvals are calculated from their authoritative domain records. `DashboardFeedItem` is a read-optimized, non-authoritative bridge for modules not yet implemented as sources of truth: timetable, homework, lesson plans, learning resources, announcements, meeting requests, tasks, and operational alerts.

The service returns source and generation timestamps. The UI presents a stale warning when the newest contributing source is older than 24 hours. Empty collections are valid states and render an explicit domain-specific message.

## Extensibility

When a source module is implemented, replace that feed-kind query with its tenant-scoped repository projection while retaining the view-model contract. Do not duplicate source records in the feed or calculate metrics in client components.
