CREATE TYPE "AdmissionStage" AS ENUM ('ENQUIRY','CONTACTED','FOLLOW_UP_SCHEDULED','APPLICATION_STARTED','APPLICATION_SUBMITTED','DOCUMENTS_PENDING','UNDER_REVIEW','ASSESSMENT_SCHEDULED','INTERVIEW_SCHEDULED','OFFERED','WAITLISTED','ADMITTED','REJECTED','WITHDRAWN');
CREATE TYPE "AdmissionFormKind" AS ENUM ('ENQUIRY','APPLICATION');
CREATE TYPE "AdmissionFormStatus" AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE "AdmissionTaskStatus" AS ENUM ('OPEN','COMPLETED','CANCELLED');
CREATE TYPE "AdmissionDocumentStatus" AS ENUM ('PENDING','RECEIVED','VERIFIED','REJECTED','WAIVED');
CREATE TYPE "AdmissionFeeStatus" AS ENUM ('NOT_REQUIRED','PENDING','PAID','WAIVED','REFUNDED');
CREATE TYPE "AdmissionScheduleType" AS ENUM ('ASSESSMENT','INTERVIEW');
CREATE TYPE "AdmissionScheduleStatus" AS ENUM ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW');
CREATE TYPE "AdmissionNotificationChannel" AS ENUM ('EMAIL','WHATSAPP');
ALTER TYPE "RateLimitAction" ADD VALUE 'PUBLIC_ADMISSIONS';

CREATE TABLE "admission_forms" (
  "id" TEXT NOT NULL, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL, "kind" "AdmissionFormKind" NOT NULL,
  "code" TEXT NOT NULL, "name" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "fields" JSONB NOT NULL, "status" "AdmissionFormStatus" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMP(3), "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "admission_forms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admission_public_form_directory" (
  "public_key" TEXT NOT NULL, "form_id" TEXT NOT NULL, "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL, "academic_year_id" TEXT NOT NULL,
  "kind" "AdmissionFormKind" NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admission_public_form_directory_pkey" PRIMARY KEY ("public_key")
);

