# Permission Model

## Model

Use permission-based authorization with roles as assignable bundles. A role name never authorizes an operation by itself. The decision is:

`principal + tenant membership + permission + resource scope + contextual policy -> allow/deny`

Permission keys follow `domain.resource.action`, for example `students.profile.read`, `attendance.session.mark`, and `finance.refund.approve`.

Identity and onboarding add `platform.dashboard.read`, `tenant.onboarding.manage`, and `identity.staff.invite`. They are evaluated by stable key and assignment scope; the corresponding role name is never consulted by authorization code.

The NASAQ control plane adds global `platform.clients.manage` and `platform.support.access`. They are granted only through `PlatformRoleAssignment`, separate from tenant assignments. Feature entitlements further intersect resolved tenant permissions; a role cannot use a module that the client has not been granted.

Dashboard experience selection uses `dashboard.admin.read`, `dashboard.principal.read`, `dashboard.teacher.read`, `dashboard.student.read`, `dashboard.parent.read`, and `dashboard.accountant.read`. Role names are never inspected. Teacher queries are additionally intersected with effective teaching assignments, student queries with the signed-in user's person/profile, and parent queries with effective guardian relationships and `LINKED_CHILDREN` scope.

## Scope hierarchy

- Trust-wide
- Selected schools
- Selected campuses
- Assigned classes/sections/subjects
- Self or linked children
- Explicit resource assignment

Narrower membership scope cannot be expanded by a role. The active request trust must match the resource trust.

## Starter role templates

| Role template        | Typical scope      | Illustrative permissions                                            |
| -------------------- | ------------------ | ------------------------------------------------------------------- |
| Trust administrator  | Trust              | institution configuration, membership administration, trust reports |
| School administrator | School             | academic setup, school users, operations, reporting                 |
| Teacher              | Assignment         | roster read, attendance mark, assessment entry, class communication |
| Student              | Self               | timetable, attendance, assignments, results                         |
| Parent/guardian      | Linked children    | child attendance/results, fee view/pay, communication               |
| Accountant           | School/campus      | fee plans, collection, reconciliation, finance reports              |
| HR                   | Trust/school       | staff records, leave, payroll inputs                                |
| Librarian            | Campus             | catalogue, issue/return, fines                                      |
| Transport staff      | Routes             | route/vehicle/stop operations and assigned rider safety data        |
| Hostel staff         | Hostel             | allocation, attendance, incident workflow                           |
| Nurse                | Campus             | minimum necessary health records and incidents                      |
| Security staff       | Campus/gate        | visitor and gate-pass operations; minimal identity fields           |
| Auditor              | Defined read scope | immutable reports and audit evidence                                |

Templates are starting points; dangerous combinations are restricted. Refund request/approval, payroll prepare/approve, role grant/audit, and result entry/publish should support separation of duties.

## Evaluation rules

1. Reject absent, expired, locked, or revoked sessions/memberships.
2. Resolve active tenant and scope from server-verified session state, never a client claim alone.
3. Require the permission key through active role assignments.
4. Require resource trust and institutional scope to intersect membership scope.

School setup uses `academic.structure.manage` for academic years, boards, terms, catalogues, calendars, facilities, grading, houses, numbering, copying, templates, and archival. Institution profile edits use `institutions.school.manage`; trust profile edits additionally require `institutions.trust.manage`. None of these decisions are inferred from a role name. 5. Evaluate contextual policies (ownership, assignment, status, time window, dual control). 6. Record sensitive allow/deny decisions with safe reason codes.

Student Information System operations use separate stable permissions: `students.profile.read`, `students.profile.write`, `students.enrollment.manage`, `students.guardian.manage`, `students.sensitive.read`, `students.sensitive.write`, `students.documents.read`, `students.documents.manage`, `students.bulk.import`, `students.data.export`, and `students.lifecycle.manage`. Health/demographic access, document downloads, exports, and lifecycle changes are never implied by ordinary profile read access.

Admissions uses `admissions.crm.read`, `admissions.crm.manage`, `admissions.forms.manage`, `admissions.application.review`, `admissions.application.convert`, `admissions.analytics.read`, and `admissions.documents.read`. Application decisions, student conversion, analytics, and private document access remain independent grants. Public submission creates only a validated school/year application and never grants CRM access.

Attendance uses `attendance.session.read`, `attendance.session.mark`, `attendance.session.manage`, `attendance.session.correct`, `attendance.session.lock`, `attendance.session.reopen.request`, `attendance.session.reopen.approve`, `attendance.classes.override`, `attendance.leave.request`, `attendance.leave.manage`, `attendance.status.manage`, `attendance.reports.read`, `attendance.staff.mark`, `attendance.staff.correction.request`, `attendance.staff.correct`, `attendance.staff.leave.request`, `attendance.staff.leave.manage`, `attendance.shift.manage`, and `attendance.device.ingest`. A teacher's school/campus grant is still intersected with an effective teaching assignment; only the separate class-override permission bypasses that contextual rule. A requester cannot approve their own attendance reopening or staff correction.

Examinations use `assessments.workspace.read`, `assessments.configuration.manage`, `assessments.marks.enter`, `assessments.marks.approve`, `assessments.marks.moderate`, `assessments.marks.lock`, `assessments.marks.reopen.request`, `assessments.marks.reopen.approve`, `assessments.results.calculate`, `assessments.results.publish`, `assessments.results.read.published`, `assessments.report.generate`, `assessments.report.template.manage`, and `assessments.assignments.override`. Entry, approval, locking, publication, and report generation are independent grants. Teacher scope is intersected with an effective subject/class assignment; a requester cannot approve their own moderation or reopening request.

Fees use `finance.fees.read`, `finance.fees.manage`, `finance.payments.collect`, `finance.adjustments.request`, `finance.adjustments.approve`, `finance.refunds.request`, `finance.refunds.approve`, `finance.reports.read`, `finance.reconciliation.manage`, and `finance.collection.close`. Collection, configuration, reporting, adjustment approval, refund approval, reconciliation, and closure are separate grants. A requester cannot approve their own adjustment or refund, and every operation is intersected with the active trust/school/campus scope.

The operational portfolio uses `operations.portfolio.read` only for navigation and a separate read/manage pair for each module. Examples include `timetable.schedule.read`/`timetable.schedule.manage`, `library.catalogue.read`/`library.circulation.manage`, `health.records.read`/`health.records.manage`, and `support.ticket.read`/`support.ticket.manage`. Portfolio access never grants a module implicitly. Every query and mutation still evaluates the module key and active trust/school/campus resource scope on the server.

Analytics and responsible assistance use `analytics.dashboard.read`, `analytics.data.export`, `analytics.support.read`, `analytics.support.review`, `ai.assistance.draft`, `ai.assistance.review`, and `ai.audit.read`. Dashboard read never implies export. Draft creation never implies review, and ordinary analytics access never reveals staff-only student-support indicators. Every decision remains intersected with verified institutional scope.

## UI behavior

Navigation is filtered for usability, but hidden UI is not a security control. Direct navigation renders an access-denied state; APIs return `403` without disclosing resource existence. `404` may be used where existence itself is sensitive.

## Administration safety

Role changes require explicit review, audit, reason, and session re-evaluation. Custom roles cannot grant permissions the assigning administrator lacks. Break-glass access is time-bound, separately monitored, and unavailable for routine support.

The executable evaluation order, effective-date handling, cache invalidation, and scope semantics are specified in [Permission Evaluation Design](architecture/PERMISSION_EVALUATION.md).
