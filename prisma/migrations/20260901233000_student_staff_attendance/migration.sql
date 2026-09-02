-- CreateEnum
CREATE TYPE "AttendanceStatusCategory" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'HALF_DAY', 'MEDICAL_LEAVE', 'SCHOOL_ACTIVITY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AttendanceSessionType" AS ENUM ('DAILY', 'PERIOD');

-- CreateEnum
CREATE TYPE "AttendanceSessionState" AS ENUM ('OPEN', 'LOCKED');

-- CreateEnum
CREATE TYPE "AttendanceRecordSource" AS ENUM ('MANUAL', 'BULK', 'RFID', 'BARCODE', 'QR_CODE', 'BIOMETRIC', 'EXTERNAL_DEVICE');

-- CreateEnum
CREATE TYPE "AttendanceApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "AttendanceDeviceType" AS ENUM ('RFID', 'BARCODE', 'QR_CODE', 'BIOMETRIC', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceDeviceEventState" AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "AttendanceNotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP');

-- CreateTable
CREATE TABLE "attendance_status_definitions" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AttendanceStatusCategory" NOT NULL,
    "counts_as_present" BOOLEAN NOT NULL DEFAULT false,
    "present_fraction" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "attendance_status_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_teaching_assignments" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "subject_id" TEXT,
    "teacher_user_id" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_teaching_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_attendance_sessions" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "period_id" TEXT,
    "attendance_date" DATE NOT NULL,
    "type" "AttendanceSessionType" NOT NULL,
    "state" "AttendanceSessionState" NOT NULL DEFAULT 'OPEN',
    "client_submission_id" TEXT,
    "marked_by" TEXT NOT NULL,
    "locked_by" TEXT,
    "locked_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_attendance_records" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "status_definition_id" TEXT NOT NULL,
    "attendance_date" DATE NOT NULL,
    "source" "AttendanceRecordSource" NOT NULL DEFAULT 'BULK',
    "minutes_late" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_attendance_changes" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "from_status_id" TEXT,
    "to_status_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" "AttendanceRecordSource" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_attendance_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_reopen_requests" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "decided_by" TEXT,
    "reason" TEXT NOT NULL,
    "decision_note" TEXT,
    "status" "AttendanceApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_reopen_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_leave_requests" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "decided_by" TEXT,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AttendanceLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "decision_note" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_shifts" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "starts_minute" INTEGER NOT NULL,
    "ends_minute" INTEGER NOT NULL,
    "grace_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_departure_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_shift_assignments" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "staff_profile_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "assigned_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_attendance_records" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "staff_profile_id" TEXT NOT NULL,
    "shift_id" TEXT,
    "shift_assignment_id" TEXT,
    "attendance_date" DATE NOT NULL,
    "check_in_at" TIMESTAMP(3),
    "check_out_at" TIMESTAMP(3),
    "status" "StaffAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_minutes" INTEGER NOT NULL DEFAULT 0,
    "source" "AttendanceRecordSource" NOT NULL DEFAULT 'MANUAL',
    "actor_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_attendance_corrections" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "staff_profile_id" TEXT NOT NULL,
    "attendance_record_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "decided_by" TEXT,
    "proposed_check_in_at" TIMESTAMP(3),
    "proposed_check_out_at" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "decision_note" TEXT,
    "status" "AttendanceApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_leave_requests" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "staff_profile_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "decided_by" TEXT,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "leave_type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AttendanceLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "decision_note" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_devices" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AttendanceDeviceType" NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "secret_hash" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_device_events" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "identifier_hash" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "event_kind" TEXT NOT NULL,
    "payload" JSONB,
    "state" "AttendanceDeviceEventState" NOT NULL DEFAULT 'RECEIVED',
    "rejection_code" TEXT,
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_device_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_notification_previews" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "attendance_record_id" TEXT,
    "channel" "AttendanceNotificationChannel" NOT NULL,
    "template_key" TEXT NOT NULL,
    "recipient_masked" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_notification_previews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_status_definitions_trust_id_school_id_academic_y_idx" ON "attendance_status_definitions"("trust_id", "school_id", "academic_year_id", "status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_status_scope_id_key" ON "attendance_status_definitions"("trust_id", "school_id", "academic_year_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_status_scope_code_key" ON "attendance_status_definitions"("trust_id", "school_id", "academic_year_id", "code");

