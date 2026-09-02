# Audit Events, Retention, and Archival

## Audit-event contract

Security-sensitive actions append an `AuditEvent` in the same transaction as the protected mutation. The model records:

- Tenant and optional school/campus scope
- Actor and effective actor for delegation or impersonation
- Stable action, resource type, and optional resource ID
- Outcome and sensitivity classification
- Correlation ID, request ID, and safe reason code
- Allowlisted changes and metadata
- Monotonic sequence and event time
- Optional previous/event hashes for tamper-evident export
- Optional retention boundary

A database trigger rejects updates and deletes. A correction is a later event referencing the original resource/action.

Authentication events that occur before a trust can be selected use the global append-only `SecurityEvent` stream. It records only optional user ID, stable action/outcome/reason codes, correlation ID, and hashed network/client metadata. Once a trust is verified, sign-in, context changes, onboarding, and privileged mutations also append the tenant `AuditEvent` inside the tenant transaction.

## Payload rules

Audit payloads must never contain passwords, session tokens, credentials, encryption keys, complete sensitive identifiers, student health narratives, uploaded-file contents, or unnecessary personal data. Store field names and safe category/value transitions rather than unrestricted object snapshots.

## Retention classes

| Class                 | Examples                                               | Strategy                                                              |
| --------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| Security audit        | Authentication, permissions, exports, sensitive access | Append-only hot retention, then encrypted tamper-evident archive      |
| Academic history      | Enrollment, board version, results, promotion          | Retain by approved academic/legal schedule; no ordinary hard deletion |
| Staff history         | Memberships, roles, assignments                        | Effective dating and archival after separation                        |
| Operational reference | Inactive sections, departments, subjects               | Archive when no longer used; preserve referenced rows                 |
| Authentication        | Sessions, reset/MFA challenges                         | Short security-defined retention and revocation cleanup               |
| Sensitive identifier  | Encrypted identifiers                                  | Minimum necessary retention; cryptographic deletion where approved    |

Exact periods are not hardcoded until legal counsel and institutional policy approve India-specific requirements.

## Archival workflow

1. Validate no prohibited active references.
2. Record actor, reason, request, and effective time.
3. Set status/`archived_at` within a transaction and append an audit event.
4. Exclude archived rows from ordinary operational queries while retaining authorized historical access.
5. Move eligible high-volume history to encrypted archive storage only through a verified export and reconciliation process.

Audit tables should be time-partitioned when volume warrants it. Partitioning is deferred until production volume and retention periods are known.

Attendance registers are academic history. Student changes are append-only, while lock/reopen decisions, leave decisions, staff corrections, device ingestion, and notification previews retain their own evidence plus a safe tenant audit event. Raw scan credentials are never retained; normalized device payloads must be minimized and assigned a short approved operational retention period. Browser offline drafts are user-device working data, not records, and should be cleared after successful synchronization or explicit discard.

Examination marks and result publications are academic history. Mark changes and publication snapshots are append-only; register transitions, moderation, reopening, calculation, preview, publication, and generation append safe audit events in the protected transaction. A post-lock correction supersedes the current calculated result but preserves every previously published snapshot and hash. Generated files must use private storage and inherit the approved academic-record retention schedule; queued/failed operational job metadata may use a shorter policy once approved.
