# Incident Response

## Severity

- SEV-1: confirmed/suspected cross-tenant disclosure, credential/key compromise, material child-data exposure, destructive corruption, or broad outage.
- SEV-2: contained unauthorized access, critical control failure, sustained partial outage, or payment/result integrity risk.
- SEV-3: low-impact vulnerability, isolated error, or recoverable degradation.

Legal and contractual notification deadlines are not hardcoded here. Counsel and the designated privacy owner determine obligations using the affected schools, data, jurisdictions, and contracts.

## First hour

1. Open a restricted incident record; assign incident commander, security, operations, application, communications, privacy/legal, and tenant-liaison roles.
2. Preserve immutable logs, audit sequences, database snapshots, deployment/image identifiers, and provider events. Use UTC times and evidence hashes.
3. Contain with the narrowest safe action: disable an endpoint/integration, revoke sessions, rotate a credential, remove an instance, or block a source. Do not destroy evidence.
4. Determine trusts, schools, users, records, fields, actions, and time window affected. Treat tenant scope as unknown until proven.
5. Establish an approved internal update cadence. Do not place student information in general chat, email subjects, or status pages.

## Investigation

Correlate security/audit events by safe correlation ID, actor, action, resource type, and time. Validate RLS/runtime-role configuration, application authorization, object-download logs, exports, session creation/revocation, role changes, and key access. Query each trust independently. Record facts, confidence, and unresolved questions.

## Eradication and recovery

Patch the cause, rotate exposed secrets/keys, revoke affected sessions/tokens, verify dependencies/images, restore under `BACKUP_RECOVERY.md` if needed, and run tenant-isolation/security regression tests before traffic returns. Monitor for recurrence and reconcile financial/academic changes through corrections, never silent edits.

## Communication

Only the authorized incident/legal team communicates externally. Provide affected tenants with accurate scope, timing, categories, containment, actions they should take, and update schedule. Never speculate or disclose another tenant. Regulatory, board, insurer, law-enforcement, and data-subject communications require documented legal decisions.

## Closure

Within five business days of stabilization, hold a blameless review covering timeline, root cause, control failures, detection, impact, recovery, evidence retention, and owners/dates for actions. Add regression tests and update threat model/runbooks. The incident commander closes only after monitoring and tenant/legal obligations are tracked.