-- CreateIndex
CREATE INDEX "attendance_teaching_assignments_trust_id_school_id_campus_i_idx" ON "attendance_teaching_assignments"("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "status");

-- CreateIndex
CREATE INDEX "attendance_teaching_assignments_trust_id_teacher_user_id_st_idx" ON "attendance_teaching_assignments"("trust_id", "teacher_user_id", "status", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "student_attendance_sessions_trust_id_school_id_campus_id_ac_idx" ON "student_attendance_sessions"("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "attendance_date");

-- CreateIndex
CREATE INDEX "student_attendance_sessions_trust_id_school_id_state_attend_idx" ON "student_attendance_sessions"("trust_id", "school_id", "state", "attendance_date");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_sessions_trust_id_school_id_id_key" ON "student_attendance_sessions"("trust_id", "school_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_sessions_trust_id_school_id_campus_id_ac_key" ON "student_attendance_sessions"("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_sessions_trust_id_school_id_client_submi_key" ON "student_attendance_sessions"("trust_id", "school_id", "client_submission_id");

-- CreateIndex
CREATE INDEX "student_attendance_records_trust_id_school_id_academic_year_idx" ON "student_attendance_records"("trust_id", "school_id", "academic_year_id", "student_profile_id", "attendance_date");

-- CreateIndex
CREATE INDEX "student_attendance_records_trust_id_school_id_section_id_at_idx" ON "student_attendance_records"("trust_id", "school_id", "section_id", "attendance_date", "status_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_records_trust_id_school_id_id_key" ON "student_attendance_records"("trust_id", "school_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_records_trust_id_school_id_session_id_st_key" ON "student_attendance_records"("trust_id", "school_id", "session_id", "student_profile_id");

-- CreateIndex
CREATE INDEX "student_attendance_changes_trust_id_school_id_record_id_occ_idx" ON "student_attendance_changes"("trust_id", "school_id", "record_id", "occurred_at");

-- CreateIndex
CREATE INDEX "student_attendance_changes_trust_id_school_id_actor_user_id_idx" ON "student_attendance_changes"("trust_id", "school_id", "actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "attendance_reopen_requests_trust_id_school_id_status_create_idx" ON "attendance_reopen_requests"("trust_id", "school_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "attendance_reopen_requests_trust_id_school_id_session_id_st_idx" ON "attendance_reopen_requests"("trust_id", "school_id", "session_id", "status");

-- CreateIndex
CREATE INDEX "student_leave_requests_trust_id_school_id_academic_year_id__idx" ON "student_leave_requests"("trust_id", "school_id", "academic_year_id", "student_profile_id", "starts_on", "ends_on");

-- CreateIndex
CREATE INDEX "student_leave_requests_trust_id_school_id_status_starts_on_idx" ON "student_leave_requests"("trust_id", "school_id", "status", "starts_on");

-- CreateIndex
CREATE INDEX "staff_shifts_trust_id_school_id_campus_id_status_idx" ON "staff_shifts"("trust_id", "school_id", "campus_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_shifts_trust_id_school_id_campus_id_id_key" ON "staff_shifts"("trust_id", "school_id", "campus_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_shifts_trust_id_school_id_campus_id_code_key" ON "staff_shifts"("trust_id", "school_id", "campus_id", "code");

-- CreateIndex
CREATE INDEX "staff_shift_assignments_trust_id_school_id_campus_id_academ_idx" ON "staff_shift_assignments"("trust_id", "school_id", "campus_id", "academic_year_id", "status", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "staff_shift_assignments_trust_id_school_id_campus_id_academ_key" ON "staff_shift_assignments"("trust_id", "school_id", "campus_id", "academic_year_id", "staff_profile_id", "effective_from");

-- CreateIndex
CREATE INDEX "staff_attendance_records_trust_id_school_id_campus_id_acade_idx" ON "staff_attendance_records"("trust_id", "school_id", "campus_id", "academic_year_id", "attendance_date", "status");

-- CreateIndex
CREATE INDEX "staff_attendance_records_trust_id_school_id_staff_profile_i_idx" ON "staff_attendance_records"("trust_id", "school_id", "staff_profile_id", "attendance_date");

-- CreateIndex
CREATE UNIQUE INDEX "staff_attendance_records_trust_id_school_id_id_key" ON "staff_attendance_records"("trust_id", "school_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_attendance_records_trust_id_school_id_campus_id_acade_key" ON "staff_attendance_records"("trust_id", "school_id", "campus_id", "academic_year_id", "staff_profile_id", "attendance_date");

-- CreateIndex
CREATE INDEX "staff_attendance_corrections_trust_id_school_id_status_crea_idx" ON "staff_attendance_corrections"("trust_id", "school_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "staff_attendance_corrections_trust_id_school_id_staff_profi_idx" ON "staff_attendance_corrections"("trust_id", "school_id", "staff_profile_id", "created_at");

-- CreateIndex
CREATE INDEX "staff_leave_requests_trust_id_school_id_academic_year_id_st_idx" ON "staff_leave_requests"("trust_id", "school_id", "academic_year_id", "staff_profile_id", "starts_on", "ends_on");

-- CreateIndex
CREATE INDEX "staff_leave_requests_trust_id_school_id_status_starts_on_idx" ON "staff_leave_requests"("trust_id", "school_id", "status", "starts_on");

-- CreateIndex
CREATE INDEX "attendance_devices_trust_id_school_id_campus_id_status_type_idx" ON "attendance_devices"("trust_id", "school_id", "campus_id", "status", "type");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_devices_trust_id_school_id_campus_id_id_key" ON "attendance_devices"("trust_id", "school_id", "campus_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_devices_trust_id_school_id_campus_id_code_key" ON "attendance_devices"("trust_id", "school_id", "campus_id", "code");

-- CreateIndex
CREATE INDEX "attendance_device_events_trust_id_school_id_campus_id_state_idx" ON "attendance_device_events"("trust_id", "school_id", "campus_id", "state", "occurred_at");

-- CreateIndex
CREATE INDEX "attendance_device_events_trust_id_school_id_identifier_hash_idx" ON "attendance_device_events"("trust_id", "school_id", "identifier_hash", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_device_events_trust_id_school_id_campus_id_devic_key" ON "attendance_device_events"("trust_id", "school_id", "campus_id", "device_id", "external_event_id");

-- CreateIndex
CREATE INDEX "attendance_notification_previews_trust_id_school_id_student_idx" ON "attendance_notification_previews"("trust_id", "school_id", "student_profile_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "periods_trust_id_id_key" ON "periods"("trust_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "student_enrollments_trust_id_school_id_campus_id_academic_y_key" ON "student_enrollments"("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "id");

-- AddForeignKey
ALTER TABLE "attendance_status_definitions" ADD CONSTRAINT "attendance_status_definitions_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_status_definitions" ADD CONSTRAINT "attendance_status_definitions_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_status_definitions" ADD CONSTRAINT "attendance_status_definitions_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_teaching_assignments" ADD CONSTRAINT "attendance_teaching_assignments_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_teaching_assignments" ADD CONSTRAINT "attendance_teaching_assignments_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_teaching_assignments" ADD CONSTRAINT "attendance_teaching_assignment_campus_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_teaching_assignments" ADD CONSTRAINT "attendance_teaching_assignments_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_teaching_assignments" ADD CONSTRAINT "attendance_teaching_assignment_section_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id") REFERENCES "sections"("trust_id", "school_id", "campus_id", "academic_year_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_teaching_assignments" ADD CONSTRAINT "attendance_teaching_assignments_trust_id_school_id_subject_fkey" FOREIGN KEY ("trust_id", "school_id", "subject_id") REFERENCES "subjects"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_teaching_assignments" ADD CONSTRAINT "attendance_teaching_assignments_teacher_user_id_fkey" FOREIGN KEY ("teacher_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_trust_id_school_id_campus_id_a_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id") REFERENCES "sections"("trust_id", "school_id", "campus_id", "academic_year_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_trust_id_period_id_fkey" FOREIGN KEY ("trust_id", "period_id") REFERENCES "periods"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "student_attendance_sessions_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_records" ADD CONSTRAINT "student_attendance_records_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_records" ADD CONSTRAINT "student_attendance_records_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_records" ADD CONSTRAINT "student_attendance_records_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_records" ADD CONSTRAINT "student_attendance_records_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_records" ADD CONSTRAINT "student_attendance_record_section_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id") REFERENCES "sections"("trust_id", "school_id", "campus_id", "academic_year_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_records" ADD CONSTRAINT "student_attendance_record_session_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "session_id") REFERENCES "student_attendance_sessions"("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_records" ADD CONSTRAINT "student_attendance_record_enrollment_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "enrollment_id") REFERENCES "student_enrollments"("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_records" ADD CONSTRAINT "student_attendance_records_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_records" ADD CONSTRAINT "student_attendance_records_trust_id_school_id_academic_yea_fkey" FOREIGN KEY ("trust_id", "school_id", "academic_year_id", "status_definition_id") REFERENCES "attendance_status_definitions"("trust_id", "school_id", "academic_year_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_changes" ADD CONSTRAINT "student_attendance_changes_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_changes" ADD CONSTRAINT "student_attendance_changes_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_changes" ADD CONSTRAINT "student_attendance_changes_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_changes" ADD CONSTRAINT "student_attendance_changes_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_changes" ADD CONSTRAINT "student_attendance_changes_trust_id_school_id_campus_id_ac_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id") REFERENCES "sections"("trust_id", "school_id", "campus_id", "academic_year_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_changes" ADD CONSTRAINT "student_attendance_changes_trust_id_school_id_record_id_fkey" FOREIGN KEY ("trust_id", "school_id", "record_id") REFERENCES "student_attendance_records"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_changes" ADD CONSTRAINT "student_attendance_changes_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_reopen_requests" ADD CONSTRAINT "attendance_reopen_requests_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_reopen_requests" ADD CONSTRAINT "attendance_reopen_requests_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_reopen_requests" ADD CONSTRAINT "attendance_reopen_requests_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_reopen_requests" ADD CONSTRAINT "attendance_reopen_requests_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_reopen_requests" ADD CONSTRAINT "attendance_reopen_section_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id") REFERENCES "sections"("trust_id", "school_id", "campus_id", "academic_year_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_reopen_requests" ADD CONSTRAINT "attendance_reopen_session_fk" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "session_id") REFERENCES "student_attendance_sessions"("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_reopen_requests" ADD CONSTRAINT "attendance_reopen_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_reopen_requests" ADD CONSTRAINT "attendance_reopen_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_trust_id_school_id_campus_id_academ_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id", "academic_year_id", "section_id") REFERENCES "sections"("trust_id", "school_id", "campus_id", "academic_year_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shifts_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shift_assignments" ADD CONSTRAINT "staff_shift_assignments_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shift_assignments" ADD CONSTRAINT "staff_shift_assignments_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shift_assignments" ADD CONSTRAINT "staff_shift_assignments_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shift_assignments" ADD CONSTRAINT "staff_shift_assignments_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shift_assignments" ADD CONSTRAINT "staff_shift_assignments_trust_id_staff_profile_id_fkey" FOREIGN KEY ("trust_id", "staff_profile_id") REFERENCES "staff_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shift_assignments" ADD CONSTRAINT "staff_shift_assignments_trust_id_school_id_campus_id_shift_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id", "shift_id") REFERENCES "staff_shifts"("trust_id", "school_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_shift_assignments" ADD CONSTRAINT "staff_shift_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_trust_id_staff_profile_id_fkey" FOREIGN KEY ("trust_id", "staff_profile_id") REFERENCES "staff_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_trust_id_school_id_campus_id_shif_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id", "shift_id") REFERENCES "staff_shifts"("trust_id", "school_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_shift_assignment_id_fkey" FOREIGN KEY ("shift_assignment_id") REFERENCES "staff_shift_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_trust_id_staff_profile_id_fkey" FOREIGN KEY ("trust_id", "staff_profile_id") REFERENCES "staff_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_trust_id_school_id_attendance_fkey" FOREIGN KEY ("trust_id", "school_id", "attendance_record_id") REFERENCES "staff_attendance_records"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_trust_id_staff_profile_id_fkey" FOREIGN KEY ("trust_id", "staff_profile_id") REFERENCES "staff_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_events" ADD CONSTRAINT "attendance_device_events_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_events" ADD CONSTRAINT "attendance_device_events_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_events" ADD CONSTRAINT "attendance_device_events_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_events" ADD CONSTRAINT "attendance_device_events_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_events" ADD CONSTRAINT "attendance_device_events_trust_id_school_id_campus_id_devi_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id", "device_id") REFERENCES "attendance_devices"("trust_id", "school_id", "campus_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_device_events" ADD CONSTRAINT "attendance_device_events_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_notification_previews" ADD CONSTRAINT "attendance_notification_previews_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_notification_previews" ADD CONSTRAINT "attendance_notification_previews_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_notification_previews" ADD CONSTRAINT "attendance_notification_previews_trust_id_student_profile__fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_notification_previews" ADD CONSTRAINT "attendance_notification_previews_trust_id_school_id_attend_fkey" FOREIGN KEY ("trust_id", "school_id", "attendance_record_id") REFERENCES "student_attendance_records"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Attendance-specific invariants not expressible in Prisma.
ALTER TABLE "attendance_status_definitions" ADD CONSTRAINT "attendance_status_fraction_check" CHECK ("present_fraction" BETWEEN 0 AND 100);
ALTER TABLE "attendance_teaching_assignments" ADD CONSTRAINT "attendance_teaching_dates_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");
ALTER TABLE "student_attendance_sessions" ADD CONSTRAINT "attendance_session_type_period_check" CHECK (("type" = 'DAILY' AND "period_id" IS NULL) OR ("type" = 'PERIOD' AND "period_id" IS NOT NULL));
ALTER TABLE "student_attendance_records" ADD CONSTRAINT "attendance_minutes_late_check" CHECK ("minutes_late" IS NULL OR "minutes_late" BETWEEN 0 AND 600);
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_dates_check" CHECK ("ends_on" >= "starts_on");
ALTER TABLE "staff_shifts" ADD CONSTRAINT "staff_shift_minutes_check" CHECK ("starts_minute" BETWEEN 0 AND 1439 AND "ends_minute" BETWEEN 1 AND 1440 AND "ends_minute" > "starts_minute" AND "grace_minutes" >= 0 AND "early_departure_minutes" >= 0);
ALTER TABLE "staff_shift_assignments" ADD CONSTRAINT "staff_shift_assignment_dates_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_times_check" CHECK ("check_out_at" IS NULL OR "check_in_at" IS NULL OR "check_out_at" >= "check_in_at");
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_minutes_check" CHECK ("late_minutes" >= 0 AND "early_minutes" >= 0);
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_dates_check" CHECK ("ends_on" >= "starts_on");

CREATE UNIQUE INDEX "student_attendance_daily_session_key"
  ON "student_attendance_sessions"("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "attendance_date")
  WHERE "period_id" IS NULL;
CREATE UNIQUE INDEX "student_attendance_period_session_key"
  ON "student_attendance_sessions"("trust_id", "school_id", "campus_id", "academic_year_id", "section_id", "attendance_date", "period_id")
  WHERE "period_id" IS NOT NULL;
CREATE UNIQUE INDEX "attendance_pending_reopen_key"
  ON "attendance_reopen_requests"("trust_id", "school_id", "session_id")
  WHERE "status" = 'PENDING';

CREATE OR REPLACE FUNCTION prevent_attendance_change_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'attendance changes are append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "student_attendance_changes_no_update"
  BEFORE UPDATE OR DELETE ON "student_attendance_changes"
  FOR EACH ROW EXECUTE FUNCTION prevent_attendance_change_mutation();

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'attendance_status_definitions','attendance_teaching_assignments','student_attendance_sessions',
    'student_attendance_records','student_attendance_changes','attendance_reopen_requests',
    'student_leave_requests','staff_shifts','staff_shift_assignments','staff_attendance_records',
    'staff_attendance_corrections','staff_leave_requests','attendance_devices',
    'attendance_device_events','attendance_notification_previews'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (trust_id = current_setting(''app.current_trust_id'', true)) WITH CHECK (trust_id = current_setting(''app.current_trust_id'', true))', table_name);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON
  "attendance_status_definitions","attendance_teaching_assignments","student_attendance_sessions",
  "student_attendance_records","attendance_reopen_requests","student_leave_requests","staff_shifts",
  "staff_shift_assignments","staff_attendance_records","staff_attendance_corrections",
  "staff_leave_requests","attendance_devices","attendance_device_events" TO nasaq_app;
GRANT SELECT, INSERT ON "student_attendance_changes","attendance_notification_previews" TO nasaq_app;
