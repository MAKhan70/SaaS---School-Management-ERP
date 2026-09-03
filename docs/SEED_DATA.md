# Seed-Data Design

## Purpose

The seed establishes a deterministic, fictional environment for development, demonstrations, and automated checks. It contains no real personal information and must never be treated as production data.

## Organizations

- Platform: NASAQ Academic Systems
- Trust: Saraswati Learning Trust (Demo)
- School 1: Saraswati Central School (Demo), CBSE configuration version 1
  - Pune Central Campus (Demo)
  - Nashik Campus (Demo)
- School 2: Saraswati State School (Demo), Maharashtra State Board configuration version 1
  - Pune State Campus (Demo)
  - Nagpur Campus (Demo)
- Active academic year: school-scoped 2026–27 configuration for each demo school

Representative grades, sections, streams, departments, subjects, terms, weekly working days, rooms, periods, holidays, houses, grading scales, and student/employee numbering rules validate composite academic relationships without implementing business modules. All labels are seed data rather than application constants.

## Identities and roles

Fictional `@demo.nasaq.test` accounts represent trust administrator, school administrator, principal, teacher, student, parent/guardian, accountant, HR, librarian, transport staff, hostel staff, nurse, and security staff. Display names identify the role, not a real person. Password hashes are added only when the local-only `DEMO_USER_PASSWORD` environment variable is explicitly supplied; sensitive identifiers are never seeded.

The demo student has one active enrollment and one guardian relationship. Staff representatives have effective-dated staff assignments where applicable.

Admissions seed data adds published enquiry and application form version 1 for the CBSE demo school, opaque public keys, a Grade 8 seat plan, one counselor-assigned synthetic application under review, and a pending document checklist item. Development offer/rejection messages remain local masked previews and are never sent.

Attendance seed data adds the built-in student status catalogue, Grade 8 sections A and B, an effective teaching assignment for the synthetic teacher to section A only, a regular staff shift and assignment, and an inactive-development RFID integration registration. Section B exists to verify that a teacher cannot reach an unassigned class. No device credential, raw scan token, or real person is seeded.

Examination seed data adds separate versioned CBSE and Maharashtra State Board rule sets, a periodic Grade 8 assessment, Mathematics and Science offerings, internal/project/practical/viva/theory components, empty entry-state registers, and a versioned school-branded report-card template. The calculation contract remains board-neutral so a CISCE or another State Board school can supply its approved version without a code change. No real learner marks are seeded.

Fee seed data adds an academic fee category, regular tuition and optional transport heads, a versioned Grade 8 structure, one installment, one enrollment-linked tuition assignment, and its opening financial audit debit. No payment, bank detail, card detail, or real financial reference is seeded.

Dashboard seed data adds school/year-scoped operational alerts, tasks, timetable entries, homework, lesson-plan reminders, learning resources, announcements, a parent meeting request, and a reconciliation reminder. These entries are explicitly non-authoritative demonstration content; live attendance, examination, admission, enrollment, and finance metrics are queried from their domain records.

Operational portfolio seed data adds exactly one synthetic, non-personal work record and immutable creation event for every named operational module. Standard modules contain only a `synthetic` marker; sensitive and restricted modules contain no generic details or personal summaries. Representative specialist roles receive only their module permission pairs.

Analytics and responsible-assistance seed data adds one local-mock lesson-plan draft and one transparent attendance-review indicator. Both use synthetic instructional or aggregate context, stable versions, deterministic fallbacks, and immutable events. No real or sensitive personal attributes are included.

The demo teacher also has a second school membership, a librarian role assignment, and a second staff assignment at the State Board school. This validates that one user can hold different roles at different schools without duplicating the login or staff profile.

## Safety and repeatability

- IDs and business keys are deterministic.
- Seed operations use upsert or create-if-absent behavior.
- Tenant rows are written inside a transaction-local tenant context.
- System-role bootstrap runs with an explicit platform-administration context.
- The seed writes one immutable completion audit event and does not update it on rerun.
- Real-looking but fictional organization names are suffixed with `(Demo)`.
