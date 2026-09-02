CREATE TYPE "ExaminationState" AS ENUM ('DRAFT', 'MARKS_ENTRY', 'APPROVED', 'LOCKED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "AssessmentComponentKind" AS ENUM ('INTERNAL_ASSESSMENT', 'PROJECT', 'PRACTICAL', 'VIVA', 'THEORY', 'CO_SCHOLASTIC', 'CUSTOM');
CREATE TYPE "GradebookState" AS ENUM ('ENTRY', 'APPROVED', 'LOCKED', 'REOPENED');
CREATE TYPE "MarkEntryStatus" AS ENUM ('MARKED', 'ABSENT', 'EXEMPT');
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "StudentResultState" AS ENUM ('CALCULATED', 'PUBLISHED', 'SUPERSEDED');
CREATE TYPE "PromotionRecommendation" AS ENUM ('PROMOTE', 'PROMOTE_WITH_SUPPORT', 'DETAIN', 'REVIEW_REQUIRED', 'NOT_APPLICABLE');
CREATE TYPE "ReportGenerationKind" AS ENUM ('PREVIEW', 'INDIVIDUAL', 'BULK');
CREATE TYPE "ReportGenerationState" AS ENUM ('QUEUED', 'GENERATED', 'FAILED');

CREATE UNIQUE INDEX "academic_years_trust_school_id_key" ON "academic_years"("trust_id", "school_id", "id");

CREATE TABLE "examination_rule_sets" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "board_configuration_id" TEXT NOT NULL,
  "grading_scale_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "rules" JSONB NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "examination_rule_sets_version_check" CHECK ("version" > 0),
  CONSTRAINT "examination_rule_sets_dates_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from"),
  CONSTRAINT "examination_rule_sets_school_fk" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "examination_rule_sets_board_fk" FOREIGN KEY ("trust_id", "school_id", "board_configuration_id") REFERENCES "board_configurations"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "examination_rule_sets_scale_fk" FOREIGN KEY ("trust_id", "school_id", "grading_scale_id") REFERENCES "grading_scales"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "examination_rule_sets_creator_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "examination_rule_sets_scope_id_key" ON "examination_rule_sets"("trust_id", "school_id", "id");
CREATE UNIQUE INDEX "examination_rule_sets_code_version_key" ON "examination_rule_sets"("trust_id", "school_id", "code", "version");
CREATE INDEX "examination_rule_sets_active_idx" ON "examination_rule_sets"("trust_id", "school_id", "status", "effective_from", "effective_to");

