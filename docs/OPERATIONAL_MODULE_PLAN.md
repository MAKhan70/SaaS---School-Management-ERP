# Operational Module Plan

## Delivery approach

The operational portfolio ships as coordinated, incremental vertical slices. The first slice establishes a permission-driven module catalogue, tenant-scoped operational record and event kernel, server-side validation, immutable audit evidence, synthetic seeds, responsive workspaces, and negative tenant tests for every module. It does not pretend that one generic record replaces mature domain models: later slices promote each module to dedicated aggregates as its high-risk workflows are approved.

Educational Trust remains the tenant boundary. School and campus scope refine access. Health, HR, payroll, discipline, visitor, document, and support data use minimum-necessary summaries in shared views; confidential payloads require dedicated encrypted records before production use.

## Incremental sequence

1. Portfolio foundation: catalogue, permissions, tenant-scoped work queue, audit events, module pages, synthetic seeds, and tests.
2. Academic operations: timetable/substitutions, homework, lesson plans, announcements, events, clubs/houses.
3. People operations: HR, leave, payroll adapters, health, discipline, certificates, alumni.
4. Campus operations: library, transport, hostel, visitors, front desk, inventory, documents, help desk.
5. Production hardening: dedicated schemas, maker-checker controls, adapters, retention schedules, exports, accessibility audits, and load tests.

## Module specifications

### 1. Timetable and substitution management

- **Purpose:** Publish conflict-free class, room, period, and teacher schedules and arrange dated substitutions.
- **Users:** Administrators, principals, timetable coordinators, teachers, students, and parents.
- **Permissions:** `timetable.schedule.read`, `timetable.schedule.manage`, `timetable.substitution.manage`, `timetable.publish`.
- **Data entities:** Timetable version, slot, teacher allocation, room allocation, substitution request, substitution assignment, publication snapshot.
- **Workflows:** Draft schedule → conflict review → publish; absence reported → eligible substitute selected → notify → acknowledge.
- **Validation rules:** Academic-year/section/period scope must match; prevent teacher, section, and room overlaps; substitutes require effective staff assignments.
- **Audit requirements:** Publication, unpublication, override, substitution assignment, and acknowledgment.
- **Privacy risks:** Teacher absence reasons and student schedule visibility; expose only operational availability.
- **Dependencies:** Academic structure, periods, rooms, staff assignments, attendance, notification adapter.
- **APIs:** `GET/POST /api/v1/operations/timetable`, transition and conflict-preview operations.
- **UI pages:** Schedule board, version editor, conflict review, substitution queue, personal timetable.
- **Reports:** Teacher workload, room utilization, substitutions by period and teacher.
- **Tests:** Collision rules, publication permissions, teacher scope, tenant isolation, mobile timetable journey.
- **Acceptance criteria:** An authorized coordinator can publish a conflict-free version and assign an eligible substitute without exposing absence details.

### 2. Homework and assignment management

- **Purpose:** Assign, distribute, submit, review, and return class work.
- **Users:** Teachers, students, parents, learning coordinators.
- **Permissions:** `homework.assignment.read`, `homework.assignment.manage`, `homework.submission.manage`, `homework.review.manage`.
- **Data entities:** Assignment, audience, attachment reference, rubric, submission, submission version, feedback, extension.
- **Workflows:** Draft → publish → submit/resubmit → review → return; extension request → decision.
- **Validation rules:** Teacher must be assigned to the subject/section; due date must fall in the academic year; submission ownership is mandatory.
- **Audit requirements:** Publish, due-date change, extension decision, return, and post-return feedback changes.
- **Privacy risks:** Student work, feedback, plagiarism indicators, and attachments must not leak across students.
- **Dependencies:** Teaching assignments, sections, subjects, document storage, notifications.
- **APIs:** Assignment CRUD, publish, student submission, teacher review, authorized attachment download.
- **UI pages:** Class assignments, assignment editor, student work queue, submission detail, parent read view.
- **Reports:** Completion, overdue work, review turnaround, class submission distribution.
- **Tests:** Assigned-class enforcement, due-date validation, owner/guardian scope, private downloads, tenant isolation.
- **Acceptance criteria:** A teacher publishes to an assigned class and only the intended learners and linked guardians can read the work.

