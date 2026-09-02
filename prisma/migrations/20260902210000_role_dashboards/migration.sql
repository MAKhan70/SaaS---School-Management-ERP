CREATE TYPE "DashboardAudience" AS ENUM ('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT', 'SHARED');
CREATE TYPE "DashboardItemKind" AS ENUM ('TIMETABLE', 'HOMEWORK', 'LESSON_PLAN', 'LEARNING_RESOURCE', 'ANNOUNCEMENT', 'TEACHER_MEETING', 'TASK', 'OPERATIONAL_ALERT');

CREATE TABLE "dashboard_feed_items" (
  "id" TEXT PRIMARY KEY,
  "trust_id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "campus_id" TEXT,
  "academic_year_id" TEXT NOT NULL,
  "section_id" TEXT,
  "student_profile_id" TEXT,
  "teacher_user_id" TEXT,
  "audience" "DashboardAudience" NOT NULL,
  "kind" "DashboardItemKind" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "due_at" TIMESTAMP(3),
  "link_href" TEXT,
  "metadata" JSONB,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "dashboard_feed_dates_check" CHECK ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" >= "starts_at"),
  CONSTRAINT "dashboard_feed_school_fk" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "dashboard_feed_campus_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "dashboard_feed_year_fk" FOREIGN KEY ("trust_id", "school_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "school_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "dashboard_feed_section_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id") REFERENCES "sections"("trust_id", "school_id", "campus_id", "academic_year_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "dashboard_feed_student_fk" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT,
  CONSTRAINT "dashboard_feed_teacher_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "dashboard_feed_creator_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "dashboard_feed_items_scope_id_key" ON "dashboard_feed_items"("trust_id", "school_id", "id");
CREATE INDEX "dashboard_feed_items_audience_idx" ON "dashboard_feed_items"("trust_id", "school_id", "campus_id", "academic_year_id", "audience", "kind", "starts_at");
CREATE INDEX "dashboard_feed_items_section_idx" ON "dashboard_feed_items"("trust_id", "school_id", "academic_year_id", "section_id", "kind", "due_at");
CREATE INDEX "dashboard_feed_items_student_idx" ON "dashboard_feed_items"("trust_id", "student_profile_id", "audience", "kind", "due_at");
CREATE INDEX "dashboard_feed_items_teacher_idx" ON "dashboard_feed_items"("trust_id", "teacher_user_id", "audience", "kind", "due_at");

ALTER TABLE "dashboard_feed_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dashboard_feed_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "dashboard_feed_items_tenant_isolation" ON "dashboard_feed_items"
  USING ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''))
  WITH CHECK ("trust_id" = NULLIF(current_setting('app.current_trust_id', true), ''));

GRANT SELECT, INSERT, UPDATE ON "dashboard_feed_items" TO nasaq_app;