CREATE TABLE "examinations" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "campus_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "academic_term_id" TEXT,
  "rule_set_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "examination_type" TEXT NOT NULL,
  "assessment_group" TEXT NOT NULL,
  "state" "ExaminationState" NOT NULL DEFAULT 'DRAFT',
  "starts_on" DATE NOT NULL,
  "ends_on" DATE NOT NULL,
  "marks_entry_ends_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "published_by" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "examinations_dates_check" CHECK ("ends_on" >= "starts_on"),
  CONSTRAINT "examinations_school_fk" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "examinations_campus_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "examinations_year_fk" FOREIGN KEY ("trust_id", "school_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "examinations_term_fk" FOREIGN KEY ("trust_id", "school_id", "academic_year_id", "academic_term_id") REFERENCES "academic_terms"("trust_id", "school_id", "academic_year_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "examinations_rule_fk" FOREIGN KEY ("trust_id", "school_id", "rule_set_id") REFERENCES "examination_rule_sets"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "examinations_publisher_fk" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "examinations_creator_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "examinations_scope_id_key" ON "examinations"("trust_id", "school_id", "id");
CREATE UNIQUE INDEX "examinations_code_key" ON "examinations"("trust_id", "school_id", "academic_year_id", "campus_id", "code");
CREATE INDEX "examinations_workspace_idx" ON "examinations"("trust_id", "school_id", "campus_id", "academic_year_id", "state", "starts_on");

CREATE TABLE "examination_subjects" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "campus_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "examination_id" TEXT NOT NULL,
  "section_id" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "assigned_teacher_user_id" TEXT,
  "display_order" INTEGER NOT NULL DEFAULT 1,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "examination_subjects_examination_fk" FOREIGN KEY ("trust_id", "school_id", "examination_id") REFERENCES "examinations"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "examination_subjects_section_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id") REFERENCES "sections"("trust_id", "school_id", "campus_id", "academic_year_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "examination_subjects_subject_fk" FOREIGN KEY ("trust_id", "school_id", "subject_id") REFERENCES "subjects"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "examination_subjects_teacher_fk" FOREIGN KEY ("assigned_teacher_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "examination_subjects_scope_id_key" ON "examination_subjects"("trust_id", "school_id", "id");
CREATE UNIQUE INDEX "examination_subjects_offering_key" ON "examination_subjects"("trust_id", "school_id", "examination_id", "section_id", "subject_id");
CREATE INDEX "examination_subjects_section_idx" ON "examination_subjects"("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "status");
CREATE INDEX "examination_subjects_teacher_idx" ON "examination_subjects"("trust_id", "assigned_teacher_user_id", "status");

CREATE TABLE "assessment_components" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "examination_subject_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "AssessmentComponentKind" NOT NULL,
  "maximum_marks" DECIMAL(8,2) NOT NULL,
  "passing_marks" DECIMAL(8,2),
  "weightage_percent" DECIMAL(7,4) NOT NULL,
  "is_co_scholastic" BOOLEAN NOT NULL DEFAULT false,
  "display_order" INTEGER NOT NULL DEFAULT 1,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assessment_components_marks_check" CHECK ("maximum_marks" > 0 AND ("passing_marks" IS NULL OR ("passing_marks" >= 0 AND "passing_marks" <= "maximum_marks"))),
  CONSTRAINT "assessment_components_weight_check" CHECK ("weightage_percent" > 0 AND "weightage_percent" <= 100),
  CONSTRAINT "assessment_components_subject_fk" FOREIGN KEY ("trust_id", "school_id", "examination_subject_id") REFERENCES "examination_subjects"("trust_id", "school_id", "id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "assessment_components_scope_id_key" ON "assessment_components"("trust_id", "school_id", "id");
CREATE UNIQUE INDEX "assessment_components_code_key" ON "assessment_components"("trust_id", "school_id", "examination_subject_id", "code");
CREATE INDEX "assessment_components_order_idx" ON "assessment_components"("trust_id", "school_id", "examination_subject_id", "status", "display_order");

CREATE TABLE "gradebook_registers" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "campus_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "examination_subject_id" TEXT NOT NULL,
  "state" "GradebookState" NOT NULL DEFAULT 'ENTRY',
  "version" INTEGER NOT NULL DEFAULT 1,
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "locked_by" TEXT,
  "locked_at" TIMESTAMP(3),
  "reopened_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gradebook_registers_version_check" CHECK ("version" > 0),
  CONSTRAINT "gradebook_registers_subject_fk" FOREIGN KEY ("trust_id", "school_id", "examination_subject_id") REFERENCES "examination_subjects"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "gradebook_registers_approver_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "gradebook_registers_locker_fk" FOREIGN KEY ("locked_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "gradebook_registers_scope_id_key" ON "gradebook_registers"("trust_id", "school_id", "id");
CREATE UNIQUE INDEX "gradebook_registers_subject_key" ON "gradebook_registers"("trust_id", "school_id", "examination_subject_id");
CREATE INDEX "gradebook_registers_state_idx" ON "gradebook_registers"("trust_id", "school_id", "campus_id", "academic_year_id", "state");

CREATE TABLE "mark_entries" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "campus_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "section_id" TEXT NOT NULL,
  "register_id" TEXT NOT NULL,
  "examination_subject_id" TEXT NOT NULL,
  "component_id" TEXT NOT NULL,
  "enrollment_id" TEXT NOT NULL,
  "student_profile_id" TEXT NOT NULL,
  "status" "MarkEntryStatus" NOT NULL DEFAULT 'MARKED',
  "marks" DECIMAL(8,2),
  "teacher_remark" TEXT,
  "entered_by" TEXT NOT NULL,
  "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mark_entries_shape_check" CHECK (("status" = 'MARKED' AND "marks" IS NOT NULL AND "marks" >= 0) OR ("status" IN ('ABSENT', 'EXEMPT') AND "marks" IS NULL)),
  CONSTRAINT "mark_entries_register_fk" FOREIGN KEY ("trust_id", "school_id", "register_id") REFERENCES "gradebook_registers"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "mark_entries_subject_fk" FOREIGN KEY ("trust_id", "school_id", "examination_subject_id") REFERENCES "examination_subjects"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "mark_entries_component_fk" FOREIGN KEY ("trust_id", "school_id", "component_id") REFERENCES "assessment_components"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "mark_entries_enrollment_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "enrollment_id") REFERENCES "student_enrollments"("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "mark_entries_student_fk" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "mark_entries_enterer_fk" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "mark_entries_updater_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "mark_entries_scope_id_key" ON "mark_entries"("trust_id", "school_id", "id");
CREATE UNIQUE INDEX "mark_entries_student_component_key" ON "mark_entries"("trust_id", "school_id", "register_id", "component_id", "student_profile_id");
CREATE INDEX "mark_entries_subject_student_idx" ON "mark_entries"("trust_id", "school_id", "examination_subject_id", "student_profile_id");
CREATE INDEX "mark_entries_student_year_idx" ON "mark_entries"("trust_id", "school_id", "academic_year_id", "student_profile_id");

CREATE FUNCTION enforce_mark_entry_maximum() RETURNS trigger AS $$
DECLARE allowed DECIMAL(8,2); component_subject TEXT;
BEGIN
  SELECT maximum_marks, examination_subject_id INTO allowed, component_subject FROM assessment_components
  WHERE trust_id = NEW.trust_id AND school_id = NEW.school_id AND id = NEW.component_id;
  IF component_subject IS DISTINCT FROM NEW.examination_subject_id THEN RAISE EXCEPTION 'assessment component scope mismatch'; END IF;
  IF NEW.status = 'MARKED' AND NEW.marks > allowed THEN RAISE EXCEPTION 'marks exceed component maximum'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "mark_entries_maximum_guard" BEFORE INSERT OR UPDATE ON "mark_entries" FOR EACH ROW EXECUTE FUNCTION enforce_mark_entry_maximum();

CREATE TABLE "mark_entry_changes" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "mark_entry_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "from_status" "MarkEntryStatus",
  "to_status" "MarkEntryStatus" NOT NULL,
  "from_marks" DECIMAL(8,2),
  "to_marks" DECIMAL(8,2),
  "reason" TEXT NOT NULL,
  "post_lock_change" BOOLEAN NOT NULL DEFAULT false,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mark_entry_changes_entry_fk" FOREIGN KEY ("trust_id", "school_id", "mark_entry_id") REFERENCES "mark_entries"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "mark_entry_changes_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX "mark_entry_changes_timeline_idx" ON "mark_entry_changes"("trust_id", "school_id", "mark_entry_id", "occurred_at");
CREATE INDEX "mark_entry_changes_actor_idx" ON "mark_entry_changes"("trust_id", "actor_user_id", "occurred_at");

CREATE TABLE "mark_moderation_requests" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "mark_entry_id" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "decided_by" TEXT,
  "proposed_status" "MarkEntryStatus" NOT NULL,
  "proposed_marks" DECIMAL(8,2),
  "reason" TEXT NOT NULL,
  "decision_note" TEXT,
  "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
  "decided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mark_moderation_shape_check" CHECK (("proposed_status" = 'MARKED' AND "proposed_marks" IS NOT NULL AND "proposed_marks" >= 0) OR ("proposed_status" IN ('ABSENT', 'EXEMPT') AND "proposed_marks" IS NULL)),
  CONSTRAINT "mark_moderation_entry_fk" FOREIGN KEY ("trust_id", "school_id", "mark_entry_id") REFERENCES "mark_entries"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "mark_moderation_requester_fk" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "mark_moderation_approver_fk" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "mark_moderation_pending_key" ON "mark_moderation_requests"("trust_id", "school_id", "mark_entry_id") WHERE "status" = 'PENDING';
CREATE INDEX "mark_moderation_queue_idx" ON "mark_moderation_requests"("trust_id", "school_id", "status", "created_at");

CREATE TABLE "gradebook_reopen_requests" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "register_id" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "decided_by" TEXT,
  "reason" TEXT NOT NULL,
  "decision_note" TEXT,
  "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
  "decided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gradebook_reopen_register_fk" FOREIGN KEY ("trust_id", "school_id", "register_id") REFERENCES "gradebook_registers"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "gradebook_reopen_requester_fk" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "gradebook_reopen_approver_fk" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "gradebook_reopen_pending_key" ON "gradebook_reopen_requests"("trust_id", "school_id", "register_id") WHERE "status" = 'PENDING';
CREATE INDEX "gradebook_reopen_queue_idx" ON "gradebook_reopen_requests"("trust_id", "school_id", "status", "created_at");

CREATE TABLE "student_results" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "campus_id" TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "section_id" TEXT NOT NULL,
  "examination_id" TEXT NOT NULL,
  "enrollment_id" TEXT NOT NULL,
  "student_profile_id" TEXT NOT NULL,
  "state" "StudentResultState" NOT NULL DEFAULT 'CALCULATED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "total_maximum_marks" DECIMAL(10,2) NOT NULL,
  "total_obtained_marks" DECIMAL(10,2) NOT NULL,
  "percentage" DECIMAL(7,4) NOT NULL,
  "grade_code" TEXT,
  "passed" BOOLEAN NOT NULL,
  "teacher_remark" TEXT,
  "principal_remark" TEXT,
  "promotion_recommendation" "PromotionRecommendation" NOT NULL DEFAULT 'NOT_APPLICABLE',
  "attendance_summary" JSONB,
  "calculation_snapshot" JSONB NOT NULL,
  "calculated_by" TEXT NOT NULL,
  "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_results_values_check" CHECK ("version" > 0 AND "total_maximum_marks" >= 0 AND "total_obtained_marks" >= 0 AND "percentage" >= 0 AND "percentage" <= 100),
  CONSTRAINT "student_results_examination_fk" FOREIGN KEY ("trust_id", "school_id", "examination_id") REFERENCES "examinations"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "student_results_enrollment_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "enrollment_id") REFERENCES "student_enrollments"("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "student_results_student_fk" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "student_results_calculator_fk" FOREIGN KEY ("calculated_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "student_results_scope_id_key" ON "student_results"("trust_id", "school_id", "id");
CREATE UNIQUE INDEX "student_results_student_key" ON "student_results"("trust_id", "school_id", "examination_id", "student_profile_id");
CREATE INDEX "student_results_exam_state_idx" ON "student_results"("trust_id", "school_id", "academic_year_id", "examination_id", "state");
CREATE INDEX "student_results_student_state_idx" ON "student_results"("trust_id", "school_id", "student_profile_id", "state");

CREATE TABLE "result_publications" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "examination_id" TEXT NOT NULL,
  "student_result_id" TEXT NOT NULL,
  "student_profile_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "snapshot_hash" TEXT NOT NULL,
  "published_by" TEXT NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "result_publications_version_check" CHECK ("version" > 0),
  CONSTRAINT "result_publications_result_fk" FOREIGN KEY ("trust_id", "school_id", "student_result_id") REFERENCES "student_results"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "result_publications_examination_fk" FOREIGN KEY ("trust_id", "school_id", "examination_id") REFERENCES "examinations"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "result_publications_student_fk" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "result_publications_publisher_fk" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "result_publications_scope_id_key" ON "result_publications"("trust_id", "school_id", "id");
CREATE UNIQUE INDEX "result_publications_result_version_key" ON "result_publications"("trust_id", "school_id", "student_result_id", "version");
CREATE INDEX "result_publications_lookup_idx" ON "result_publications"("trust_id", "school_id", "examination_id", "student_profile_id", "published_at");

CREATE TABLE "report_card_templates" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "academic_year_id" TEXT,
  "board_configuration_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "configuration" JSONB NOT NULL,
  "branding" JSONB NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "report_card_templates_version_check" CHECK ("version" > 0),
  CONSTRAINT "report_card_templates_school_fk" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "report_card_templates_year_fk" FOREIGN KEY ("trust_id", "school_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "report_card_templates_board_fk" FOREIGN KEY ("trust_id", "school_id", "board_configuration_id") REFERENCES "board_configurations"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "report_card_templates_creator_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "report_card_templates_scope_id_key" ON "report_card_templates"("trust_id", "school_id", "id");
CREATE UNIQUE INDEX "report_card_templates_code_version_key" ON "report_card_templates"("trust_id", "school_id", "code", "version");
CREATE INDEX "report_card_templates_active_idx" ON "report_card_templates"("trust_id", "school_id", "status", "academic_year_id");

CREATE TABLE "report_card_generations" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "examination_id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "student_profile_id" TEXT,
  "kind" "ReportGenerationKind" NOT NULL,
  "state" "ReportGenerationState" NOT NULL DEFAULT 'QUEUED',
  "snapshot" JSONB NOT NULL,
  "verification_code" TEXT NOT NULL,
  "storage_key" TEXT,
  "failure_code" TEXT,
  "requested_by" TEXT NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generated_at" TIMESTAMP(3),
  CONSTRAINT "report_card_generations_examination_fk" FOREIGN KEY ("trust_id", "school_id", "examination_id") REFERENCES "examinations"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "report_card_generations_template_fk" FOREIGN KEY ("trust_id", "school_id", "template_id") REFERENCES "report_card_templates"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "report_card_generations_student_fk" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "report_card_generations_requester_fk" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "report_card_generations_verification_key" ON "report_card_generations"("verification_code");
CREATE INDEX "report_card_generations_queue_idx" ON "report_card_generations"("trust_id", "school_id", "examination_id", "state", "requested_at");
CREATE INDEX "report_card_generations_student_idx" ON "report_card_generations"("trust_id", "school_id", "student_profile_id", "requested_at");

CREATE FUNCTION reject_examination_history_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'examination history is append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "mark_entry_changes_append_only" BEFORE UPDATE OR DELETE ON "mark_entry_changes" FOR EACH ROW EXECUTE FUNCTION reject_examination_history_mutation();
CREATE TRIGGER "result_publications_append_only" BEFORE UPDATE OR DELETE ON "result_publications" FOR EACH ROW EXECUTE FUNCTION reject_examination_history_mutation();

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'examination_rule_sets', 'examinations', 'examination_subjects', 'assessment_components',
    'gradebook_registers', 'mark_entries', 'mark_entry_changes', 'mark_moderation_requests',
    'gradebook_reopen_requests', 'student_results', 'result_publications', 'report_card_templates',
    'report_card_generations'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (trust_id = NULLIF(current_setting(''app.current_trust_id'', true), '''')) WITH CHECK (trust_id = NULLIF(current_setting(''app.current_trust_id'', true), ''''))',
      table_name || '_tenant_isolation', table_name
    );
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO nasaq_app;
GRANT SELECT, INSERT, UPDATE ON "examination_rule_sets", "examinations", "examination_subjects", "assessment_components", "gradebook_registers", "mark_entries", "mark_moderation_requests", "gradebook_reopen_requests", "student_results", "report_card_templates", "report_card_generations" TO nasaq_app;
GRANT SELECT, INSERT ON "mark_entry_changes", "result_publications" TO nasaq_app;