### 3. Lesson planning and syllabus tracking

- **Purpose:** Plan instruction against configurable syllabus outcomes and track coverage.
- **Users:** Teachers, heads of department, coordinators, principals.
- **Permissions:** `lesson.plan.read`, `lesson.plan.manage`, `lesson.plan.approve`, `syllabus.coverage.read`.
- **Data entities:** Syllabus version, unit, learning outcome, lesson plan, resource link, coverage entry, approval.
- **Workflows:** Map outcomes → draft lesson → review/approve → deliver → record coverage/reflection.
- **Validation rules:** Plans reference versioned board/school curriculum and effective subject assignments; coverage cannot exceed configured outcomes.
- **Audit requirements:** Approval, rejection, coverage correction, curriculum-version change.
- **Privacy risks:** Student-specific accommodations must remain in restricted student records, not ordinary lesson plans.
- **Dependencies:** Board configuration, subjects, teaching assignments, timetable, document management.
- **APIs:** Curriculum tree, plan CRUD, approval transition, coverage summary.
- **UI pages:** Syllabus map, weekly planner, approval queue, coverage dashboard.
- **Reports:** Planned versus delivered lessons, unit coverage, outcome gaps, approval aging.
- **Tests:** Version preservation, approval separation, assignment scope, coverage calculations, tenant isolation.
- **Acceptance criteria:** Approved plans remain tied to the curriculum version and historical coverage is preserved.

### 4. Library management

- **Purpose:** Manage catalogues, copies, circulation, reservations, and accountable fines.
- **Users:** Librarians, students, staff, accountants, administrators.
- **Permissions:** `library.catalogue.read`, `library.catalogue.manage`, `library.circulation.manage`, `library.fines.manage`.
- **Data entities:** Bibliographic item, copy/barcode, member account, loan, renewal, reservation, fine assessment, write-off.
- **Workflows:** Catalogue/acquire → issue → renew/return → fine/reversal; reserve → allocate → expire.
- **Validation rules:** Barcode uniqueness per trust; lending limits and calendars configurable; prevent issue of unavailable copies and duplicate active loans.
- **Audit requirements:** Issue, return correction, lost/damaged status, fine assessment/write-off.
- **Privacy risks:** Reading history and minors' interests are confidential and excluded from general analytics.
- **Dependencies:** Users/persons, school calendar, fees adapter, barcode integration.
- **APIs:** Catalogue search, copy management, issue/return, reservations, member ledger.
- **UI pages:** Catalogue, circulation desk, member account, reservations, stock verification.
- **Reports:** Overdue loans, circulation, inventory variance, fines outstanding.
- **Tests:** Availability, lending policy, idempotent scans, permissions, reading-history minimization, tenant isolation.
- **Acceptance criteria:** A librarian can issue and return an available copy atomically with a complete audit trail.

### 5. Transport management

- **Purpose:** Configure routes, stops, vehicles, drivers, attendants, riders, and safe trip operations.
- **Users:** Transport managers, drivers/attendants, administrators, parents, accountants.
- **Permissions:** `transport.route.read`, `transport.operations.manage`, `transport.rider.manage`, `transport.tracking.read`.
- **Data entities:** Route version, stop, vehicle, staff assignment, rider assignment, trip, boarding event, maintenance alert.
- **Workflows:** Plan route → assign vehicle/staff/riders → dispatch trip → record board/alight → close trip.
- **Validation rules:** Capacity cannot be exceeded; vehicle/staff credentials must be effective; pickup authorization is child-specific.
- **Audit requirements:** Route publication, rider changes, manual boarding corrections, vehicle/staff reassignment.
- **Privacy risks:** Live location, home stops, child movement, and guardian contacts require strict purpose limitation.
- **Dependencies:** Students/guardians, staff, fee transport head, notifications, optional GPS adapter.
- **APIs:** Routes/stops, assignments, trip dispatch/events, scoped guardian status.
- **UI pages:** Route planner, rider roster, dispatch board, vehicle register, parent trip status.
- **Reports:** Capacity, punctuality, ridership, missed scans, maintenance due.
- **Tests:** Capacity, guardian scope, trip idempotency, location minimization, tenant isolation.
- **Acceptance criteria:** Dispatch users see only assigned-trip data and guardians see only linked children's minimum-necessary status.

