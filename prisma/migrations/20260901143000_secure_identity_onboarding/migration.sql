-- Authentication, session context, security telemetry, and tenant onboarding.
CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');
CREATE TYPE "AuthTokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');
CREATE TYPE "MfaMethodType" AS ENUM ('TOTP', 'WEBAUTHN', 'RECOVERY_CODES');
CREATE TYPE "RateLimitAction" AS ENUM ('SIGN_IN', 'PASSWORD_RECOVERY', 'TENANT_ONBOARDING');
CREATE TYPE "OnboardingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

ALTER TABLE "users"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "UserAccountStatus" USING ("status"::text::"UserAccountStatus"),
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
  ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMP(3),
  ADD COLUMN "credentials_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "mfa_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "archived_at" TIMESTAMP(3);

ALTER TABLE "sessions"
  ADD COLUMN "active_school_id" TEXT,
  ADD COLUMN "active_campus_id" TEXT,
  ADD COLUMN "active_academic_year_id" TEXT,
  ADD COLUMN "ip_hash" TEXT,
  ADD COLUMN "user_agent_hash" TEXT,
  ADD COLUMN "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "rotated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "auth_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "AuthTokenType" NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_trust_access" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "trust_id" TEXT NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_trust_access_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mfa_methods" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "MfaMethodType" NOT NULL,
  "credential_data" JSONB NOT NULL,
  "verified_at" TIMESTAMP(3),
  "disabled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mfa_methods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_rate_limits" (
  "id" TEXT NOT NULL,
  "action" "RateLimitAction" NOT NULL,
  "key_hash" TEXT NOT NULL,
  "window_start" TIMESTAMP(3) NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 1,
  "blocked_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "security_events" (
  "id" TEXT NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "user_id" TEXT,
  "action" TEXT NOT NULL,
  "outcome" "AuditOutcome" NOT NULL,
  "reason_code" TEXT,
  "correlation_id" TEXT NOT NULL,
  "ip_hash" TEXT,
  "user_agent_hash" TEXT,
  "metadata" JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_onboardings" (
  "id" TEXT NOT NULL,
  "trust_id" TEXT NOT NULL,
  "status" "OnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "trust_created_at" TIMESTAMP(3),
  "school_created_at" TIMESTAMP(3),
  "campus_created_at" TIMESTAMP(3),
  "academic_year_set_at" TIMESTAMP(3),
  "board_selected_at" TIMESTAMP(3),
  "administrator_set_at" TIMESTAMP(3),
  "initial_staff_invited_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_onboardings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staff_invitations" (
  "id" TEXT NOT NULL,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "campus_id" TEXT,
  "email" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "role_key" TEXT NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "invited_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");
CREATE UNIQUE INDEX "user_trust_access_user_id_trust_id_key" ON "user_trust_access"("user_id", "trust_id");
CREATE INDEX "user_trust_access_user_id_status_effective_from_effective_to_idx" ON "user_trust_access"("user_id", "status", "effective_from", "effective_to");
CREATE INDEX "auth_tokens_user_id_type_expires_at_used_at_idx" ON "auth_tokens"("user_id", "type", "expires_at", "used_at");
CREATE INDEX "mfa_methods_user_id_type_verified_at_disabled_at_idx" ON "mfa_methods"("user_id", "type", "verified_at", "disabled_at");
CREATE UNIQUE INDEX "auth_rate_limits_action_key_hash_key" ON "auth_rate_limits"("action", "key_hash");
CREATE INDEX "auth_rate_limits_blocked_until_idx" ON "auth_rate_limits"("blocked_until");
CREATE UNIQUE INDEX "security_events_sequence_key" ON "security_events"("sequence");
CREATE INDEX "security_events_user_id_occurred_at_idx" ON "security_events"("user_id", "occurred_at");
CREATE INDEX "security_events_action_outcome_occurred_at_idx" ON "security_events"("action", "outcome", "occurred_at");
CREATE UNIQUE INDEX "tenant_onboardings_trust_id_key" ON "tenant_onboardings"("trust_id");
CREATE UNIQUE INDEX "staff_invitations_token_hash_key" ON "staff_invitations"("token_hash");
CREATE UNIQUE INDEX "staff_invitations_trust_id_school_id_email_status_key" ON "staff_invitations"("trust_id", "school_id", "email", "status");
CREATE INDEX "staff_invitations_trust_id_school_id_campus_id_status_expires_at_idx" ON "staff_invitations"("trust_id", "school_id", "campus_id", "status", "expires_at");
CREATE INDEX "sessions_active_trust_id_active_school_id_active_campus_id_idx" ON "sessions"("active_trust_id", "active_school_id", "active_campus_id");

ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_trust_access" ADD CONSTRAINT "user_trust_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_trust_access" ADD CONSTRAINT "user_trust_access_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mfa_methods" ADD CONSTRAINT "mfa_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_onboardings" ADD CONSTRAINT "tenant_onboardings_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_failed_login_attempts_nonnegative" CHECK ("failed_login_attempts" >= 0);

CREATE TRIGGER "security_events_immutable"
BEFORE UPDATE OR DELETE ON "security_events"
FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();

GRANT SELECT, INSERT, UPDATE, DELETE ON "auth_tokens", "user_trust_access", "mfa_methods", "auth_rate_limits", "security_events", "tenant_onboardings", "staff_invitations" TO nasaq_app;
GRANT USAGE, SELECT ON SEQUENCE "security_events_sequence_seq" TO nasaq_app;

ALTER TABLE "tenant_onboardings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_onboardings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "tenant_onboardings"
  USING ("trust_id" = current_setting('app.current_trust_id', true))
  WITH CHECK ("trust_id" = current_setting('app.current_trust_id', true));

ALTER TABLE "staff_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_invitations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_invitations"
  USING ("trust_id" = current_setting('app.current_trust_id', true))
  WITH CHECK ("trust_id" = current_setting('app.current_trust_id', true));
