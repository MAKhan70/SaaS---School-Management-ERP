# NASAQ platform administration control plane

## Boundary

`/platform/clients` is a separate control-plane workflow available only through the global `platform.clients.manage` permission. Platform permissions are assigned through `PlatformRoleAssignment`; tenant role names never authorize control-plane operations. Public self-service onboarding is disabled unless the development-only `ALLOW_PUBLIC_ONBOARDING=true` switch is explicitly set.

## Client provisioning

One transaction creates the trust boundary, primary school and campus, active academic year, versioned board configuration, master administrator identity and phone contact, school membership, trust-admin assignment, selected feature grants, pending invitation, checklist, and immutable tenant audit event. The administrator has no password until the single-use invitation is accepted. Invitation tokens are random, stored only as hashes, expire after seven days, and are never returned by an API or written to logs.

Email delivery is an adapter. Production invokes the authenticated Supabase Edge Function `send-client-invite`; the function uses its own server-side mail-provider secret. If delivery is not configured or fails, the tenant remains safely provisioned and the NASAQ operator sees an explicit delivery state for operational follow-up.

## Feature entitlements

`TenantFeatureGrant` contains stable machine keys. Authentication intersects role permissions with enabled features, so hiding navigation is not the enforcement boundary. `core` includes tenant administration; disabling a business feature removes its permission prefixes from the resolved server context. Every entitlement change is audited in the affected trust.

## Support access

Client testing requires `platform.support.access`, a written reason, and a maximum 60-minute duration. The service creates `SupportAccessGrant`, effective-dated tenant access and a trust-admin assignment, rotates the current session context, and writes a restricted audit event. The client shell displays a visible support-access banner. Permission grants expire at the exact timestamp; ordinary support must never use database-owner credentials or bypass RLS.

## Supabase responsibility split

Supabase provides managed PostgreSQL, network TLS, backups according to the selected plan, Edge Functions, and the email-delivery boundary. Prisma remains the schema/migration client and the application retains its opaque session and authorization model. The publishable key is safe for browser use; the database password, direct URL, service-role key, mail-provider key, encryption key, and auth secret are server-only managed secrets.