### 6. Hostel management

- **Purpose:** Manage buildings, rooms/beds, allocations, roll calls, leave, visitors, and incidents.
- **Users:** Wardens, administrators, students, parents, health/security staff.
- **Permissions:** `hostel.allocation.read`, `hostel.allocation.manage`, `hostel.operations.manage`, `hostel.incident.manage`.
- **Data entities:** Hostel/building, room, bed, allocation history, roll call, hostel leave, visitor approval, incident.
- **Workflows:** Allocate bed → check in → daily roll call/leave → transfer → check out/archive.
- **Validation rules:** One active bed allocation per student; capacity and gender/age policies configurable; leave requires approved guardian rules.
- **Audit requirements:** Allocation/transfer, roll-call correction, leave decision, incident access/change.
- **Privacy risks:** Residence location, movement, incidents, and health details are restricted.
- **Dependencies:** Students/guardians, health, visitor management, fees, notifications.
- **APIs:** Inventory/allocation, roll call, leave, visitor approval, incident metadata.
- **UI pages:** Occupancy board, allocation editor, roll call, leave queue, incident register.
- **Reports:** Occupancy, absence, leave, maintenance, incident counts.
- **Tests:** Double-allocation prevention, guardian permission, restricted incident access, tenant isolation.
- **Acceptance criteria:** Historical allocations remain intact and unsafe deletion is replaced by transfer or archival.

### 7. HR and staff records

- **Purpose:** Maintain effective-dated employment, position, qualification, document, and compliance records.
- **Users:** HR staff, administrators, principals, employees.
- **Permissions:** `hr.staff.read`, `hr.staff.manage`, `hr.sensitive.read`, `hr.compliance.manage`.
- **Data entities:** Staff profile, employment record, position, qualification, emergency contact, compliance check, document reference.
- **Workflows:** Pre-employment → active service → position/contract change → separation → archive.
- **Validation rules:** Employee numbers unique; assignments effective-dated; sensitive identifiers encrypted/masked; separation preserves history.
- **Audit requirements:** Profile access, contract/status change, sensitive-field access, document download.
- **Privacy risks:** Identity, bank, tax, salary, health, background-check, and emergency-contact information.
- **Dependencies:** Identity/person, staff assignments, documents, payroll, leave.
- **APIs:** Staff directory/profile, employment transitions, compliance checklist, private document access.
- **UI pages:** Staff directory, employment timeline, compliance queue, self-service profile.
- **Reports:** Headcount, joining/separation, contract expiry, compliance gaps.
- **Tests:** Masking, sensitive permission, effective dates, archival, tenant isolation.
- **Acceptance criteria:** Ordinary staff readers cannot access payroll, health, bank, tax, or restricted compliance data.

### 8. Leave management

- **Purpose:** Configure leave policies and balances and process student/staff leave requests.
- **Users:** Employees, parents/students, managers, HR, attendance officers.
- **Permissions:** `leave.request.manage`, `leave.team.read`, `leave.request.approve`, `leave.policy.manage`.
- **Data entities:** Leave type, policy version, entitlement, balance transaction, request, approval step, attachment reference.
- **Workflows:** Request → validate balance/overlap → approve/reject/cancel → attendance integration → correction.
- **Validation rules:** No overlapping approved leave; policy and working-day calculation versioned; requester cannot self-approve where separation is required.
- **Audit requirements:** Decisions, balance adjustments, policy publication, cancellation and correction.
- **Privacy risks:** Medical/supporting documents and leave reasons are minimum-necessary and restricted.
- **Dependencies:** Attendance, staff/student identity, school calendar, notification adapter, payroll export.
- **APIs:** Policies, balances, requests, approval queue, calendar summary.
- **UI pages:** My leave, team calendar, approval queue, policy editor, balances.
- **Reports:** Balance, usage, absenteeism, approval aging, leave liability export.
- **Tests:** Overlaps, balance math, dual control, sensitive reason masking, tenant isolation.
- **Acceptance criteria:** Approved leave updates attendance-facing status without rewriting historical balance transactions.

