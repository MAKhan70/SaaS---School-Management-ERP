# Admissions CRM

## Boundary and aggregate

Admissions is a school- and academic-year-scoped bounded context. `AdmissionApplication` is the aggregate root for an enquiry or application. It retains the applicable form version, source, target class, assigned counselor, sibling link, fee state, duplicate candidate, and eventual student conversion. Applicant data never enters global directory tables.

`AdmissionActivity` is append-only evidence for every stage transition and material workflow action. Follow-ups, document checklist items, assessment/interview schedules, seat plans, and local notification previews have composite tenant foreign keys back to the aggregate. Monetary values use integer minor units and an ISO currency code.

## Public forms

`AdmissionForm` is versioned by school, academic year, kind, code, and version. Published versions remain historical. A minimal `AdmissionPublicFormDirectory` maps an opaque public key to tenant context; it holds no applicant data and is the only admissions table intentionally available before tenant context is established.

The public endpoint resolves the directory, enters a transaction with `app.current_trust_id`, validates the published form definition and answers, and then writes the application, initial activity, and audit event atomically. Signed, short-lived form tokens, a hidden honeypot, server validation, and throttling keyed by hashes of the form, network address, and contact value protect the endpoint without browser fingerprinting. Public responses never reveal duplicate candidates.

## Workflow and notifications

The domain transition map rejects skipped and terminal-state transitions. Every successful transition writes both an append-only activity and an immutable audit event in the same transaction. Offer and rejection actions write a masked local notification preview through the development adapter behavior; no email or WhatsApp provider is called.

Document rows contain private object-storage keys only. The download endpoint requires `admissions.documents.read`, rechecks tenant/school scope, and currently returns `501` until private object storage and short-lived signed downloads are configured.

## Conversion to SIS

Conversion requires `admissions.application.convert` and an `ADMITTED` application. The service locks the application row, returns the already-linked student for repeated requests, performs duplicate screening, allocates the school admission number, creates `Person`, `StudentProfile`, `StudentAdmission`, optional `StudentEnrollment` and its event, links the application, and writes activity/audit evidence in one transaction. Unique conversion and composite tenant constraints prevent one application from creating multiple students or crossing tenant scope.

## Analytics and indexing

Funnel and conversion reporting group applications by stage. Counselor productivity groups current assignments. Seat availability derives offered/admitted counts from grade/year seat plans rather than storing a mutable counter. Composite indexes lead with `trust_id`, `school_id`, and `academic_year_id`; additional indexes cover stage/time, counselor/stage, grade/stage, contact hashes, schedules, follow-ups, and documents.

Applicant records, activities, decision evidence, and conversion links are archived rather than hard-deleted. Unconverted withdrawn/rejected applications should follow the trust retention policy; converted applications and decision evidence remain linked to the student retention lifecycle.
