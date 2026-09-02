-- CreateEnum
CREATE TYPE "StudentProfileStatus" AS ENUM ('ADMITTED', 'ACTIVE', 'WITHDRAWN', 'TRANSFERRED', 'GRADUATED', 'ALUMNI', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StudentAdmissionStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EnrollmentEventType" AS ENUM ('ENROLLED', 'SECTION_TRANSFERRED', 'PROMOTED', 'DETAINED', 'WITHDRAWN', 'SCHOOL_TRANSFERRED', 'GRADUATED', 'MARKED_ALUMNI', 'RESTORED');

-- CreateEnum
CREATE TYPE "PersonContactType" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('CURRENT', 'PERMANENT', 'CORRESPONDENCE');

-- CreateEnum
CREATE TYPE "StudentSensitiveRecordType" AS ENUM ('MEDICAL_ALERT', 'ALLERGY', 'ACCOMMODATION', 'DEMOGRAPHIC');

-- CreateEnum
CREATE TYPE "StudentDocumentStatus" AS ENUM ('PENDING_SCAN', 'AVAILABLE', 'QUARANTINED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StudentNoteVisibility" AS ENUM ('STANDARD', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "IdentityCardStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "guardian_relationships" ADD COLUMN     "has_custody" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "receives_communication" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "hostel_eligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lifecycle_status" "StudentProfileStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "transport_eligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updated_by" TEXT;

-- CreateTable
CREATE TABLE "person_contacts" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "type" "PersonContactType" NOT NULL,
    "value" TEXT NOT NULL,
    "normalized_hash" TEXT NOT NULL,
    "label" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "person_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_addresses" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "type" "AddressType" NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "locality" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "state_code" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country_code" TEXT NOT NULL DEFAULT 'IN',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "person_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_admissions" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT,
    "academic_year_id" TEXT,
    "admission_number" TEXT NOT NULL,
    "admitted_on" DATE NOT NULL,
    "category" TEXT,
    "source" TEXT,
    "previous_school" TEXT,
    "status" "StudentAdmissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_emergency_contacts" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT,
    "student_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "student_emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_sensitive_records" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "type" "StudentSensitiveRecordType" NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "auth_tag" BYTEA NOT NULL,
    "key_version" INTEGER NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "student_sensitive_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_documents" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT,
    "student_profile_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "status" "StudentDocumentStatus" NOT NULL DEFAULT 'PENDING_SCAN',
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "student_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_notes" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "StudentNoteVisibility" NOT NULL DEFAULT 'STANDARD',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "student_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_tags" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "colour" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "student_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_tag_assignments" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_tag_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_house_assignments" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT,
    "academic_year_id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "house_id" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_house_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_identity_cards" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "campus_id" TEXT,
    "student_profile_id" TEXT NOT NULL,
    "card_number" TEXT NOT NULL,
    "issued_on" DATE,
    "expires_on" DATE,
    "status" "IdentityCardStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_identity_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_enrollment_events" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "type" "EnrollmentEventType" NOT NULL,
    "from_enrollment_id" TEXT,
    "to_enrollment_id" TEXT,
    "occurred_on" DATE NOT NULL,
    "reason" TEXT,
    "details" JSONB,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_enrollment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "person_contacts_trust_id_normalized_hash_status_idx" ON "person_contacts"("trust_id", "normalized_hash", "status");

-- CreateIndex
CREATE UNIQUE INDEX "person_contacts_trust_id_person_id_type_value_key" ON "person_contacts"("trust_id", "person_id", "type", "value");

-- CreateIndex
CREATE INDEX "person_addresses_trust_id_postal_code_status_idx" ON "person_addresses"("trust_id", "postal_code", "status");

-- CreateIndex
CREATE UNIQUE INDEX "person_addresses_trust_id_person_id_type_key" ON "person_addresses"("trust_id", "person_id", "type");

-- CreateIndex
CREATE INDEX "student_admissions_trust_id_school_id_status_admitted_on_idx" ON "student_admissions"("trust_id", "school_id", "status", "admitted_on");

-- CreateIndex
CREATE UNIQUE INDEX "student_admissions_trust_id_school_id_admission_number_key" ON "student_admissions"("trust_id", "school_id", "admission_number");

-- CreateIndex
CREATE UNIQUE INDEX "student_admissions_trust_id_student_profile_id_school_id_ad_key" ON "student_admissions"("trust_id", "student_profile_id", "school_id", "admitted_on");

-- CreateIndex
CREATE INDEX "student_emergency_contacts_trust_id_school_id_campus_id_sta_idx" ON "student_emergency_contacts"("trust_id", "school_id", "campus_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_emergency_contacts_trust_id_student_profile_id_prio_key" ON "student_emergency_contacts"("trust_id", "student_profile_id", "priority");

-- CreateIndex
CREATE INDEX "student_sensitive_records_trust_id_type_status_idx" ON "student_sensitive_records"("trust_id", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_sensitive_records_trust_id_student_profile_id_type_key" ON "student_sensitive_records"("trust_id", "student_profile_id", "type");

-- CreateIndex
CREATE INDEX "student_documents_trust_id_school_id_student_profile_id_sta_idx" ON "student_documents"("trust_id", "school_id", "student_profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_documents_trust_id_storage_key_key" ON "student_documents"("trust_id", "storage_key");

-- CreateIndex
CREATE INDEX "student_notes_trust_id_school_id_student_profile_id_created_idx" ON "student_notes"("trust_id", "school_id", "student_profile_id", "created_at");

-- CreateIndex
CREATE INDEX "student_tags_trust_id_school_id_status_idx" ON "student_tags"("trust_id", "school_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_tags_trust_id_school_id_id_key" ON "student_tags"("trust_id", "school_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "student_tags_trust_id_school_id_key_key" ON "student_tags"("trust_id", "school_id", "key");

-- CreateIndex
CREATE INDEX "student_tag_assignments_trust_id_school_id_tag_id_idx" ON "student_tag_assignments"("trust_id", "school_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_tag_assignments_trust_id_school_id_student_profile__key" ON "student_tag_assignments"("trust_id", "school_id", "student_profile_id", "tag_id");

-- CreateIndex
CREATE INDEX "student_house_assignments_trust_id_school_id_house_id_statu_idx" ON "student_house_assignments"("trust_id", "school_id", "house_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_house_assignments_trust_id_school_id_academic_year__key" ON "student_house_assignments"("trust_id", "school_id", "academic_year_id", "student_profile_id", "starts_on");

-- CreateIndex
CREATE INDEX "student_identity_cards_trust_id_school_id_student_profile_i_idx" ON "student_identity_cards"("trust_id", "school_id", "student_profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_identity_cards_trust_id_school_id_card_number_key" ON "student_identity_cards"("trust_id", "school_id", "card_number");

-- CreateIndex
CREATE INDEX "student_enrollment_events_trust_id_school_id_student_profil_idx" ON "student_enrollment_events"("trust_id", "school_id", "student_profile_id", "occurred_on");

-- CreateIndex
CREATE INDEX "student_enrollment_events_trust_id_type_occurred_on_idx" ON "student_enrollment_events"("trust_id", "type", "occurred_on");

-- CreateIndex
CREATE UNIQUE INDEX "student_enrollments_trust_id_id_key" ON "student_enrollments"("trust_id", "id");

-- AddForeignKey
ALTER TABLE "person_contacts" ADD CONSTRAINT "person_contacts_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_contacts" ADD CONSTRAINT "person_contacts_trust_id_person_id_fkey" FOREIGN KEY ("trust_id", "person_id") REFERENCES "persons"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_addresses" ADD CONSTRAINT "person_addresses_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_addresses" ADD CONSTRAINT "person_addresses_trust_id_person_id_fkey" FOREIGN KEY ("trust_id", "person_id") REFERENCES "persons"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_admissions" ADD CONSTRAINT "student_admissions_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_admissions" ADD CONSTRAINT "student_admissions_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_admissions" ADD CONSTRAINT "student_admissions_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_admissions" ADD CONSTRAINT "student_admissions_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_admissions" ADD CONSTRAINT "student_admissions_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_emergency_contacts" ADD CONSTRAINT "student_emergency_contacts_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_emergency_contacts" ADD CONSTRAINT "student_emergency_contacts_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_emergency_contacts" ADD CONSTRAINT "student_emergency_contacts_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_emergency_contacts" ADD CONSTRAINT "student_emergency_contacts_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_sensitive_records" ADD CONSTRAINT "student_sensitive_records_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_sensitive_records" ADD CONSTRAINT "student_sensitive_records_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_tags" ADD CONSTRAINT "student_tags_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_tags" ADD CONSTRAINT "student_tags_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_tag_assignments" ADD CONSTRAINT "student_tag_assignments_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_tag_assignments" ADD CONSTRAINT "student_tag_assignments_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_tag_assignments" ADD CONSTRAINT "student_tag_assignments_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_tag_assignments" ADD CONSTRAINT "student_tag_assignments_trust_id_school_id_tag_id_fkey" FOREIGN KEY ("trust_id", "school_id", "tag_id") REFERENCES "student_tags"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_house_assignments" ADD CONSTRAINT "student_house_assignments_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_house_assignments" ADD CONSTRAINT "student_house_assignments_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_house_assignments" ADD CONSTRAINT "student_house_assignments_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_house_assignments" ADD CONSTRAINT "student_house_assignments_trust_id_academic_year_id_fkey" FOREIGN KEY ("trust_id", "academic_year_id") REFERENCES "academic_years"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_house_assignments" ADD CONSTRAINT "student_house_assignments_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_house_assignments" ADD CONSTRAINT "student_house_assignments_trust_id_school_id_house_id_fkey" FOREIGN KEY ("trust_id", "school_id", "house_id") REFERENCES "houses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_identity_cards" ADD CONSTRAINT "student_identity_cards_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_identity_cards" ADD CONSTRAINT "student_identity_cards_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_identity_cards" ADD CONSTRAINT "student_identity_cards_trust_id_school_id_campus_id_fkey" FOREIGN KEY ("trust_id", "school_id", "campus_id") REFERENCES "campuses"("trust_id", "school_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_identity_cards" ADD CONSTRAINT "student_identity_cards_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollment_events" ADD CONSTRAINT "student_enrollment_events_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollment_events" ADD CONSTRAINT "student_enrollment_events_trust_id_school_id_fkey" FOREIGN KEY ("trust_id", "school_id") REFERENCES "schools"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollment_events" ADD CONSTRAINT "student_enrollment_events_trust_id_student_profile_id_fkey" FOREIGN KEY ("trust_id", "student_profile_id") REFERENCES "student_profiles"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollment_events" ADD CONSTRAINT "student_enrollment_events_trust_id_from_enrollment_id_fkey" FOREIGN KEY ("trust_id", "from_enrollment_id") REFERENCES "student_enrollments"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollment_events" ADD CONSTRAINT "student_enrollment_events_trust_id_to_enrollment_id_fkey" FOREIGN KEY ("trust_id", "to_enrollment_id") REFERENCES "student_enrollments"("trust_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_enrollment_events" ADD CONSTRAINT "student_enrollment_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain constraints that Prisma cannot express.
ALTER TABLE "guardian_relationships"
  ADD CONSTRAINT "guardian_relationships_priority_check" CHECK ("priority" > 0),
  ADD CONSTRAINT "guardian_relationships_date_range_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

ALTER TABLE "student_emergency_contacts"
  ADD CONSTRAINT "student_emergency_contacts_priority_check" CHECK ("priority" > 0);

ALTER TABLE "student_sensitive_records"
  ADD CONSTRAINT "student_sensitive_records_crypto_check" CHECK (
    "key_version" > 0 AND octet_length("iv") = 12 AND octet_length("auth_tag") = 16 AND octet_length("ciphertext") > 0
  );

ALTER TABLE "student_documents"
  ADD CONSTRAINT "student_documents_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 25000000);

ALTER TABLE "student_house_assignments"
  ADD CONSTRAINT "student_house_assignments_date_range_check" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");

ALTER TABLE "student_identity_cards"
  ADD CONSTRAINT "student_identity_cards_date_range_check" CHECK ("expires_on" IS NULL OR "issued_on" IS NULL OR "expires_on" >= "issued_on");

-- A legacy trust-wide academic year has no school_id; otherwise the school must match.
CREATE OR REPLACE FUNCTION enforce_student_academic_year_school()
RETURNS trigger AS $$
DECLARE year_school_id text;
BEGIN
  IF NEW.academic_year_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT school_id INTO year_school_id
  FROM academic_years
  WHERE trust_id = NEW.trust_id AND id = NEW.academic_year_id;
  IF year_school_id IS NOT NULL AND year_school_id <> NEW.school_id THEN
    RAISE EXCEPTION 'student academic year belongs to another school';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "student_admissions_academic_year_school"
BEFORE INSERT OR UPDATE ON "student_admissions"
FOR EACH ROW EXECUTE FUNCTION enforce_student_academic_year_school();

CREATE TRIGGER "student_house_assignments_academic_year_school"
BEFORE INSERT OR UPDATE ON "student_house_assignments"
FOR EACH ROW EXECUTE FUNCTION enforce_student_academic_year_school();

-- Lifecycle events are historical evidence. Corrections are appended as new events.
CREATE OR REPLACE FUNCTION prevent_student_enrollment_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'student enrollment events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "student_enrollment_events_no_update"
BEFORE UPDATE OR DELETE ON "student_enrollment_events"
FOR EACH ROW EXECUTE FUNCTION prevent_student_enrollment_event_mutation();

-- Tenant-owned SIS tables require a transaction-local app.current_trust_id.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'person_contacts', 'person_addresses', 'student_admissions',
    'student_emergency_contacts', 'student_sensitive_records', 'student_documents',
    'student_notes', 'student_tags', 'student_tag_assignments',
    'student_house_assignments', 'student_identity_cards', 'student_enrollment_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (trust_id = current_setting(''app.current_trust_id'', true)) WITH CHECK (trust_id = current_setting(''app.current_trust_id'', true))',
      table_name
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "person_contacts", "person_addresses", "student_admissions",
  "student_emergency_contacts", "student_sensitive_records", "student_documents",
  "student_notes", "student_tags", "student_tag_assignments",
  "student_house_assignments", "student_identity_cards", "student_enrollment_events"
TO nasaq_app;