### 9. Payroll integration-ready module

- **Purpose:** Prepare auditable pay-period inputs and exports without becoming a payroll processor or storing payment credentials.
- **Users:** HR, payroll preparers, payroll approvers, accountants, auditors.
- **Permissions:** `payroll.input.read`, `payroll.input.manage`, `payroll.export.approve`, `payroll.export.download`.
- **Data entities:** Pay period, earning/deduction code, staff input, validation issue, approval, immutable export snapshot, adapter run.
- **Workflows:** Open period → collect attendance/leave inputs → validate → approve → generate encrypted export → acknowledge provider result.
- **Validation rules:** Integer paise plus INR; frozen periods immutable; preparer cannot approve own export; idempotent adapter runs.
- **Audit requirements:** Input change, approval, export generation/download, provider acknowledgment, correction period.
- **Privacy risks:** Salary, bank/tax identifiers, deductions, and garnishments are highly restricted and excluded from logs.
- **Dependencies:** HR, attendance, leave, finance codes, secure file adapter.
- **APIs:** Periods, scoped inputs, validation, approval, export adapter/status.
- **UI pages:** Pay-period workspace, validation issues, approval queue, export history.
- **Reports:** Input variance, unresolved issues, period totals, adapter reconciliation.
- **Tests:** Decimal/minor-unit rules, dual control, frozen periods, idempotency, restricted downloads, tenant isolation.
- **Acceptance criteria:** The system produces an immutable approved integration snapshot and never stores bank credentials or executes salary payments.

### 10. Health and infirmary records

- **Purpose:** Record minimum-necessary health alerts, visits, treatment consent, medication administration, and referrals.
- **Users:** Nurses, authorized health staff, administrators for aggregate safety reporting, guardians for linked-child summaries.
- **Permissions:** `health.alert.read`, `health.records.read`, `health.records.manage`, `health.medication.administer`.
- **Data entities:** Health alert, visit, symptom code, observation, consent, medication order/administration, referral, access event.
- **Workflows:** Triage → consent check → record care → notify/referral → follow-up → restricted closure.
- **Validation rules:** Clinical free text encrypted; medication administration requires order/consent and dose/time; emergency override is reasoned and audited.
- **Audit requirements:** Every record access, creation/change, emergency override, download, and disclosure.
- **Privacy risks:** Special-category health and disability data; never expose in general dashboards, analytics, URLs, or client logs.
- **Dependencies:** Student/staff persons, guardians, emergency contacts, document storage, notifications.
- **APIs:** Restricted alerts, visit write/read, medication administration, aggregate de-identified reports.
- **UI pages:** Infirmary queue, restricted health record, medication schedule, consent status.
- **Reports:** De-identified visit counts, incident trends, medication due/missed; no unrestricted person-level export.
- **Tests:** Encryption, access audit, emergency override, guardian minimum view, export denial, tenant isolation.
- **Acceptance criteria:** Health details are encrypted and visible only through purpose-bound, audited permissions.

### 11. Visitor management

