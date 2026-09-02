# Database Indexing Strategy

## Objectives

Indexes must make scoped operational queries predictable without increasing write cost speculatively. Production index changes require query evidence from `EXPLAIN (ANALYZE, BUFFERS)` and observed workload.

## Rules

1. Tenant-owned indexes lead with `trust_id`; school/campus refinements follow.
2. Unique business identifiers include tenant and applicable parent scope.
3. Foreign-key columns used in joins have matching leading indexes where PostgreSQL does not receive one from a unique constraint.
4. Effective-dated lookups index scope, status, `effective_from`, and `effective_to`.
5. Historical scans index academic year before lower-cardinality status when that matches the query path.
6. Partial unique indexes enforce active-state invariants without blocking history.
7. Append-heavy audit indexes serve tenant/time, resource/time, actor/time, and retention queries only; add further indexes after workload evidence.

## Foundation indexes

| Query pattern            | Index shape                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Schools for a trust      | `(trust_id, status)` and unique `(trust_id, code)`                                                      |
| Campuses for a school    | `(trust_id, school_id, status)` and unique `(trust_id, school_id, code)`                                |
| Current academic year    | Partial unique `(trust_id) WHERE status = 'ACTIVE'`                                                     |
| Active board version     | `(trust_id, school_id, status, effective_from, effective_to)`                                           |
| Sections for campus/year | `(trust_id, school_id, campus_id, academic_year_id, status)`                                            |
| User memberships         | `(trust_id, user_id, status, effective_from, effective_to)`                                             |
| Permission resolution    | `(trust_id, user_id, status, effective_from, effective_to)` on assignments; unique role/permission pair |
| Guardian's children      | `(trust_id, guardian_person_id, effective_from, effective_to)`                                          |
| Section roster           | `(trust_id, section_id, status)`                                                                        |
| Enrollment operations    | `(trust_id, school_id, campus_id, academic_year_id, status)`                                            |
| Active staff placements  | `(trust_id, school_id, campus_id, status, effective_from, effective_to)`                                |
| Audit timeline           | `(trust_id, occurred_at)`                                                                               |
| Resource audit history   | `(trust_id, resource_type, resource_id, occurred_at)`                                                   |

## Partial uniqueness

- One active academic year per trust.
- One active student enrollment per academic year.
- One active school-level membership per user and school when campus is null.
- One active campus-level membership per user, school, and campus.
- System role key unique per platform; tenant role key unique per trust.

## Review practice

Monitor unused and duplicate indexes, index size, cache hit rate, sequential scans on high-volume tenant tables, and write amplification. Add cursor-pagination indexes with the first real list endpoint rather than predicting every sort order now.

## School-setup indexes

- Academic-year, term, period, calendar, working-day, and grading lookups lead with `trust_id`, `school_id`, and `academic_year_id` where applicable.
- Grade, stream, department, subject, house, room, board, grading, and numbering codes use scoped unique indexes instead of application-only duplicate checks.
- Nullable campus configuration uses partial unique indexes for school-wide periods and calendar dates because ordinary PostgreSQL uniqueness treats null values as distinct.
- Active academic-year overlap uses a GiST exclusion constraint over the inclusive `daterange`; the accompanying B-tree/GiST extension supports equality on trust and school identifiers.
- Versioned board, grading, and numbering tables index scope, status, and effective date for current-policy resolution while retaining historical versions.

## Admissions CRM indexes

- Funnel lists use `(trust_id, school_id, academic_year_id, stage, created_at)`.
- Counselor queues use `(trust_id, school_id, counselor_user_id, stage)` and follow-up assignee/status/due date.
- Seat reporting uses school-scoped target-grade/stage indexes plus a unique year/grade seat plan.
- Duplicate screening uses school-scoped email and phone hashes; raw contacts are never global index keys.
- Timeline, document, and schedule indexes lead with tenant/school and the owning application or scheduled time.

## Attendance indexes

- Partial unique indexes enforce one daily session per scoped section/date and one period session per scoped section/date/period.
- A composite unique index on `(trust_id, session_id, student_profile_id)` prevents duplicate student marks; roster and report indexes lead with tenant, school, academic year, section, and date.
- One pending reopen request per session and one pending correction per staff record avoid conflicting approval work.
- Staff registers are unique by tenant, campus, staff member, and date; reporting indexes lead with tenant, school, campus, date, and staff member.
- Shift and teaching-assignment lookups index effective date ranges after their tenant, school, campus, and assignee identifiers.
- Device events use tenant/device/provider-event uniqueness for retry idempotency and index tenant/state/occurrence time for workers.

## Examination indexes

- Rule and template versions are unique by tenant, school, code, and version; current-policy resolution leads with tenant, school, lifecycle state, and effective dates.
- Examination lists lead with tenant, school, campus, academic year, state, and start date. Subject offerings are unique per examination, section, and subject.
- Component and register lookups lead with tenant, school, and examination-subject ID. A scoped unique register key guarantees one workflow state machine per offering.
- Mark uniqueness on tenant, school, register, component, and student prevents duplicate grades. Student and examination indexes support result calculation and historical lookup.
- Moderation and reopening queues index tenant, school, state, and creation time. The migration adds partial uniqueness for one pending request per target.
- Results are unique per examination and student. Publication versions are unique per result, while publication timelines lead with examination, student, and publication time.
- Report generation workers use tenant, school, state, and request time; verification codes are globally opaque and unique.
