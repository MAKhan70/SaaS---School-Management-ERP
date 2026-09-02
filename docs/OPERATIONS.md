# Operations

## Service objectives

Provisional targets are 99.9% monthly availability, RPO at most 15 minutes, and RTO at most four hours. Product, infrastructure, and school stakeholders must approve cost and outage expectations before production.

## Probes and telemetry

- `GET /api/health`: process liveness only; does not touch dependencies.
- `GET /api/ready`: PostgreSQL readiness; returns 503 with a deliberately generic body on failure.
- Structured logs are one JSON object per line with timestamp, level, service, event, and allowlisted context. Never enable request-body, cookie, token, student-health, or unrestricted SQL-parameter logging.
- Connect `ErrorMonitoringAdapter` to the approved provider and send only safe tags. Treat the local structured-log adapter as a fallback, not full monitoring.

Alert on sustained 5xx rate, readiness failure, p95/p99 latency, authentication-denial spikes, rate-limit blocks, database connection/lock saturation, migration failure, audit-ingestion gaps, queue backlog, storage scan failure, backup failure, and certificate/secret expiry.

## Daily checks

Review availability, elevated error groups, blocked sign-ins/public forms, privileged audit events, database capacity, replication/PITR health, backup completion, certificate expiry, and provider incidents. Do not investigate by copying personal data into chat or tickets.

## Performance

Set database statement and transaction timeouts appropriate to each workload. Track slow queries with normalized fingerprints, never raw values. Use `EXPLAIN (ANALYZE, BUFFERS)` on synthetic/sanitized data; add indexes from evidence. Keep interactive lists bounded and move large exports/reports to idempotent jobs.

## Maintenance

Revoke sessions after credential or high-risk role changes. Purge expired sessions/tokens/rate buckets under the retention schedule. Vacuum/analyze and index maintenance follow managed PostgreSQL guidance. Dependency and base-image updates use normal CI and staged rollout; emergency security patches use the incident process.

## Runbooks

- Database loss/corruption: `BACKUP_RECOVERY.md`.
- Suspected compromise or disclosure: `INCIDENT_RESPONSE.md`.
- Release decision: `RELEASE_CHECKLIST.md`.
- Security control status: `SECURITY_REVIEW.md`.