- **Purpose:** Pre-register, verify, admit, monitor, and check out visitors and contractors.
- **Users:** Security staff, reception, hosts, administrators.
- **Permissions:** `visitors.visit.read`, `visitors.visit.manage`, `visitors.approve`, `visitors.reports.read`.
- **Data entities:** Visit request, visitor identity token, host, purpose, approval, badge, gate event, watch-list match.
- **Workflows:** Pre-register/walk-in → host approval → identity verification → badge/check-in → check-out/expiry.
- **Validation rules:** Minimize identity capture; badge unique while active; child pickup requires guardian/pickup authorization; deny expired approvals.
- **Audit requirements:** Identity access, approval/denial, watch-list decision, check-in/out correction.
- **Privacy risks:** Government identifiers, photographs, movement, watch lists; store hashes/masked references where possible.
- **Dependencies:** Persons, guardians, staff directory, front desk, security notifications.
- **APIs:** Registration, approval, check-in/out, host lookup with minimum fields.
- **UI pages:** Gate queue, preregistration, badge issue, active visitors, visit detail.
- **Reports:** Visit volume, overstays, denied entries, contractor presence.
- **Tests:** Badge uniqueness, pickup scope, minimum host lookup, throttling, tenant isolation.
- **Acceptance criteria:** Security can process a visit without exposing full student/staff directories or retaining unnecessary identity images.

### 12. Front desk and reception

- **Purpose:** Coordinate enquiries, calls, appointments, deliveries, student pickup, and reception hand-offs.
- **Users:** Receptionists, administrators, security, staff hosts.
- **Permissions:** `reception.queue.read`, `reception.queue.manage`, `reception.pickup.manage`, `reception.delivery.manage`.
- **Data entities:** Reception ticket, call log metadata, appointment, delivery, pickup request, hand-off event.
- **Workflows:** Log request → verify/contact assignee → hand off/reschedule → resolve; verify pickup → release/deny.
- **Validation rules:** Pickup requires active authorization; call notes exclude unnecessary sensitive detail; delivery custody events are append-only.
- **Audit requirements:** Pickup decision, directory lookup, custody transfer, restricted-note access.
- **Privacy risks:** Contact details, student presence, pickup arrangements, and visitor identity.
- **Dependencies:** Visitors, guardians, staff directory, admissions, help desk, notifications.
- **APIs:** Reception queue, appointments, deliveries, pickup verification.
- **UI pages:** Reception board, appointment calendar, pickup queue, delivery register.
- **Reports:** Request volume, wait time, unresolved hand-offs, delivery aging.
- **Tests:** Pickup authorization, directory minimization, queue permissions, tenant isolation.
- **Acceptance criteria:** Reception can resolve operational requests without receiving broad access to student or staff profiles.

### 13. Inventory and asset management

- **Purpose:** Track items, assets, locations, custodians, stock movements, maintenance, and disposal.
- **Users:** Storekeepers, administrators, department heads, accountants, auditors.
- **Permissions:** `inventory.item.read`, `inventory.item.manage`, `inventory.transaction.manage`, `inventory.disposal.approve`.
- **Data entities:** Catalogue item, asset, location, stock ledger entry, custody assignment, maintenance job, disposal request.
- **Workflows:** Receive → label → issue/transfer/return → maintain → approve disposal → archive.
- **Validation rules:** Stock ledger append-only; quantity cannot go negative without authorized adjustment; asset tag unique; disposal requires approval.
- **Audit requirements:** Stock adjustment, custody change, valuation change, disposal decision.
- **Privacy risks:** Custodian association and device data; do not store user files or device secrets.
- **Dependencies:** Campuses/rooms/departments, staff, finance export, barcode adapter.
- **APIs:** Catalogue/assets, stock transactions, custody, maintenance, disposal.
- **UI pages:** Inventory dashboard, issue/return desk, asset detail, stocktake, disposal queue.
- **Reports:** Stock on hand, valuation, custody, maintenance due, variance, disposal.
- **Tests:** Ledger balance, concurrency, idempotent barcode scans, approval, tenant isolation.
- **Acceptance criteria:** Every quantity change is reconstructable from immutable ledger entries.

### 14. Certificate generation