CREATE TABLE "admission_applications" (
  "id" TEXT NOT NULL, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL,
  "campus_id" TEXT, "academic_year_id" TEXT NOT NULL, "form_id" TEXT,
  "target_grade_class_id" TEXT, "counselor_user_id" TEXT,
  "sibling_student_profile_id" TEXT, "possible_duplicate_of_id" TEXT,
  "converted_student_profile_id" TEXT, "reference_number" TEXT NOT NULL,
  "application_number" TEXT, "stage" "AdmissionStage" NOT NULL DEFAULT 'ENQUIRY',
  "source" TEXT NOT NULL, "applicant_name" TEXT NOT NULL, "date_of_birth" DATE,
  "email" TEXT, "phone" TEXT, "email_hash" TEXT, "phone_hash" TEXT, "answers" JSONB,
  "fee_amount_minor" INTEGER NOT NULL DEFAULT 0, "fee_currency" TEXT NOT NULL DEFAULT 'INR',
  "fee_status" "AdmissionFeeStatus" NOT NULL DEFAULT 'NOT_REQUIRED', "fee_reference" TEXT,
  "converted_at" TIMESTAMP(3), "archived_at" TIMESTAMP(3), "created_by" TEXT,
  "updated_by" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admission_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admission_activities" (
  "id" TEXT NOT NULL, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL, "actor_user_id" TEXT, "type" TEXT NOT NULL,
  "from_stage" "AdmissionStage", "to_stage" "AdmissionStage", "note" TEXT,
  "metadata" JSONB, "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admission_follow_ups" (
  "id" TEXT NOT NULL, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL, "assignee_user_id" TEXT, "title" TEXT NOT NULL,
  "due_at" TIMESTAMP(3) NOT NULL, "status" "AdmissionTaskStatus" NOT NULL DEFAULT 'OPEN',
  "completed_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "admission_follow_ups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admission_documents" (
  "id" TEXT NOT NULL, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL, "code" TEXT NOT NULL, "label" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true, "storage_key" TEXT, "display_name" TEXT,
  "mime_type" TEXT, "size_bytes" INTEGER,
  "status" "AdmissionDocumentStatus" NOT NULL DEFAULT 'PENDING', "uploaded_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admission_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admission_schedules" (
  "id" TEXT NOT NULL, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL, "assignee_user_id" TEXT,
  "type" "AdmissionScheduleType" NOT NULL, "scheduled_for" TIMESTAMP(3) NOT NULL,
  "duration_minutes" INTEGER NOT NULL DEFAULT 30, "location" TEXT,
  "status" "AdmissionScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admission_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admission_seat_plans" (
  "id" TEXT NOT NULL, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL, "grade_class_id" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL, "hold_offered_seats" BOOLEAN NOT NULL DEFAULT true,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admission_seat_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admission_notification_previews" (
  "id" TEXT NOT NULL, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL, "channel" "AdmissionNotificationChannel" NOT NULL,
  "template_key" TEXT NOT NULL, "recipient_masked" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_notification_previews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admission_forms_trust_id_school_id_academic_year_id_kind_st_idx" ON "admission_forms"("trust_id","school_id","academic_year_id","kind","status");
CREATE UNIQUE INDEX "admission_forms_trust_id_school_id_id_key" ON "admission_forms"("trust_id","school_id","id");
CREATE UNIQUE INDEX "admission_forms_trust_id_school_id_academic_year_id_kind_co_key" ON "admission_forms"("trust_id","school_id","academic_year_id","kind","code","version");
CREATE UNIQUE INDEX "admission_public_form_directory_form_id_key" ON "admission_public_form_directory"("form_id");
CREATE INDEX "admission_public_form_directory_active_kind_idx" ON "admission_public_form_directory"("active","kind");
CREATE UNIQUE INDEX "admission_applications_converted_student_profile_id_key" ON "admission_applications"("converted_student_profile_id");
CREATE INDEX "admission_applications_trust_id_school_id_academic_year_id__idx" ON "admission_applications"("trust_id","school_id","academic_year_id","stage","created_at");
CREATE INDEX "admission_applications_trust_id_school_id_counselor_user_id_idx" ON "admission_applications"("trust_id","school_id","counselor_user_id","stage");
CREATE INDEX "admission_applications_trust_id_school_id_target_grade_clas_idx" ON "admission_applications"("trust_id","school_id","target_grade_class_id","stage");
CREATE INDEX "admission_applications_trust_id_school_id_email_hash_idx" ON "admission_applications"("trust_id","school_id","email_hash");
CREATE INDEX "admission_applications_trust_id_school_id_phone_hash_idx" ON "admission_applications"("trust_id","school_id","phone_hash");
CREATE UNIQUE INDEX "admission_applications_trust_id_school_id_id_key" ON "admission_applications"("trust_id","school_id","id");
CREATE UNIQUE INDEX "admission_applications_trust_id_school_id_reference_number_key" ON "admission_applications"("trust_id","school_id","reference_number");
CREATE UNIQUE INDEX "admission_applications_trust_id_school_id_application_numbe_key" ON "admission_applications"("trust_id","school_id","application_number");
CREATE INDEX "admission_activities_trust_id_school_id_application_id_occu_idx" ON "admission_activities"("trust_id","school_id","application_id","occurred_at");
CREATE INDEX "admission_follow_ups_trust_id_school_id_assignee_user_id_st_idx" ON "admission_follow_ups"("trust_id","school_id","assignee_user_id","status","due_at");
CREATE INDEX "admission_documents_trust_id_school_id_application_id_statu_idx" ON "admission_documents"("trust_id","school_id","application_id","status");
CREATE UNIQUE INDEX "admission_documents_trust_id_school_id_application_id_code_key" ON "admission_documents"("trust_id","school_id","application_id","code");
CREATE INDEX "admission_schedules_trust_id_school_id_type_scheduled_for_s_idx" ON "admission_schedules"("trust_id","school_id","type","scheduled_for","status");
CREATE INDEX "admission_seat_plans_trust_id_school_id_academic_year_id_st_idx" ON "admission_seat_plans"("trust_id","school_id","academic_year_id","status");
CREATE UNIQUE INDEX "admission_seat_plans_trust_id_school_id_academic_year_id_gr_key" ON "admission_seat_plans"("trust_id","school_id","academic_year_id","grade_class_id");
CREATE INDEX "admission_notification_previews_trust_id_school_id_applicat_idx" ON "admission_notification_previews"("trust_id","school_id","application_id","created_at");

ALTER TABLE "admission_forms" ADD CONSTRAINT "admission_forms_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_forms" ADD CONSTRAINT "admission_forms_trust_id_school_id_fkey" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_forms" ADD CONSTRAINT "admission_forms_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id","academic_year_id") REFERENCES "academic_years"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_public_form_directory" ADD CONSTRAINT "admission_public_form_directory_trust_id_school_id_form_id_fkey" FOREIGN KEY ("trust_id","school_id","form_id") REFERENCES "admission_forms"("trust_id","school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_trust_id_school_id_fkey" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id","school_id","campus_id") REFERENCES "campuses"("trust_id","school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id","academic_year_id") REFERENCES "academic_years"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_trust_id_school_id_form_id_fkey" FOREIGN KEY ("trust_id","school_id","form_id") REFERENCES "admission_forms"("trust_id","school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_trust_id_school_id_target_grade_cla_fkey" FOREIGN KEY ("trust_id","school_id","target_grade_class_id") REFERENCES "grade_classes"("trust_id","school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_counselor_user_id_fkey" FOREIGN KEY ("counselor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_trust_id_sibling_student_profile_id_fkey" FOREIGN KEY ("trust_id","sibling_student_profile_id") REFERENCES "student_profiles"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_trust_id_converted_student_profile__fkey" FOREIGN KEY ("trust_id","converted_student_profile_id") REFERENCES "student_profiles"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_trust_id_school_id_possible_duplica_fkey" FOREIGN KEY ("trust_id","school_id","possible_duplicate_of_id") REFERENCES "admission_applications"("trust_id","school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_activities" ADD CONSTRAINT "admission_activities_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_activities" ADD CONSTRAINT "admission_activities_trust_id_school_id_fkey" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_activities" ADD CONSTRAINT "admission_activities_trust_id_school_id_application_id_fkey" FOREIGN KEY ("trust_id","school_id","application_id") REFERENCES "admission_applications"("trust_id","school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_activities" ADD CONSTRAINT "admission_activities_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admission_follow_ups" ADD CONSTRAINT "admission_follow_ups_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_follow_ups" ADD CONSTRAINT "admission_follow_ups_trust_id_school_id_fkey" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_follow_ups" ADD CONSTRAINT "admission_follow_ups_trust_id_school_id_application_id_fkey" FOREIGN KEY ("trust_id","school_id","application_id") REFERENCES "admission_applications"("trust_id","school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_follow_ups" ADD CONSTRAINT "admission_follow_ups_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_trust_id_school_id_fkey" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_trust_id_school_id_application_id_fkey" FOREIGN KEY ("trust_id","school_id","application_id") REFERENCES "admission_applications"("trust_id","school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admission_schedules" ADD CONSTRAINT "admission_schedules_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_schedules" ADD CONSTRAINT "admission_schedules_trust_id_school_id_fkey" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_schedules" ADD CONSTRAINT "admission_schedules_trust_id_school_id_application_id_fkey" FOREIGN KEY ("trust_id","school_id","application_id") REFERENCES "admission_applications"("trust_id","school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_schedules" ADD CONSTRAINT "admission_schedules_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admission_seat_plans" ADD CONSTRAINT "admission_seat_plans_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_seat_plans" ADD CONSTRAINT "admission_seat_plans_trust_id_school_id_fkey" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_seat_plans" ADD CONSTRAINT "admission_seat_plans_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id","academic_year_id") REFERENCES "academic_years"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_seat_plans" ADD CONSTRAINT "admission_seat_plans_trust_id_school_id_grade_class_id_fkey" FOREIGN KEY ("trust_id","school_id","grade_class_id") REFERENCES "grade_classes"("trust_id","school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_notification_previews" ADD CONSTRAINT "admission_notification_previews_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_notification_previews" ADD CONSTRAINT "admission_notification_previews_trust_id_school_id_fkey" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_notification_previews" ADD CONSTRAINT "admission_notification_previews_trust_id_school_id_applica_fkey" FOREIGN KEY ("trust_id","school_id","application_id") REFERENCES "admission_applications"("trust_id","school_id","id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_fee_amount_check" CHECK ("fee_amount_minor" >= 0);
ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_document_size_check" CHECK ("size_bytes" IS NULL OR ("size_bytes" > 0 AND "size_bytes" <= 25000000));
ALTER TABLE "admission_schedules" ADD CONSTRAINT "admission_schedule_duration_check" CHECK ("duration_minutes" BETWEEN 10 AND 480);
ALTER TABLE "admission_seat_plans" ADD CONSTRAINT "admission_seat_capacity_check" CHECK ("capacity" >= 0);

CREATE OR REPLACE FUNCTION prevent_admission_activity_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'admission activities are append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "admission_activities_no_update" BEFORE UPDATE OR DELETE ON "admission_activities" FOR EACH ROW EXECUTE FUNCTION prevent_admission_activity_mutation();

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'admission_forms','admission_applications','admission_activities','admission_follow_ups',
    'admission_documents','admission_schedules','admission_seat_plans','admission_notification_previews'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (trust_id = current_setting(''app.current_trust_id'', true)) WITH CHECK (trust_id = current_setting(''app.current_trust_id'', true))', table_name);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "admission_forms","admission_applications","admission_follow_ups","admission_documents","admission_schedules","admission_seat_plans" TO nasaq_app;
GRANT SELECT, INSERT ON "admission_activities","admission_notification_previews" TO nasaq_app;
GRANT SELECT, INSERT, UPDATE ON "admission_public_form_directory" TO nasaq_app;
