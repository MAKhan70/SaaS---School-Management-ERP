# Student Information System Architecture

## Boundaries

`StudentProfile` is a trust-owned identity linked to `Person`. `StudentAdmission`, enrolments, documents, notes, houses, and identity cards add explicit school scope. A school or campus scope refines but never replaces `trustId`. Repository operations start from a verified session context and run inside `withTenant`, which sets the transaction-local PostgreSQL RLS variable.

## Lifecycle

Admissions and enrolments are historical records. Transfers, promotions, detention, withdrawal, graduation, alumni conversion, and restoration append `StudentEnrollmentEvent` evidence and close the prior active enrolment where applicable. The database rejects update or delete of an event. Profile archival is reversible; historic admissions and enrolments remain intact.

## Privacy

Directory responses contain only identity, admission, current placement, house, and status fields. Medical alerts, allergies, accommodations, and sensitive demographics are JSON-encrypted with AES-256-GCM using trust/student/type authenticated context and a versioned environment-managed key. A dedicated read permission and a restricted audit event are required for decryption. Government identifiers are returned only as masked last-four values.

Exports use a fixed minimum-necessary allowlist and require `students.export`. Document downloads require `students.documents.read`, verify trust and school scope, require an available malware-scan state, and are audited. Actual object delivery remains behind the storage adapter boundary.

No sensitive record values, contact values, tokens, or document storage keys belong in client logs, analytics, audit changes, or error messages.

## Duplicate detection and imports

Duplicate screening compares a normalized legal-name/date-of-birth fingerprint within the active school and may also use indexed normalized contact hashes. A human must provide a reason to override a possible match. CSV imports are previewed and validated before mutation, limited to 250 rows, and use the same create-student service for permission, numbering, tenant checks, transactions, and audit events.

## Retention

Academic placement, admission, lifecycle events, and audit evidence are retained according to the school/trust approved schedule and legal holds. Routine removal archives profile-adjacent data. Document binaries and encryption keys have independent retention and rotation schedules. Final retention periods require approved institutional and legal policy; the application does not silently hard-delete academic history.