- **Purpose:** Request, approve, generate, verify, reissue, and revoke official school certificates.
- **Users:** Students/parents, office staff, administrators, authorized signatories.
- **Permissions:** `certificates.request.manage`, `certificates.issue.manage`, `certificates.approve`, `certificates.verify.manage`.
- **Data entities:** Certificate type/version, template, request, data snapshot, approval, issuance, verification token, revocation/reissue.
- **Workflows:** Request → validate prerequisites → approve → render/sign adapter → issue → verify/revoke/reissue.
- **Validation rules:** Unique certificate number; immutable issued snapshot; no silent edits; public verification reveals minimum fields.
- **Audit requirements:** Data access, approval, issue/download, verification, revocation, reissue.
- **Privacy risks:** Official identity, academic history, signatures, QR verification metadata.
- **Dependencies:** Student/staff records, enrollment, results, documents, PDF/signing adapter.
- **APIs:** Types/requests, approval, generation adapter, authenticated download, public minimal verification.
- **UI pages:** Request centre, issuance queue, preview, certificate history, verification result.
- **Reports:** Requests, turnaround, issuance, revocation, expiring credentials.
- **Tests:** Snapshot immutability, number uniqueness, minimum public response, permissions, tenant isolation.
- **Acceptance criteria:** Reissue and correction append new evidence while preserving the originally issued artifact.

### 15. Alumni management

- **Purpose:** Maintain consent-based alumni status, contact preferences, engagement, events, and transcript/certificate requests.
- **Users:** Alumni officers, authorized administrators, alumni self-service users.
- **Permissions:** `alumni.profile.read`, `alumni.profile.manage`, `alumni.communication.manage`, `alumni.reports.read`.
- **Data entities:** Alumni profile, graduation cohort, contact preference, consent, engagement, request, communication segment.
- **Workflows:** Graduate → invite/consent → update profile → participate/request service → withdraw consent/archive.
- **Validation rules:** Alumni status derives from enrollment history; communications require current channel consent; opt-out immediate.
- **Audit requirements:** Consent changes, contact export, profile merge, communication audience generation.
- **Privacy risks:** Long-term contact data, employment/education updates, profiling, and unwanted communication.
- **Dependencies:** Student lifecycle, certificates/documents, communication centre, events.
- **APIs:** Scoped profiles, consent/preferences, engagement, service requests, aggregate cohorts.
- **UI pages:** Alumni directory, consent queue, cohort view, engagement history, self-service profile.
- **Reports:** Consent, engagement, cohort participation, service turnaround.
- **Tests:** Consent enforcement, alumni derivation, export permission, erasure/archive handling, tenant isolation.
- **Acceptance criteria:** No alumni communication or export occurs without recorded applicable consent and permission.

### 16. Announcements and communication centre

- **Purpose:** Create targeted announcements and adapter-backed email/SMS/WhatsApp/in-app campaigns.
- **Users:** Administrators, principals, teachers, reception, students, parents, staff.
- **Permissions:** `communications.message.read`, `communications.message.manage`, `communications.publish`, `communications.delivery.read`.
- **Data entities:** Message, audience rule/snapshot, channel content, approval, outbox job, delivery event, preference/suppression.
- **Workflows:** Draft → preview audience → approve/publish → enqueue adapter → reconcile delivery → archive.
- **Validation rules:** Audience resolved server-side; consent/suppression enforced by channel; no sensitive data in subject, logs, or provider metadata.
- **Audit requirements:** Audience preview/export, approval, publish, cancellation, delivery reconciliation.
- **Privacy risks:** Bulk contact disclosure, behavioral tracking, sensitive content, cross-child/tenant targeting.
- **Dependencies:** Identity/memberships, guardians, notification adapters, events, outbox worker.
- **APIs:** Drafts, audience preview, publish, delivery status, local development preview.
- **UI pages:** Communication centre, composer, audience preview, approval queue, delivery report.
- **Reports:** Delivery outcomes, opt-outs, audience counts, campaign activity without invasive tracking.
- **Tests:** Audience isolation, consent, adapter idempotency, no real development sends, tenant isolation.
- **Acceptance criteria:** A published message targets only the approved immutable audience snapshot through local previews in development.

### 17. Events and school calendar

