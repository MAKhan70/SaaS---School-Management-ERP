-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "AcademicYearStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BoardType" AS ENUM ('CBSE', 'CISCE', 'MAHARASHTRA_STATE', 'OTHER_STATE');

-- CreateEnum
CREATE TYPE "BoardConfigurationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "RoleOrigin" AS ENUM ('SYSTEM', 'TENANT');

-- CreateEnum
CREATE TYPE "AssignmentScope" AS ENUM ('TRUST', 'SCHOOL', 'CAMPUS', 'SELF', 'LINKED_CHILDREN');

-- CreateEnum
CREATE TYPE "GuardianRelationshipType" AS ENUM ('FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'GRANDPARENT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCEEDED', 'DENIED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditSensitivity" AS ENUM ('STANDARD', 'SENSITIVE', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "SensitiveIdentifierType" AS ENUM ('GOVERNMENT_ID', 'TAX_IDENTIFIER', 'OTHER');

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusts" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_locale" TEXT NOT NULL DEFAULT 'en-IN',
    "default_timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "default_currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "trusts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campuses" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "status" "AcademicYearStatus" NOT NULL DEFAULT 'PLANNED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_configurations" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "board_type" "BoardType" NOT NULL,
    "state_code" TEXT,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "BoardConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "board_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_classes" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "board_configuration_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "grade_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streams" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "streams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "department_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "grade_class_id" TEXT NOT NULL,
    "stream_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "preferred_locale" TEXT NOT NULL DEFAULT 'en-IN',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "user_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "preferred_name" TEXT,
    "date_of_birth" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_identifiers" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "type" "SensitiveIdentifierType" NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "last_four" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "sensitive_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_memberships" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "trust_id" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "origin" "RoleOrigin" NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "school_membership_id" TEXT,
    "school_id" TEXT,
    "campus_id" TEXT,
    "scope" "AssignmentScope" NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "student_number" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_relationships" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "guardian_person_id" TEXT NOT NULL,
    "relationship_type" "GuardianRelationshipType" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "can_pick_up" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardian_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_enrollments" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "roll_number" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_assignments" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "staff_profile_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT,
    "department_id" TEXT,
    "title" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "active_trust_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT,
    "campus_id" TEXT,
    "actor_user_id" TEXT,
    "effective_actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "outcome" "AuditOutcome" NOT NULL,
    "sensitivity" "AuditSensitivity" NOT NULL DEFAULT 'STANDARD',
    "correlation_id" TEXT NOT NULL,
    "request_id" TEXT,
    "reason_code" TEXT,
    "changes" JSONB,
    "metadata" JSONB,
    "previous_event_hash" TEXT,
    "event_hash" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retention_until" TIMESTAMP(3),

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platforms_key_key" ON "platforms"("key");

-- CreateIndex
CREATE UNIQUE INDEX "trusts_slug_key" ON "trusts"("slug");

-- CreateIndex
CREATE INDEX "trusts_platform_id_status_idx" ON "trusts"("platform_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "trusts_platform_id_id_key" ON "trusts"("platform_id", "id");

-- CreateIndex
CREATE INDEX "schools_trust_id_status_idx" ON "schools"("trust_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "schools_trust_id_id_key" ON "schools"("trust_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "schools_trust_id_code_key" ON "schools"("trust_id", "code");

-- CreateIndex
CREATE INDEX "campuses_trust_id_school_id_status_idx" ON "campuses"("trust_id", "school_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campuses_trust_id_id_key" ON "campuses"("trust_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "campuses_trust_id_school_id_id_key" ON "campuses"("trust_id", "school_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "campuses_trust_id_school_id_code_key" ON "campuses"("trust_id", "school_id", "code");

-- CreateIndex
CREATE INDEX "academic_years_trust_id_status_starts_on_ends_on_idx" ON "academic_years"("trust_id", "status", "starts_on", "ends_on");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_trust_id_id_key" ON "academic_years"("trust_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_trust_id_code_key" ON "academic_years"("trust_id", "code");

-- CreateIndex
CREATE INDEX "board_configurations_trust_id_school_id_status_effective_fr_idx" ON "board_configurations"("trust_id", "school_id", "status", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "board_configurations_trust_id_school_id_id_key" ON "board_configurations"("trust_id", "school_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "board_configurations_trust_id_school_id_board_type_version_key" ON "board_configurations"("trust_id", "school_id", "board_type", "version");

-- CreateIndex
CREATE INDEX "grade_classes_trust_id_school_id_status_level_idx" ON "grade_classes"("trust_id", "school_id", "status", "level");

-- CreateIndex
CREATE UNIQUE INDEX "grade_classes_trust_id_school_id_id_key" ON "grade_classes"("trust_id", "school_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "grade_classes_trust_id_school_id_board_configuration_id_cod_key" ON "grade_classes"("trust_id", "school_id", "board_configuration_id", "code");

-- CreateIndex
CREATE INDEX "streams_trust_id_school_id_status_idx" ON "streams"("trust_id", "school_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "streams_trust_id_school_id_id_key" ON "streams"("trust_id", "school_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "streams_trust_id_school_id_code_key" ON "streams"("trust_id", "school_id", "code");

-- CreateIndex
CREATE INDEX "departments_trust_id_school_id_status_idx" ON "departments"("trust_id", "school_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "departments_trust_id_school_id_id_key" ON "departments"("trust_id", "school_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_trust_id_school_id_code_key" ON "departments"("trust_id", "school_id", "code");

-- CreateIndex
CREATE INDEX "subjects_trust_id_school_id_department_id_status_idx" ON "subjects"("trust_id", "school_id", "department_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_trust_id_school_id_id_key" ON "subjects"("trust_id", "school_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_trust_id_school_id_code_key" ON "subjects"("trust_id", "school_id", "code");

-- CreateIndex
CREATE INDEX "sections_trust_id_school_id_campus_id_academic_year_id_stat_idx" ON "sections"("trust_id", "school_id", "campus_id", "academic_year_id", "status");

-- CreateIndex
CREATE INDEX "sections_trust_id_academic_year_id_grade_class_id_stream_id_idx" ON "sections"("trust_id", "academic_year_id", "grade_class_id", "stream_id");

-- CreateIndex
CREATE UNIQUE INDEX "sections_trust_id_school_id_campus_id_academic_year_id_id_key" ON "sections"("trust_id", "school_id", "campus_id", "academic_year_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sections_trust_id_campus_id_academic_year_id_grade_class_id_key" ON "sections"("trust_id", "campus_id", "academic_year_id", "grade_class_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "persons_trust_id_status_last_name_first_name_idx" ON "persons"("trust_id", "status", "last_name", "first_name");

-- CreateIndex
CREATE UNIQUE INDEX "persons_trust_id_id_key" ON "persons"("trust_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "persons_trust_id_user_id_key" ON "persons"("trust_id", "user_id");

-- CreateIndex
CREATE INDEX "sensitive_identifiers_trust_id_type_archived_at_idx" ON "sensitive_identifiers"("trust_id", "type", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "sensitive_identifiers_trust_id_person_id_type_key" ON "sensitive_identifiers"("trust_id", "person_id", "type");

-- CreateIndex
CREATE INDEX "school_memberships_trust_id_user_id_status_effective_from_e_idx" ON "school_memberships"("trust_id", "user_id", "status", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "school_memberships_trust_id_school_id_campus_id_status_idx" ON "school_memberships"("trust_id", "school_id", "campus_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "school_memberships_trust_id_id_key" ON "school_memberships"("trust_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_platform_id_status_idx" ON "permissions"("platform_id", "status");

-- CreateIndex
CREATE INDEX "roles_platform_id_origin_status_idx" ON "roles"("platform_id", "origin", "status");

-- CreateIndex
CREATE INDEX "roles_trust_id_status_idx" ON "roles"("trust_id", "status");

-- CreateIndex
CREATE INDEX "role_permissions_trust_id_role_id_idx" ON "role_permissions"("trust_id", "role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_trust_id_user_id_status_effective_fro_idx" ON "user_role_assignments"("trust_id", "user_id", "status", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "user_role_assignments_trust_id_school_id_campus_id_status_idx" ON "user_role_assignments"("trust_id", "school_id", "campus_id", "status");

-- CreateIndex
CREATE INDEX "user_role_assignments_role_id_status_idx" ON "user_role_assignments"("role_id", "status");

-- CreateIndex
CREATE INDEX "student_profiles_trust_id_status_idx" ON "student_profiles"("trust_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_trust_id_id_key" ON "student_profiles"("trust_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_trust_id_person_id_key" ON "student_profiles"("trust_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_trust_id_student_number_key" ON "student_profiles"("trust_id", "student_number");

-- CreateIndex
CREATE INDEX "guardian_relationships_trust_id_guardian_person_id_effectiv_idx" ON "guardian_relationships"("trust_id", "guardian_person_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_relationships_trust_id_student_profile_id_guardian_key" ON "guardian_relationships"("trust_id", "student_profile_id", "guardian_person_id");

-- CreateIndex
CREATE INDEX "student_enrollments_trust_id_school_id_campus_id_academic_y_idx" ON "student_enrollments"("trust_id", "school_id", "campus_id", "academic_year_id", "status");

-- CreateIndex
CREATE INDEX "student_enrollments_trust_id_section_id_status_idx" ON "student_enrollments"("trust_id", "section_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_enrollments_trust_id_student_profile_id_academic_ye_key" ON "student_enrollments"("trust_id", "student_profile_id", "academic_year_id", "starts_on");

-- CreateIndex
CREATE INDEX "staff_profiles_trust_id_status_idx" ON "staff_profiles"("trust_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_trust_id_id_key" ON "staff_profiles"("trust_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_trust_id_person_id_key" ON "staff_profiles"("trust_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_trust_id_employee_code_key" ON "staff_profiles"("trust_id", "employee_code");

-- CreateIndex
CREATE INDEX "staff_assignments_trust_id_school_id_campus_id_status_effec_idx" ON "staff_assignments"("trust_id", "school_id", "campus_id", "status", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "staff_assignments_trust_id_department_id_status_idx" ON "staff_assignments"("trust_id", "department_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_assignments_trust_id_staff_profile_id_school_id_campu_key" ON "staff_assignments"("trust_id", "staff_profile_id", "school_id", "campus_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_revoked_at_idx" ON "sessions"("user_id", "expires_at", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_sequence_key" ON "audit_events"("sequence");

-- CreateIndex
CREATE INDEX "audit_events_trust_id_occurred_at_idx" ON "audit_events"("trust_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_trust_id_resource_type_resource_id_occurred_at_idx" ON "audit_events"("trust_id", "resource_type", "resource_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_trust_id_actor_user_id_occurred_at_idx" ON "audit_events"("trust_id", "actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_retention_until_idx" ON "audit_events"("retention_until");

-- AddForeignKey
ALTER TABLE "trusts" ADD CONSTRAINT "trusts_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campuses" ADD CONSTRAINT "campuses_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_configurations" ADD CONSTRAINT "board_configurations_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_configurations" ADD CONSTRAINT "board_configurations_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_classes" ADD CONSTRAINT "grade_classes_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_classes" ADD CONSTRAINT "grade_classes_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_classes" ADD CONSTRAINT "grade_classes_trust_id_school_id_board_configuration_id_fkey" FOREIGN KEY ("trust_id", "school_id", "board_configuration_id") REFERENCES "board_configurations"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streams" ADD CONSTRAINT "streams_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streams" ADD CONSTRAINT "streams_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_trust_id_school_id_department_id_fkey" FOREIGN KEY ("trust_id", "school_id", "department_id") REFERENCES "departments"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_trust_id_school_id_grade_class_id_fkey" FOREIGN KEY ("trust_id", "school_id", "grade_class_id") REFERENCES "grade_classes"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_trust_id_school_id_stream_id_fkey" FOREIGN KEY ("trust_id", "school_id", "stream_id") REFERENCES "streams"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_identifiers" ADD CONSTRAINT "sensitive_identifiers_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_identifiers" ADD CONSTRAINT "sensitive_identifiers_trust_id_person_id_fkey" FOREIGN KEY ("trust_id", "person_id") REFERENCES "persons"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_trust_id_school_membership_id_fkey" FOREIGN KEY ("trust_id", "school_membership_id") REFERENCES "school_memberships"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_trust_id_person_id_fkey" FOREIGN KEY ("trust_id", "person_id") REFERENCES "persons"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_trust_id_guardian_person_id_fkey" FOREIGN KEY ("trust_id", "guardian_person_id") REFERENCES "persons"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_trust_id_school_id_campus_id_academic__fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id") REFERENCES "sections"("trust_id", "school_id", "campus_id", "academic_year_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_trust_id_person_id_fkey" FOREIGN KEY ("trust_id", "person_id") REFERENCES "persons"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_trust_id_staff_profile_id_fkey" FOREIGN KEY ("trust_id", "staff_profile_id") REFERENCES "staff_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_trust_id_school_id_department_id_fkey" FOREIGN KEY ("trust_id", "school_id", "department_id") REFERENCES "departments"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_effective_actor_user_id_fkey" FOREIGN KEY ("effective_actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain integrity checks that Prisma cannot express directly.
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_valid_dates" CHECK ("starts_on" < "ends_on");
ALTER TABLE "board_configurations" ADD CONSTRAINT "board_configurations_positive_version" CHECK ("version" > 0);
ALTER TABLE "board_configurations" ADD CONSTRAINT "board_configurations_valid_dates" CHECK ("effective_to" IS NULL OR "effective_from" <= "effective_to");
ALTER TABLE "grade_classes" ADD CONSTRAINT "grade_classes_valid_level" CHECK ("level" BETWEEN 0 AND 12);
ALTER TABLE "sections" ADD CONSTRAINT "sections_positive_capacity" CHECK ("capacity" IS NULL OR "capacity" > 0);
ALTER TABLE "sensitive_identifiers" ADD CONSTRAINT "sensitive_identifiers_mask_length" CHECK (char_length("last_four") = 4);
ALTER TABLE "sensitive_identifiers" ADD CONSTRAINT "sensitive_identifiers_positive_key_version" CHECK ("key_version" > 0);
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_valid_dates" CHECK ("effective_to" IS NULL OR "effective_from" <= "effective_to");
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_stable_key" CHECK ("key" ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$');
ALTER TABLE "roles" ADD CONSTRAINT "roles_origin_matches_tenant" CHECK (("origin" = 'SYSTEM' AND "trust_id" IS NULL) OR ("origin" = 'TENANT' AND "trust_id" IS NOT NULL));
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_valid_dates" CHECK ("effective_to" IS NULL OR "effective_from" <= "effective_to");
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_scope_shape" CHECK (
  ("scope" = 'TRUST' AND "school_id" IS NULL AND "campus_id" IS NULL) OR
  ("scope" = 'SCHOOL' AND "school_id" IS NOT NULL AND "campus_id" IS NULL) OR
  ("scope" = 'CAMPUS' AND "school_id" IS NOT NULL AND "campus_id" IS NOT NULL) OR
  "scope" IN ('SELF', 'LINKED_CHILDREN')
);
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_valid_dates" CHECK ("effective_to" IS NULL OR "effective_from" <= "effective_to");
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_valid_dates" CHECK ("ends_on" IS NULL OR "starts_on" <= "ends_on");
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_valid_dates" CHECK ("effective_to" IS NULL OR "effective_from" <= "effective_to");

-- Partial uniqueness captures nullable scope and active-history rules.
CREATE UNIQUE INDEX "roles_system_key_unique" ON "roles" ("platform_id", "key") WHERE "trust_id" IS NULL;
CREATE UNIQUE INDEX "roles_tenant_key_unique" ON "roles" ("trust_id", "key") WHERE "trust_id" IS NOT NULL;
CREATE UNIQUE INDEX "school_memberships_school_scope_unique" ON "school_memberships" ("trust_id", "user_id", "school_id") WHERE "campus_id" IS NULL AND "status" = 'ACTIVE';
CREATE UNIQUE INDEX "school_memberships_campus_scope_unique" ON "school_memberships" ("trust_id", "user_id", "school_id", "campus_id") WHERE "campus_id" IS NOT NULL AND "status" = 'ACTIVE';
CREATE UNIQUE INDEX "academic_years_one_active_per_trust" ON "academic_years" ("trust_id") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "student_enrollments_one_active_per_year" ON "student_enrollments" ("trust_id", "student_profile_id", "academic_year_id") WHERE "status" = 'ACTIVE';

-- Cross-table permission integrity for system and tenant-defined roles.
CREATE FUNCTION enforce_role_permission_tenant() RETURNS trigger AS $$
DECLARE
  role_trust_id TEXT;
BEGIN
  SELECT "trust_id" INTO role_trust_id FROM "roles" WHERE "id" = NEW."role_id";
  IF role_trust_id IS DISTINCT FROM NEW."trust_id" THEN
    RAISE EXCEPTION 'Role permission tenant must match role tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "role_permissions_tenant_guard"
BEFORE INSERT OR UPDATE ON "role_permissions"
FOR EACH ROW EXECUTE FUNCTION enforce_role_permission_tenant();

CREATE FUNCTION enforce_user_role_assignment_scope() RETURNS trigger AS $$
DECLARE
  role_trust_id TEXT;
  member_user_id TEXT;
  member_school_id TEXT;
  member_campus_id TEXT;
BEGIN
  SELECT "trust_id" INTO role_trust_id FROM "roles" WHERE "id" = NEW."role_id";
  IF role_trust_id IS NOT NULL AND role_trust_id <> NEW."trust_id" THEN
    RAISE EXCEPTION 'Tenant-defined role must belong to the assignment trust';
  END IF;

  IF NEW."school_membership_id" IS NOT NULL THEN
    SELECT "user_id", "school_id", "campus_id"
      INTO member_user_id, member_school_id, member_campus_id
      FROM "school_memberships"
      WHERE "trust_id" = NEW."trust_id" AND "id" = NEW."school_membership_id";
    IF member_user_id IS DISTINCT FROM NEW."user_id"
       OR member_school_id IS DISTINCT FROM NEW."school_id"
       OR (NEW."campus_id" IS NOT NULL AND member_campus_id IS DISTINCT FROM NEW."campus_id") THEN
      RAISE EXCEPTION 'Role assignment must match the selected school membership';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_role_assignments_scope_guard"
BEFORE INSERT OR UPDATE ON "user_role_assignments"
FOR EACH ROW EXECUTE FUNCTION enforce_user_role_assignment_scope();

-- Audit rows are append-only. Corrections are represented by later events.
CREATE FUNCTION reject_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_events_immutable"
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();

-- The runtime role owns no schema and is subject to RLS even when migrations run as an owner.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nasaq_app') THEN
    CREATE ROLE nasaq_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO nasaq_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nasaq_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nasaq_app;

-- Tenant-owned tables use deny-by-default row-level security keyed by transaction-local context.
DO $$
DECLARE
  table_name TEXT;
  tenant_tables TEXT[] := ARRAY[
    'schools', 'campuses', 'academic_years', 'board_configurations',
    'grade_classes', 'streams', 'departments', 'subjects', 'sections', 'persons',
    'sensitive_identifiers', 'school_memberships', 'user_role_assignments',
    'student_profiles', 'guardian_relationships', 'student_enrollments',
    'staff_profiles', 'staff_assignments', 'audit_events'
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

ALTER TABLE "trusts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trusts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "trusts" USING (
  "id" = current_setting('app.current_trust_id', true)
) WITH CHECK (
  "id" = current_setting('app.current_trust_id', true)
);

-- System roles are readable in every tenant, while tenant roles remain isolated.
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "roles_select" ON "roles" FOR SELECT USING (
  "trust_id" IS NULL OR "trust_id" = current_setting('app.current_trust_id', true)
);
CREATE POLICY "roles_insert" ON "roles" FOR INSERT WITH CHECK (
  "trust_id" = current_setting('app.current_trust_id', true)
  OR ("trust_id" IS NULL AND current_setting('app.platform_admin', true) = 'true')
);
CREATE POLICY "roles_update" ON "roles" FOR UPDATE USING (
  "trust_id" = current_setting('app.current_trust_id', true)
) WITH CHECK (
  "trust_id" = current_setting('app.current_trust_id', true)
);
CREATE POLICY "roles_delete" ON "roles" FOR DELETE USING (
  "trust_id" = current_setting('app.current_trust_id', true)
);

ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_select" ON "role_permissions" FOR SELECT USING (
  "trust_id" IS NULL OR "trust_id" = current_setting('app.current_trust_id', true)
);
CREATE POLICY "role_permissions_insert" ON "role_permissions" FOR INSERT WITH CHECK (
  "trust_id" = current_setting('app.current_trust_id', true)
  OR ("trust_id" IS NULL AND current_setting('app.platform_admin', true) = 'true')
);
CREATE POLICY "role_permissions_update" ON "role_permissions" FOR UPDATE USING (
  "trust_id" = current_setting('app.current_trust_id', true)
) WITH CHECK (
  "trust_id" = current_setting('app.current_trust_id', true)
);
CREATE POLICY "role_permissions_delete" ON "role_permissions" FOR DELETE USING (
  "trust_id" = current_setting('app.current_trust_id', true)
);
