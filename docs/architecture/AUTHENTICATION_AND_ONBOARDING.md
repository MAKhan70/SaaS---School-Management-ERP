# Authentication and Tenant Onboarding

## Authentication lifecycle

Credentials are normalized and validated at the route boundary. Passwords use versioned scrypt hashes with random salts; an opaque 256-bit session token is returned only in an HttpOnly, SameSite cookie and only its keyed SHA-256 hash is persisted. Production cookies are Secure. Every session records expiry, revocation, rotation, last-seen, and hashed network/client metadata.

Sign-in resolves the user's effective `UserTrustAccess`, establishes PostgreSQL transaction-local trust context, then verifies active school membership, academic year, role assignments, and permission keys. Password or account failures return one public error. Five consecutive credential failures temporarily lock the account; endpoint throttling is persisted separately using hashed identity/network keys.

Password recovery always returns the same accepted response. Eligible users receive a random, single-use, 30-minute token through the `PasswordResetDelivery` port. A successful reset changes `credentialsUpdatedAt`, consumes the token, clears lockout state, and revokes every existing session. `EMAIL_VERIFICATION` tokens and `MfaMethod` records provide the persistence contracts for later verified-email and TOTP/WebAuthn challenge adapters.

Mutating cookie-authenticated endpoints reject cross-origin requests. Return URLs accept same-origin relative paths only, preventing open redirects. Passwords and raw tokens are excluded from audit metadata and application logs.

## Authorization and context

The server resolves effective role permissions for each request and passes scoped grants into the existing pure permission evaluator. `requirePermission` denies by default for missing keys, trust mismatch, or school/campus scope mismatch. UI filtering is only a usability layer; protected layouts, API routes, application services, repositories, and RLS enforce the actual decision.

The school selector sends proposed IDs. The server verifies current session ownership, trust access, active school/campus membership, and academic-year existence before updating session context and writing a tenant audit event.

## Onboarding transaction

The public onboarding wizard collects the trust, primary school, first campus, active academic year, board version, administrator, and optional fictional staff invitations. The service validates the complete payload and creates the hierarchy, administrator identity, global trust access, tenant person/staff records, membership, trust-scoped role assignment, hashed invitations, completed checklist, and immutable audit event in one database transaction.

Invitation delivery and acceptance are deliberately out of scope. Stored invitation tokens are hashes and expire after seven days. The onboarding endpoint creates no student, fee, attendance, or examination records.