- **Purpose:** Plan academic, cultural, sports, meeting, and operational events alongside the school calendar.
- **Users:** Administrators, coordinators, teachers, students, parents, staff.
- **Permissions:** `events.calendar.read`, `events.calendar.manage`, `events.registration.manage`, `events.publish`.
- **Data entities:** Event, occurrence, venue, audience, registration, consent, resource booking, publication.
- **Workflows:** Draft → conflict/resource review → publish → register/consent → operate → close/cancel.
- **Validation rules:** Timezone explicit; venue/resource conflicts prevented; minor participation may require guardian consent; cancellation preserves history.
- **Audit requirements:** Publication, schedule/venue change, cancellation, consent and attendance corrections.
- **Privacy risks:** Participant lists, minor location, dietary/accessibility needs, photographs/consent.
- **Dependencies:** School calendar, rooms, clubs/houses, communication centre, payments adapter if later approved.
- **APIs:** Calendar feed, event CRUD, publish, registration/consent, resource availability.
- **UI pages:** Calendar, event editor, registration, participant desk, resource conflicts.
- **Reports:** Registration, attendance, utilization, cancellations, event portfolio.
- **Tests:** Conflict/timezone logic, consent, audience permissions, tenant isolation, accessible calendar/list views.
- **Acceptance criteria:** Published events appear only to their audience and preserve the timezone-bound schedule and change history.

### 18. Clubs, houses, and extracurricular activities

- **Purpose:** Configure activities, membership, leadership, sessions, competitions, achievements, and points.
- **Users:** Activity coordinators, teachers, students, parents, administrators.
- **Permissions:** `activities.program.read`, `activities.program.manage`, `activities.membership.manage`, `activities.points.manage`.
- **Data entities:** Programme/club, house, membership history, session, competition, achievement, points ledger.
- **Workflows:** Publish programme → apply/assign → approve membership → record participation/achievement/points → close season.
- **Validation rules:** Membership effective-dated; capacity and eligibility configurable; points ledger append-only with correction entries.
- **Audit requirements:** Membership decision, leadership assignment, points/achievement correction, sensitive note access.
- **Privacy risks:** Participation profiling, selection decisions, photographs, accessibility accommodations.
- **Dependencies:** Existing house setup, students/staff, events, communication centre, documents.
- **APIs:** Programmes, memberships, sessions, competitions, achievements, points ledger.
- **UI pages:** Activity catalogue, membership queue, house dashboard, competition results, achievement history.
- **Reports:** Participation, capacity, house points, achievement, inclusion indicators.
- **Tests:** Eligibility/capacity, ledger immutability, student/guardian scope, tenant isolation.
- **Acceptance criteria:** Historical membership and points remain reconstructable and corrections never rewrite the ledger.

### 19. Discipline and incident management

- **Purpose:** Record safeguarding-aware incidents, investigations, actions, restorative steps, appeals, and closures.
- **Users:** Authorized discipline/safeguarding officers, principals, counselors; limited student/guardian views.
- **Permissions:** `discipline.incident.read`, `discipline.incident.manage`, `discipline.safeguarding.read`, `discipline.action.approve`.
- **Data entities:** Incident, participant role, allegation, evidence reference, investigation event, action, appeal, restricted access log.
- **Workflows:** Report → triage sensitivity → investigate → approve action/restorative plan → notify/appeal → close/reopen.
- **Validation rules:** Need-to-know access; alleged and confirmed facts separated; immutable timeline; expulsion/suspension actions require approval.
- **Audit requirements:** Every restricted access, export/download, assignment, status/action decision, redaction, reopen.
- **Privacy risks:** Child safeguarding, allegations, witnesses, disability/health context, reputational harm.
- **Dependencies:** Students/staff, guardians, documents, health, communication adapters.
- **APIs:** Restricted incident intake/detail, timeline, action approval, redacted permitted view.
- **UI pages:** Secure intake, triage queue, investigation timeline, action/appeal queue.
- **Reports:** De-identified trends and action timeliness; person-level exports exceptionally controlled.
- **Tests:** Restricted access audit, allegation separation, approval, redaction, tenant isolation.
- **Acceptance criteria:** Unauthorized users cannot infer incident existence and every authorized access is immutable audit evidence.

### 20. Document management

