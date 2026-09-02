# Data Retention and Archival

## Status

This is an engineering control framework, not legal advice. Exact India-, board-, state-, contract-, and school-specific periods remain subject to counsel and tenant approval. Until approved, do not automate irreversible deletion of student, academic, attendance, examination, financial, safeguarding, health, or audit records.

## Principles

Collect the minimum, bind use to an explicit purpose, segregate restricted data, retain authoritative history through archival/versioning/corrections, and make deletion a reviewed job with tenant scope, dry-run counts, audit evidence, idempotency, and legal-hold checks.

| Class                 | Examples                                                                | Technical disposition                                                                          |
| --------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Credentials           | Reset/verification tokens, MFA challenges                               | Short-lived; hash/tokenize; delete expired material after approved security window             |
| Sessions/rate buckets | Sessions, failed-attempt buckets                                        | Revoke immediately when required; purge expired rows after investigation window                |
| Security/audit        | Sign-in, permissions, exports, sensitive access                         | Append-only hot store then encrypted tamper-evident archive; legal hold capable                |
| Academic              | Enrolment, attendance, marks, published results, board/grading versions | Archive/version; never routine hard delete; preserve applicable academic year                  |
| Financial             | Payments, receipts, allocations, reversals, waivers                     | Immutable/corrective ledger and approved statutory/contractual archive                         |
| Student/person        | Profiles, guardians, contacts, documents                                | Archive on exit; minimize/restrict; delete only when dependencies, law and tenant policy allow |
| Health/accommodation  | Alerts and restricted support details                                   | Separate encrypted access and minimum approved period; cryptographic deletion when lawful      |
| Imports/exports       | Preview files, generated exports, error reports                         | Ephemeral private storage, explicit expiry, access audit, verified deletion                    |
| Operational logs      | Structured application/infrastructure logs                              | Short operational window; no raw payloads or unnecessary identifiers                           |

## Workflow

1. Resolve tenant and policy version; check legal/incident holds and dependent historical records.
2. Produce a dry-run manifest with category counts, date range, and exclusions—never unrestricted content.
3. Require scoped permission and two-person approval for high-risk deletion.
4. Archive or delete inside bounded jobs; write immutable audit/outbox evidence and reconcile counts/hashes.
5. Delete derived caches, exports, search copies, and eligible object versions. Backup expiry follows its own schedule; do not edit historical backups.
6. Give tenants a completion report and retain non-sensitive proof.

## Subject and tenant requests

Identity verification, guardian authority, school ownership, competing legal duties, child safety, and record-integrity obligations require human review. Exports must be scoped, minimized, encrypted in transit, time-limited, and audited. Cross-tenant aggregate analytics must be de-identified and approved.
