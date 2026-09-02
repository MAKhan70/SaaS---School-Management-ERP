-- CreateEnum
CREATE TYPE "CalendarDayType" AS ENUM ('WORKING_DAY', 'HOLIDAY', 'NON_WORKING_DAY', 'SCHOOL_EVENT');

-- CreateEnum
CREATE TYPE "NumberingEntityType" AS ENUM ('STUDENT', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "NumberingResetPolicy" AS ENUM ('NEVER', 'ACADEMIC_YEAR', 'CALENDAR_YEAR');

-- AlterEnum
ALTER TYPE "BoardType" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "academic_years" ADD COLUMN     "copied_from_id" TEXT,
ADD COLUMN     "school_id" TEXT;

-- CreateTable
CREATE TABLE "academic_terms" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_day_rules" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "is_working" BOOLEAN NOT NULL DEFAULT true,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "working_day_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_calendar_days" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT,
    "academic_year_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "CalendarDayType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "school_calendar_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "room_type" TEXT NOT NULL,
    "capacity" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periods" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT,
    "academic_year_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "starts_minute" INTEGER NOT NULL,
    "ends_minute" INTEGER NOT NULL,
    "is_instruction" BOOLEAN NOT NULL DEFAULT true,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_scales" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "academic_year_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "BoardConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "grading_scales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_bands" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "grading_scale_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minimum_value" DECIMAL(7,2) NOT NULL,
    "maximum_value" DECIMAL(7,2) NOT NULL,
    "grade_point" DECIMAL(5,2),
    "sequence" INTEGER NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "grade_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houses" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colour" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numbering_rules" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "academic_year_id" TEXT,
    "entity_type" "NumberingEntityType" NOT NULL,
    "prefix_template" TEXT NOT NULL,
    "suffix_template" TEXT,
    "padding" INTEGER NOT NULL DEFAULT 4,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "reset_policy" "NumberingResetPolicy" NOT NULL DEFAULT 'NEVER',
    "version" INTEGER NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "numbering_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_terms_trust_id_school_id_academic_year_id_status_idx" ON "academic_terms"("trust_id", "school_id", "academic_year_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "academic_terms_trust_id_school_id_academic_year_id_id_key" ON "academic_terms"("trust_id", "school_id", "academic_year_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_terms_trust_id_school_id_academic_year_id_code_key" ON "academic_terms"("trust_id", "school_id", "academic_year_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "academic_terms_trust_id_school_id_academic_year_id_sequence_key" ON "academic_terms"("trust_id", "school_id", "academic_year_id", "sequence");

-- CreateIndex
CREATE INDEX "working_day_rules_trust_id_school_id_academic_year_id_statu_idx" ON "working_day_rules"("trust_id", "school_id", "academic_year_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "working_day_rules_trust_id_school_id_academic_year_id_weekd_key" ON "working_day_rules"("trust_id", "school_id", "academic_year_id", "weekday");

-- CreateIndex
CREATE INDEX "school_calendar_days_trust_id_school_id_academic_year_id_ty_idx" ON "school_calendar_days"("trust_id", "school_id", "academic_year_id", "type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "school_calendar_days_trust_id_school_id_academic_year_id_ca_key" ON "school_calendar_days"("trust_id", "school_id", "academic_year_id", "campus_id", "date");

-- CreateIndex
CREATE INDEX "rooms_trust_id_school_id_campus_id_status_idx" ON "rooms"("trust_id", "school_id", "campus_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_trust_id_school_id_campus_id_id_key" ON "rooms"("trust_id", "school_id", "campus_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_trust_id_school_id_campus_id_code_key" ON "rooms"("trust_id", "school_id", "campus_id", "code");

-- CreateIndex
CREATE INDEX "periods_trust_id_school_id_academic_year_id_status_idx" ON "periods"("trust_id", "school_id", "academic_year_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "periods_trust_id_school_id_academic_year_id_campus_id_code_key" ON "periods"("trust_id", "school_id", "academic_year_id", "campus_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "periods_trust_id_school_id_academic_year_id_campus_id_seque_key" ON "periods"("trust_id", "school_id", "academic_year_id", "campus_id", "sequence");

-- CreateIndex
CREATE INDEX "grading_scales_trust_id_school_id_status_effective_from_idx" ON "grading_scales"("trust_id", "school_id", "status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "grading_scales_trust_id_school_id_id_key" ON "grading_scales"("trust_id", "school_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "grading_scales_trust_id_school_id_code_version_key" ON "grading_scales"("trust_id", "school_id", "code", "version");

-- CreateIndex
CREATE INDEX "grade_bands_trust_id_school_id_grading_scale_id_sequence_idx" ON "grade_bands"("trust_id", "school_id", "grading_scale_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "grade_bands_trust_id_school_id_grading_scale_id_code_key" ON "grade_bands"("trust_id", "school_id", "grading_scale_id", "code");

-- CreateIndex
CREATE INDEX "houses_trust_id_school_id_status_idx" ON "houses"("trust_id", "school_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "houses_trust_id_school_id_id_key" ON "houses"("trust_id", "school_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "houses_trust_id_school_id_code_key" ON "houses"("trust_id", "school_id", "code");

-- CreateIndex
CREATE INDEX "numbering_rules_trust_id_school_id_entity_type_status_effec_idx" ON "numbering_rules"("trust_id", "school_id", "entity_type", "status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "numbering_rules_trust_id_school_id_entity_type_version_key" ON "numbering_rules"("trust_id", "school_id", "entity_type", "version");

-- CreateIndex
CREATE INDEX "academic_years_trust_id_school_id_status_starts_on_ends_on_idx" ON "academic_years"("trust_id", "school_id", "status", "starts_on", "ends_on");

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_trust_id_copied_from_id_fkey" FOREIGN KEY ("trust_id", "copied_from_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_day_rules" ADD CONSTRAINT "working_day_rules_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_day_rules" ADD CONSTRAINT "working_day_rules_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_day_rules" ADD CONSTRAINT "working_day_rules_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_calendar_days" ADD CONSTRAINT "school_calendar_days_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_calendar_days" ADD CONSTRAINT "school_calendar_days_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_calendar_days" ADD CONSTRAINT "school_calendar_days_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_calendar_days" ADD CONSTRAINT "school_calendar_days_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_scales" ADD CONSTRAINT "grading_scales_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_scales" ADD CONSTRAINT "grading_scales_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_scales" ADD CONSTRAINT "grading_scales_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_trust_id_school_id_grading_scale_id_fkey" FOREIGN KEY ("trust_id", "school_id", "grading_scale_id") REFERENCES "grading_scales"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houses" ADD CONSTRAINT "houses_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houses" ADD CONSTRAINT "houses_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_rules" ADD CONSTRAINT "numbering_rules_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_rules" ADD CONSTRAINT "numbering_rules_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_rules" ADD CONSTRAINT "numbering_rules_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain checks and partial uniqueness not represented by Prisma.
ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_valid_dates" CHECK ("starts_on" < "ends_on");
ALTER TABLE "working_day_rules" ADD CONSTRAINT "working_day_rules_valid_weekday" CHECK ("weekday" BETWEEN 1 AND 7);
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_positive_capacity" CHECK ("capacity" IS NULL OR "capacity" > 0);
ALTER TABLE "periods" ADD CONSTRAINT "periods_valid_minutes" CHECK ("starts_minute" BETWEEN 0 AND 1439 AND "ends_minute" BETWEEN 1 AND 1440 AND "starts_minute" < "ends_minute");
ALTER TABLE "periods" ADD CONSTRAINT "periods_positive_sequence" CHECK ("sequence" > 0);
ALTER TABLE "grading_scales" ADD CONSTRAINT "grading_scales_positive_version" CHECK ("version" > 0);
ALTER TABLE "grading_scales" ADD CONSTRAINT "grading_scales_valid_dates" CHECK ("effective_to" IS NULL OR "effective_from" <= "effective_to");
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_valid_range" CHECK ("minimum_value" <= "maximum_value");
ALTER TABLE "numbering_rules" ADD CONSTRAINT "numbering_rules_valid_counter" CHECK ("version" > 0 AND "padding" BETWEEN 2 AND 12 AND "next_number" > 0);
ALTER TABLE "numbering_rules" ADD CONSTRAINT "numbering_rules_valid_dates" CHECK ("effective_to" IS NULL OR "effective_from" <= "effective_to");

DROP INDEX IF EXISTS "academic_years_one_active_per_trust";
CREATE UNIQUE INDEX "academic_years_one_active_legacy_trust" ON "academic_years" ("trust_id") WHERE "status" = 'ACTIVE' AND "school_id" IS NULL;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_no_active_school_overlap" EXCLUDE USING gist (
  "trust_id" WITH =,
  "school_id" WITH =,
  daterange("starts_on", "ends_on", '[]') WITH &&
) WHERE ("status" = 'ACTIVE' AND "school_id" IS NOT NULL);

CREATE UNIQUE INDEX "periods_school_wide_code_unique" ON "periods" ("trust_id", "school_id", "academic_year_id", "code") WHERE "campus_id" IS NULL;
CREATE UNIQUE INDEX "periods_school_wide_sequence_unique" ON "periods" ("trust_id", "school_id", "academic_year_id", "sequence") WHERE "campus_id" IS NULL;
CREATE UNIQUE INDEX "school_calendar_days_school_wide_date_unique" ON "school_calendar_days" ("trust_id", "school_id", "academic_year_id", "date") WHERE "campus_id" IS NULL;

-- School-specific academic-year references may not cross school boundaries.
CREATE FUNCTION enforce_academic_year_school_scope() RETURNS trigger AS $$
DECLARE
  year_school_id TEXT;
BEGIN
  SELECT "school_id" INTO year_school_id
  FROM "academic_years"
  WHERE "trust_id" = NEW."trust_id" AND "id" = NEW."academic_year_id";
  IF year_school_id IS NOT NULL AND year_school_id IS DISTINCT FROM NEW."school_id" THEN
    RAISE EXCEPTION 'Academic year must belong to the referenced school';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  table_name TEXT;
  scoped_tables TEXT[] := ARRAY[
    'academic_terms', 'working_day_rules', 'school_calendar_days', 'periods',
    'grading_scales', 'numbering_rules', 'sections', 'student_enrollments'
  ];
BEGIN
  FOREACH table_name IN ARRAY scoped_tables LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF trust_id, school_id, academic_year_id ON %I FOR EACH ROW EXECUTE FUNCTION enforce_academic_year_school_scope()',
      table_name || '_academic_year_school_guard', table_name
    );
  END LOOP;
END
$$;

-- New tenant tables inherit the same deny-by-default RLS policy as the core model.
DO $$
DECLARE
  table_name TEXT;
  tenant_tables TEXT[] := ARRAY[
    'academic_terms', 'working_day_rules', 'school_calendar_days', 'rooms',
    'periods', 'grading_scales', 'grade_bands', 'houses', 'numbering_rules'
  ];
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (trust_id = current_setting(''app.current_trust_id'', true)) WITH CHECK (trust_id = current_setting(''app.current_trust_id'', true))',
      table_name
    );
  END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "academic_terms", "working_day_rules", "school_calendar_days", "rooms", "periods", "grading_scales", "grade_bands", "houses", "numbering_rules" TO nasaq_app;
