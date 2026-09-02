# Student and Staff Attendance

## Boundaries and source of truth

Attendance is an application-service boundary inside the modular monolith. Every operation starts from a server-verified trust, school, campus, and academic-year context. The client supplies only resource identifiers inside that context; it cannot choose a tenant. Daily and period sessions are the official student register. Browser drafts are explicitly non-authoritative until the server accepts a submission.

## Student attendance

`StudentAttendanceSession` identifies one class/section register for a date and either daily or period mode. Database partial unique indexes permit exactly one daily session and one session per period for that scope. `StudentAttendanceRecord` permits one row per enrolled student in a session. Statuses are academic-year configuration: built-in seeded definitions cover present, absent, late, excused, half day, medical leave, and school activity, while schools can add custom definitions and present fractions.

Bulk marking runs in one tenant transaction. The service validates the active enrolment, academic-year and section match, status catalogue, teaching assignment, date policy, and lock before changing any record. Every accepted insert or correction appends `StudentAttendanceChange`; changing existing or previous-day data requires `attendance.session.correct` and a reason. Locking is immediate for an authorized operator. Reopening uses a pending request and a different approving user.

Student leave requests are dated, scoped records with an approval trail. Approval does not silently rewrite the official register. A later reconciliation workflow may propose attendance updates for an authorized operator to review.

## Staff attendance

`StaffShift` and effective-dated `StaffShiftAssignment` define local start/end minutes and grace. `StaffAttendanceRecord` stores UTC check-in/check-out instants plus derived late and early minutes. One record is allowed per staff member, campus, and date. Manual corrections are proposed in `StaffAttendanceCorrection` and need a different authorized approver. Staff leave uses the same explicit request/decision approach and does not overwrite the time register implicitly.

## Authorization

Stable permissions separate reading, marking, correction, locking, reopening, class override, reporting, leave, staff attendance, shifts, and device ingestion. Teachers additionally need an effective `AttendanceTeachingAssignment` for the requested class/section unless they hold `attendance.classes.override`. School or campus grants are intersected with the selected context. APIs and services enforce these checks; navigation visibility is only a usability aid.

## Notifications and devices

Parent absence notifications use an adapter. Development records only a masked `AttendanceNotificationPreview`; it sends no email, SMS, or WhatsApp message. A production adapter must use an outbox, provider idempotency keys, consent and channel policy, and delivery telemetry without exposing student or guardian data in logs.

`AttendanceDeviceEvent` accepts normalized events from registered RFID, barcode, QR-code, biometric, or other devices. Provider adapters translate signed provider payloads to the normalized contract. The database keeps the provider event ID for idempotency and a one-way subject-token hash; raw credentials are not stored. Processing and identity matching remain separate from ingestion.

Facial-recognition processing is intentionally unsupported. The integration interface throws for that capability. Any future proposal requires a separate privacy, legal, safeguarding, security, consent, retention, and bias review before implementation; it must not be enabled by treating it as a generic biometric device.

## Reporting and offline behavior

Monthly student percentages derive from configured present fractions. Defaulter and consecutive-absence reports are operational views over official records. Staff summaries aggregate marked days, late days, and late/early minutes. Current thresholds are service policy defaults and should become tenant configuration before broad rollout.

The mobile UI stores a scoped local draft in browser storage and announces offline and pending-sync state through an accessible live region. Statuses use native radio controls grouped by student, keyboard-operable labels, and large targets. Drafts never update reports, trigger notifications, or bypass locks. Users must submit again after connectivity returns.

## Retention and audit

Registers, changes, approvals, device events, and notification previews are tenant-owned historical evidence. They are protected by foreign keys and row-level security. Student change rows are append-only by database trigger. Ordinary workflows archive configuration and retain registers; legal retention periods must be configured by jurisdiction and institutional policy. Raw provider payload retention should be short, minimized, and excluded from analytics by default.
