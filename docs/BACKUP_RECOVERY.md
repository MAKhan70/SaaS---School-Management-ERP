# Backup and Recovery

## Objectives and ownership

Provisional RPO is 15 minutes and RTO is four hours. The infrastructure owner operates backups; the incident commander authorizes restoration; an application owner validates tenant, academic, financial, and audit integrity. Store backups in the approved India region unless a documented legal review permits otherwise.

## Required protection

- Managed PostgreSQL automated encrypted snapshots plus continuous WAL archiving/PITR.
- Daily logical backup for portability and selective forensic recovery.
- Separate encrypted copies of private object storage, configuration manifests, and key-version metadata. Never put secret values in backup manifests.
- Cross-account write-protected retention with least-privilege backup and restore identities.
- Automated failure/age alerts and a quarterly full restore drill; monthly sample restore is recommended during pilot operation.

## PostgreSQL examples

Run only from an approved backup worker with TLS and a `.pgpass`/secret-injected credential. Do not place passwords on the command line.

```bash
pg_dump --format=custom --no-owner --no-privileges --file=nasaq.dump "$DIRECT_DATABASE_URL"
pg_restore --list nasaq.dump
```

Restore into a new isolated database; never overwrite production during a drill:

```bash
createdb nasaq_restore_validation
pg_restore --exit-on-error --single-transaction --no-owner --dbname=nasaq_restore_validation nasaq.dump
```

For managed PITR, select a timestamp before the destructive/corrupting event and restore to a new instance. Preserve the original instance read-only for evidence.

## Validation checklist

1. Verify backup checksum, encryption, completion time, and recovery-point coverage.
2. Apply no new writes to the isolated restore until evidence is captured.
3. Run `pnpm prisma:validate`, migration status, and read-only integrity queries.
4. Compare tenant/school/campus counts, critical foreign-key constraints, latest audit sequence, financial receipt/audit counts, published result snapshots, and sampled object hashes.
5. Test the application using the restricted runtime role; explicitly prove Trust A cannot read Trust B.
6. Record actual RPO/RTO, gaps, approvers, artifact locations, and deletion date for the drill environment.

## Recovery order

Identity/secrets and network controls, PostgreSQL, object storage, application/readiness, workers, integrations, then traffic. Rotate potentially exposed credentials before reconnecting. Reconcile asynchronous payment/webhook/notification events by idempotency key; never replay blindly.

## Destructive-event response

Stop affected writers, preserve logs/audit evidence, declare an incident, estimate the last known good time, and choose forward repair versus isolated PITR restore. Tenant data is never merged from a backup without scoped reconciliation and two-person review.
