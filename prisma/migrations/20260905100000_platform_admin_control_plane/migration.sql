-- NASAQ platform control plane: platform role assignments, feature entitlements,
-- time-bound support access, and richer invitation identity metadata.

ALTER TABLE "staff_invitations"
  ADD COLUMN "first_name" TEXT,
  ADD COLUMN "last_name" TEXT,
  ADD COLUMN "phone" TEXT;

ALTER TABLE "user_role_assignments"
  ADD COLUMN "support_access_grant_id" TEXT;

CREATE TABLE "platform_role_assignments" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by" TEXT,
  "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_role_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "platform_role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "platform_role_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "platform_role_assignments_user_id_role_id_key" ON "platform_role_assignments"("user_id", "role_id");
CREATE INDEX "platform_role_assignments_user_id_status_effective_from_effective_to_idx" ON "platform_role_assignments"("user_id", "status", "effective_from", "effective_to");

CREATE TABLE "tenant_feature_grants" (
  "id" TEXT NOT NULL,
  "platform_id" TEXT NOT NULL,
  "trust_id" TEXT NOT NULL,
  "feature_key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updated_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_feature_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_feature_grants_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tenant_feature_grants_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tenant_feature_grants_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tenant_feature_grants_trust_id_feature_key_key" ON "tenant_feature_grants"("trust_id", "feature_key");
CREATE INDEX "tenant_feature_grants_platform_id_enabled_feature_key_idx" ON "tenant_feature_grants"("platform_id", "enabled", "feature_key");

CREATE TABLE "support_access_grants" (
  "id" TEXT NOT NULL,
  "trust_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "revoked_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_access_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_access_grants_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "support_access_grants_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "support_access_grants_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "support_access_grants_actor_user_id_trust_id_expires_at_revoked_at_idx" ON "support_access_grants"("actor_user_id", "trust_id", "expires_at", "revoked_at");
CREATE INDEX "user_role_assignments_support_access_grant_id_idx" ON "user_role_assignments"("support_access_grant_id");
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_support_access_grant_id_fkey" FOREIGN KEY ("support_access_grant_id") REFERENCES "support_access_grants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE POLICY "trusts_platform_admin_select" ON "trusts" FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'true');

ALTER TABLE "tenant_feature_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_feature_grants" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_feature_grants_access" ON "tenant_feature_grants"
  USING ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), '') OR current_setting('app.platform_admin', true) = 'true')
  WITH CHECK ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), '') OR current_setting('app.platform_admin', true) = 'true');

ALTER TABLE "support_access_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_access_grants" FORCE ROW LEVEL SECURITY;
CREATE POLICY "support_access_grants_access" ON "support_access_grants"
  USING ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), '') OR current_setting('app.platform_admin', true) = 'true')
  WITH CHECK (current_setting('app.platform_admin', true) = 'true');

GRANT SELECT ON "platform_role_assignments" TO nasaq_app;
GRANT SELECT, INSERT, UPDATE ON "tenant_feature_grants", "support_access_grants" TO nasaq_app;