- **Purpose:** Store, classify, scan, version, retain, approve, and securely deliver institutional documents.
- **Users:** Office staff, HR, teachers, students/parents for permitted documents, auditors.
- **Permissions:** `documents.file.read`, `documents.file.manage`, `documents.restricted.read`, `documents.retention.manage`.
- **Data entities:** Document metadata, private object version, classification, owner/resource link, checksum, scan state, retention/disposition hold, access grant.
- **Workflows:** Upload → quarantine/scan → classify → approve/publish → version → retain/archive/dispose under policy.
- **Validation rules:** Private storage only; MIME/size allow list; checksum/version immutable; download requires resource permission; legal hold blocks disposition.
- **Audit requirements:** Upload, scan result, classification, every restricted download, share, retention change, disposition.
- **Privacy risks:** Documents can contain any sensitive personal, health, financial, or safeguarding data.
- **Dependencies:** Private object-storage/virus-scan adapters, all resource modules, retention policy.
- **APIs:** Metadata/version upload handshake, scan callback, authorized download URL, retention actions.
- **UI pages:** Document library, upload/scan status, version history, access/retention panel.
- **Reports:** Storage/classification, quarantine, retention due, download evidence.
- **Tests:** MIME/size, quarantine, permission-bound download, checksum, retention hold, tenant isolation.
- **Acceptance criteria:** No uploaded content is public or downloadable before successful scan and authorization.

### 21. Help desk and support tickets

- **Purpose:** Route, prioritize, resolve, and measure internal service requests without leaking support data.
- **Users:** Students, parents, staff, support agents, module owners, administrators.
- **Permissions:** `support.ticket.read`, `support.ticket.manage`, `support.queue.manage`, `support.reports.read`.
- **Data entities:** Ticket, requester, queue, category, priority, assignment, comment, attachment, SLA event, resolution.
- **Workflows:** Submit → classify/route → assign → respond → resolve → reopen/close; escalation on SLA breach.
- **Validation rules:** Requester sees own/linked-child tickets; agents see assigned queues; private notes excluded from requester view; reference unique.
- **Audit requirements:** Queue/assignee change, private-note access, priority/SLA override, closure/reopen, export.
- **Privacy risks:** Tickets may contain credentials, health, financial, safeguarding, or student details; warn and redact.
- **Dependencies:** Identity, communication centre, documents, module ownership catalogue.
- **APIs:** Ticket CRUD, comments, assignment/transition, queue metrics, attachment access.
- **UI pages:** My tickets, support queue, ticket timeline, SLA dashboard, knowledge links.
- **Reports:** Volume, response/resolution time, SLA breaches, category and reopen rates.
- **Tests:** Requester/queue scope, private comments, transition rules, attachment permissions, tenant isolation.
- **Acceptance criteria:** Requesters can follow their tickets while internal notes and unrelated tickets remain inaccessible.

### Shared portfolio controls

The listed portfolio also requires shared controls rather than a separate user-facing business module: stable reference numbers, module/state catalogues, cursor pagination, archive instead of deletion, append-only state events, immutable security audit events, explicit tenant filters, and no sensitive data in list summaries. Portfolio acceptance requires all 21 business areas above to appear in the module directory with their own permissions and record-type vocabulary. This shared control plane is tested as part of every module rather than granted a broad bypass permission.

The request lists 21 named operational areas. This final section documents the shared portfolio kernel so every implementation concern has an explicit owner without inventing an additional business domain.

## Portfolio acceptance gate

- Every named module is discoverable only with its stable read permission.
- Every query and mutation applies verified trust and school scope; campus and academic year apply where supplied.
- Create and state transition requests use server-side Zod validation and immutable state events.
- Sensitive modules accept only minimum-necessary summary metadata in the first shared slice; confidential payloads wait for dedicated encrypted aggregates.
- Archive replaces hard deletion, and completed/approved records cannot silently return to draft.
- All sensitive mutations write a security audit event in the same transaction.
- Unit tests cover catalogue and transitions; integration tests prove cross-trust RLS; Playwright covers authorized, denied, empty, and responsive module workspaces.
