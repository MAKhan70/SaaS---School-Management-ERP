CREATE TYPE "AiAssistanceFeature" AS ENUM ('REPORT_CARD_REMARK', 'HOMEWORK_QUESTIONS', 'LESSON_PLAN_OUTLINE', 'NATURAL_LANGUAGE_FILTER', 'ADMIN_REPORT_SUMMARY');
CREATE TYPE "AiProviderKind" AS ENUM ('LOCAL_MOCK', 'EXTERNAL');
CREATE TYPE "AiDraftStatus" AS ENUM ('DRAFT', 'ACCEPTED', 'EDITED', 'DISMISSED');
CREATE TYPE "SupportIndicatorStatus" AS ENUM ('OPEN', 'CORRECTED', 'DISMISSED', 'RESOLVED');

CREATE TABLE "ai_assistance_records" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "campus_id" TEXT,
  "academic_year_id" TEXT,
  "feature" "AiAssistanceFeature" NOT NULL,
  "provider" "AiProviderKind" NOT NULL DEFAULT 'LOCAL_MOCK',
  "provider_version" TEXT NOT NULL,
  "input_snapshot" JSONB NOT NULL,
  "input_hash" TEXT NOT NULL,
  "draft_output" TEXT NOT NULL,
  "fallback_output" TEXT NOT NULL,
  "final_output" TEXT,
  "status" "AiDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "created_by" TEXT NOT NULL,
  "reviewed_by" TEXT,
  "reviewer_note" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_assistance_school_fk" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "ai_assistance_campus_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "ai_assistance_year_fk" FOREIGN KEY ("trust_id", "school_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "ai_assistance_creator_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "ai_assistance_reviewer_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "ai_assistance_input_hash_check" CHECK ("input_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "ai_assistance_review_check" CHECK (
    ("status" = 'DRAFT' AND "reviewed_at" IS NULL AND "reviewed_by" IS NULL)
    OR ("status" <> 'DRAFT' AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "ai_assistance_scope_id_key" ON "ai_assistance_records"("trust_id", "school_id", "id");
CREATE INDEX "ai_assistance_workspace_idx" ON "ai_assistance_records"("trust_id", "school_id", "campus_id", "academic_year_id", "feature", "status", "created_at");
CREATE INDEX "ai_assistance_creator_idx" ON "ai_assistance_records"("trust_id", "created_by", "created_at");

CREATE TABLE "ai_assistance_audit_events" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "assistance_record_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "provider_version" TEXT NOT NULL,
  "input_hash" TEXT NOT NULL,
  "output_hash" TEXT NOT NULL,
  "reviewer_action" TEXT,
  "actor_user_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_assistance_audit_record_fk" FOREIGN KEY ("trust_id", "school_id", "assistance_record_id") REFERENCES "ai_assistance_records"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "ai_assistance_audit_trust_fk" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT,
  CONSTRAINT "ai_assistance_audit_school_fk" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "ai_assistance_audit_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "ai_assistance_audit_hashes_check" CHECK ("input_hash" ~ '^[a-f0-9]{64}$' AND "output_hash" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX "ai_assistance_audit_record_idx" ON "ai_assistance_audit_events"("trust_id", "school_id", "assistance_record_id", "occurred_at");
CREATE INDEX "ai_assistance_audit_action_idx" ON "ai_assistance_audit_events"("trust_id", "school_id", "action", "occurred_at");

CREATE TABLE "student_support_indicators" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "campus_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "student_profile_id" TEXT NOT NULL,
  "rule_key" TEXT NOT NULL,
  "rule_version" TEXT NOT NULL,
  "observed_on" DATE NOT NULL,
  "input_snapshot" JSONB NOT NULL,
  "factors" JSONB NOT NULL,
  "reason_summary" TEXT NOT NULL,
  "status" "SupportIndicatorStatus" NOT NULL DEFAULT 'OPEN',
  "reviewed_by" TEXT,
  "reviewer_note" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_indicator_school_fk" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "support_indicator_campus_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "support_indicator_year_fk" FOREIGN KEY ("trust_id", "school_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "support_indicator_student_fk" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "support_indicator_reviewer_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "support_indicator_rule_key_check" CHECK ("rule_key" ~ '^[a-z][a-z0-9_.-]{2,79}$')
);
CREATE UNIQUE INDEX "support_indicator_version_key" ON "student_support_indicators"("trust_id", "school_id", "academic_year_id", "student_profile_id", "rule_key", "rule_version", "observed_on");
CREATE UNIQUE INDEX "support_indicator_scope_id_key" ON "student_support_indicators"("trust_id", "school_id", "id");
CREATE INDEX "support_indicator_workspace_idx" ON "student_support_indicators"("trust_id", "school_id", "campus_id", "academic_year_id", "status", "observed_on");
CREATE INDEX "support_indicator_student_idx" ON "student_support_indicators"("trust_id", "student_profile_id", "status", "observed_on");

CREATE TABLE "student_support_indicator_events" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "indicator_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "from_status" "SupportIndicatorStatus",
  "to_status" "SupportIndicatorStatus" NOT NULL,
  "note" TEXT NOT NULL,
  "factors" JSONB,
  "actor_user_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_indicator_event_record_fk" FOREIGN KEY ("trust_id", "school_id", "indicator_id") REFERENCES "student_support_indicators"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "support_indicator_event_trust_fk" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT,
  CONSTRAINT "support_indicator_event_school_fk" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "support_indicator_event_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX "support_indicator_event_record_idx" ON "student_support_indicator_events"("trust_id", "school_id", "indicator_id", "occurred_at");
CREATE INDEX "support_indicator_event_action_idx" ON "student_support_indicator_events"("trust_id", "school_id", "action", "occurred_at");

CREATE FUNCTION reject_responsible_ai_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Responsible AI audit events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ai_assistance_audit_events_immutable"
BEFORE UPDATE OR DELETE ON "ai_assistance_audit_events"
FOR EACH ROW EXECUTE FUNCTION reject_responsible_ai_audit_mutation();
CREATE TRIGGER "support_indicator_events_immutable"
BEFORE UPDATE OR DELETE ON "student_support_indicator_events"
FOR EACH ROW EXECUTE FUNCTION reject_responsible_ai_audit_mutation();

ALTER TABLE "ai_assistance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_assistance_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_assistance_records_tenant_isolation" ON "ai_assistance_records"
  USING ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''))
  WITH CHECK ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''));
ALTER TABLE "ai_assistance_audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_assistance_audit_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_assistance_audit_events_tenant_isolation" ON "ai_assistance_audit_events"
  USING ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''))
  WITH CHECK ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''));
ALTER TABLE "student_support_indicators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_support_indicators" FORCE ROW LEVEL SECURITY;
CREATE POLICY "student_support_indicators_tenant_isolation" ON "student_support_indicators"
  USING ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''))
  WITH CHECK ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''));
ALTER TABLE "student_support_indicator_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_support_indicator_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "student_support_indicator_events_tenant_isolation" ON "student_support_indicator_events"
  USING ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''))
  WITH CHECK ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''));

GRANT SELECT, INSERT, UPDATE ON "ai_assistance_records" TO nasaq_app;
GRANT SELECT, INSERT ON "ai_assistance_audit_events" TO nasaq_app;
GRANT SELECT, INSERT, UPDATE ON "student_support_indicators" TO nasaq_app;
GRANT SELECT, INSERT ON "student_support_indicator_events" TO nasaq_app;
