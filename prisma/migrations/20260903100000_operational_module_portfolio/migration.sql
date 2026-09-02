CREATE TYPE "OperationalModuleKey" AS ENUM ('TIMETABLE', 'HOMEWORK', 'LESSON_PLANNING', 'LIBRARY', 'TRANSPORT', 'HOSTEL', 'HR', 'LEAVE', 'PAYROLL', 'HEALTH', 'VISITORS', 'RECEPTION', 'INVENTORY', 'CERTIFICATES', 'ALUMNI', 'COMMUNICATIONS', 'EVENTS', 'ACTIVITIES', 'DISCIPLINE', 'DOCUMENTS', 'SUPPORT');
CREATE TYPE "OperationalRecordState" AS ENUM ('DRAFT', 'ACTIVE', 'PENDING_APPROVAL', 'APPROVED', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "OperationalSensitivity" AS ENUM ('STANDARD', 'SENSITIVE', 'RESTRICTED');

CREATE TABLE "operational_records" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "campus_id" TEXT,
  "academic_year_id" TEXT,
  "module" "OperationalModuleKey" NOT NULL,
  "record_type" TEXT NOT NULL,
  "reference_number" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "state" "OperationalRecordState" NOT NULL DEFAULT 'DRAFT',
  "sensitivity" "OperationalSensitivity" NOT NULL DEFAULT 'STANDARD',
  "details" JSONB,
  "effective_from" TIMESTAMP(3),
  "effective_to" TIMESTAMP(3),
  "assigned_to_user_id" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by" TEXT NOT NULL,
  "updated_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "operational_record_dates_check" CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" >= "effective_from"),
  CONSTRAINT "operational_record_version_check" CHECK ("version" > 0),
  CONSTRAINT "operational_record_reference_check" CHECK ("reference_number" ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  CONSTRAINT "operational_record_type_check" CHECK ("record_type" ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  CONSTRAINT "operational_sensitive_details_check" CHECK ("sensitivity" = 'STANDARD' OR "details" IS NULL),
  CONSTRAINT "operational_record_school_fk" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "operational_record_campus_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "operational_record_year_fk" FOREIGN KEY ("trust_id", "school_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "operational_record_assignee_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "operational_record_creator_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "operational_record_updater_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "operational_records_scope_id_key" ON "operational_records"("trust_id", "school_id", "id");
CREATE UNIQUE INDEX "operational_records_reference_key" ON "operational_records"("trust_id", "school_id", "module", "reference_number");
CREATE INDEX "operational_records_workspace_idx" ON "operational_records"("trust_id", "school_id", "campus_id", "academic_year_id", "module", "state", "updated_at");
CREATE INDEX "operational_records_type_idx" ON "operational_records"("trust_id", "school_id", "module", "record_type", "state");
CREATE INDEX "operational_records_assignee_idx" ON "operational_records"("trust_id", "assigned_to_user_id", "module", "state");

CREATE TABLE "operational_record_events" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "module" "OperationalModuleKey" NOT NULL,
  "action" TEXT NOT NULL,
  "from_state" "OperationalRecordState",
  "to_state" "OperationalRecordState" NOT NULL,
  "reason" TEXT,
  "changes" JSONB,
  "actor_user_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_event_record_fk" FOREIGN KEY ("trust_id", "school_id", "record_id") REFERENCES "operational_records"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "operational_event_trust_fk" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT,
  CONSTRAINT "operational_event_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "operational_record_events_record_idx" ON "operational_record_events"("trust_id", "school_id", "record_id", "occurred_at");
CREATE INDEX "operational_record_events_module_idx" ON "operational_record_events"("trust_id", "school_id", "module", "occurred_at");

CREATE FUNCTION reject_operational_record_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Operational record events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "operational_record_events_immutable"
BEFORE UPDATE OR DELETE ON "operational_record_events"
FOR EACH ROW EXECUTE FUNCTION reject_operational_record_event_mutation();

ALTER TABLE "operational_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operational_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "operational_records_tenant_isolation" ON "operational_records"
  USING ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''))
  WITH CHECK ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''));

ALTER TABLE "operational_record_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operational_record_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "operational_record_events_tenant_isolation" ON "operational_record_events"
  USING ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''))
  WITH CHECK ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''));

GRANT SELECT, INSERT, UPDATE ON "operational_records" TO nasaq_app;
GRANT SELECT, INSERT ON "operational_record_events" TO nasaq_app;
