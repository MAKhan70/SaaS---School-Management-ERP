CREATE TYPE "FeeHeadKind" AS ENUM ('REGULAR','OPTIONAL','TRANSPORT','HOSTEL','LATE_FEE','FINE','OTHER');
CREATE TYPE "FeeAssignmentSource" AS ENUM ('CLASS','STUDENT','OPTIONAL','TRANSPORT','HOSTEL','CARRY_FORWARD');
CREATE TYPE "FeeAdjustmentKind" AS ENUM ('DISCOUNT','CONCESSION','SCHOLARSHIP','WAIVER','LATE_FEE','FINE','CREDIT_NOTE');
CREATE TYPE "FinancialDirection" AS ENUM ('DEBIT','CREDIT');
CREATE TYPE "FinanceApprovalState" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED');
CREATE TYPE "FeePaymentMethod" AS ENUM ('CASH','CHEQUE','BANK_TRANSFER','UPI','CARD','ONLINE_GATEWAY');
CREATE TYPE "FeePaymentState" AS ENUM ('POSTED','REVERSED');
CREATE TYPE "FeeRefundState" AS ENUM ('PENDING','APPROVED','REJECTED','PAID','CANCELLED');
CREATE TYPE "GatewayEventState" AS ENUM ('RECEIVED','RECONCILED','REJECTED','DUPLICATE');

CREATE TABLE "fee_categories" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, "archived_at" TIMESTAMP(3),
  CONSTRAINT "fee_categories_school_fk" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "fee_categories_scope_id_key" ON "fee_categories"("trust_id","school_id","id");
CREATE UNIQUE INDEX "fee_categories_code_key" ON "fee_categories"("trust_id","school_id","code");
CREATE INDEX "fee_categories_status_idx" ON "fee_categories"("trust_id","school_id","status","name");

CREATE TABLE "fee_heads" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "category_id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "kind" "FeeHeadKind" NOT NULL DEFAULT 'REGULAR', "refundable" BOOLEAN NOT NULL DEFAULT false, "tax_inclusive" BOOLEAN NOT NULL DEFAULT true,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, "archived_at" TIMESTAMP(3),
  CONSTRAINT "fee_heads_school_fk" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_heads_category_fk" FOREIGN KEY ("trust_id","school_id","category_id") REFERENCES "fee_categories"("trust_id","school_id","id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "fee_heads_scope_id_key" ON "fee_heads"("trust_id","school_id","id");
CREATE UNIQUE INDEX "fee_heads_code_key" ON "fee_heads"("trust_id","school_id","code");
CREATE INDEX "fee_heads_category_idx" ON "fee_heads"("trust_id","school_id","category_id","kind","status");

CREATE TABLE "fee_structures" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "academic_year_id" TEXT NOT NULL, "grade_class_id" TEXT NOT NULL,
  "code" TEXT NOT NULL, "name" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE', "created_by" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, "archived_at" TIMESTAMP(3),
  CONSTRAINT "fee_structures_amount_check" CHECK ("version" > 0 AND "currency" = 'INR'),
  CONSTRAINT "fee_structures_school_fk" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_structures_year_fk" FOREIGN KEY ("trust_id","school_id","academic_year_id") REFERENCES "academic_years"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_structures_grade_fk" FOREIGN KEY ("trust_id","school_id","grade_class_id") REFERENCES "grade_classes"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_structures_creator_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "fee_structures_scope_id_key" ON "fee_structures"("trust_id","school_id","id");
CREATE UNIQUE INDEX "fee_structures_version_key" ON "fee_structures"("trust_id","school_id","academic_year_id","grade_class_id","code","version");
CREATE INDEX "fee_structures_grade_idx" ON "fee_structures"("trust_id","school_id","academic_year_id","grade_class_id","status");

CREATE TABLE "fee_installments" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "fee_structure_id" TEXT NOT NULL, "code" TEXT NOT NULL,
  "name" TEXT NOT NULL, "sequence" INTEGER NOT NULL, "due_on" DATE NOT NULL, "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_installments_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "fee_installments_structure_fk" FOREIGN KEY ("trust_id","school_id","fee_structure_id") REFERENCES "fee_structures"("trust_id","school_id","id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "fee_installments_scope_id_key" ON "fee_installments"("trust_id","school_id","id");
CREATE UNIQUE INDEX "fee_installments_code_key" ON "fee_installments"("trust_id","school_id","fee_structure_id","code");
CREATE UNIQUE INDEX "fee_installments_sequence_key" ON "fee_installments"("trust_id","school_id","fee_structure_id","sequence");
CREATE INDEX "fee_installments_due_idx" ON "fee_installments"("trust_id","school_id","due_on","status");

CREATE TABLE "fee_structure_lines" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "fee_structure_id" TEXT NOT NULL, "installment_id" TEXT NOT NULL,
  "fee_head_id" TEXT NOT NULL, "amount_minor" INTEGER NOT NULL, "optional" BOOLEAN NOT NULL DEFAULT false, "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_structure_lines_amount_check" CHECK ("amount_minor" >= 0),
  CONSTRAINT "fee_structure_lines_structure_fk" FOREIGN KEY ("trust_id","school_id","fee_structure_id") REFERENCES "fee_structures"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_structure_lines_installment_fk" FOREIGN KEY ("trust_id","school_id","installment_id") REFERENCES "fee_installments"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_structure_lines_head_fk" FOREIGN KEY ("trust_id","school_id","fee_head_id") REFERENCES "fee_heads"("trust_id","school_id","id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "fee_structure_lines_scope_id_key" ON "fee_structure_lines"("trust_id","school_id","id");
CREATE UNIQUE INDEX "fee_structure_lines_unique_key" ON "fee_structure_lines"("trust_id","school_id","fee_structure_id","installment_id","fee_head_id");
CREATE INDEX "fee_structure_lines_head_idx" ON "fee_structure_lines"("trust_id","school_id","fee_head_id","status");

CREATE TABLE "student_fee_assignments" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "campus_id" TEXT NOT NULL, "academic_year_id" TEXT NOT NULL,
  "student_profile_id" TEXT NOT NULL, "enrollment_id" TEXT NOT NULL, "section_id" TEXT NOT NULL, "fee_structure_id" TEXT, "structure_line_id" TEXT,
  "installment_id" TEXT, "fee_head_id" TEXT NOT NULL, "source" "FeeAssignmentSource" NOT NULL, "description" TEXT NOT NULL, "amount_minor" INTEGER NOT NULL,
  "due_on" DATE NOT NULL, "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE', "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, "archived_at" TIMESTAMP(3),
  CONSTRAINT "student_fee_assignments_amount_check" CHECK ("amount_minor" >= 0),
  CONSTRAINT "student_fee_assignments_student_fk" FOREIGN KEY ("trust_id","student_profile_id") REFERENCES "student_profiles"("trust_id","id") ON DELETE RESTRICT,
  CONSTRAINT "student_fee_assignments_enrollment_fk" FOREIGN KEY ("trust_id","school_id","campus_id","academic_year_id","section_id","enrollment_id") REFERENCES "student_enrollments"("trust_id","school_id","campus_id","academic_year_id","section_id","id") ON DELETE RESTRICT,
  CONSTRAINT "student_fee_assignments_structure_fk" FOREIGN KEY ("trust_id","school_id","fee_structure_id") REFERENCES "fee_structures"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "student_fee_assignments_line_fk" FOREIGN KEY ("trust_id","school_id","structure_line_id") REFERENCES "fee_structure_lines"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "student_fee_assignments_installment_fk" FOREIGN KEY ("trust_id","school_id","installment_id") REFERENCES "fee_installments"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "student_fee_assignments_head_fk" FOREIGN KEY ("trust_id","school_id","fee_head_id") REFERENCES "fee_heads"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "student_fee_assignments_creator_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "student_fee_assignments_scope_id_key" ON "student_fee_assignments"("trust_id","school_id","id");
CREATE UNIQUE INDEX "student_fee_assignments_line_key" ON "student_fee_assignments"("trust_id","school_id","academic_year_id","student_profile_id","structure_line_id");
CREATE INDEX "student_fee_assignments_student_idx" ON "student_fee_assignments"("trust_id","school_id","campus_id","academic_year_id","student_profile_id","due_on");
CREATE INDEX "student_fee_assignments_due_idx" ON "student_fee_assignments"("trust_id","school_id","academic_year_id","due_on","status");

CREATE TABLE "fee_adjustments" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "assignment_id" TEXT NOT NULL,
  "kind" "FeeAdjustmentKind" NOT NULL, "direction" "FinancialDirection" NOT NULL, "amount_minor" INTEGER NOT NULL, "reason" TEXT NOT NULL,
  "approval_state" "FinanceApprovalState" NOT NULL DEFAULT 'PENDING', "requested_by" TEXT NOT NULL, "decided_by" TEXT, "decision_note" TEXT,
  "decided_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_adjustments_amount_check" CHECK ("amount_minor" > 0),
  CONSTRAINT "fee_adjustments_assignment_fk" FOREIGN KEY ("trust_id","school_id","assignment_id") REFERENCES "student_fee_assignments"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_adjustments_requester_fk" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "fee_adjustments_approver_fk" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "fee_adjustments_scope_id_key" ON "fee_adjustments"("trust_id","school_id","id");
CREATE INDEX "fee_adjustments_queue_idx" ON "fee_adjustments"("trust_id","school_id","approval_state","kind","created_at");
CREATE INDEX "fee_adjustments_assignment_idx" ON "fee_adjustments"("trust_id","school_id","assignment_id","created_at");

CREATE TABLE "fee_payments" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "campus_id" TEXT NOT NULL, "academic_year_id" TEXT NOT NULL,
  "student_profile_id" TEXT NOT NULL, "idempotency_key" TEXT NOT NULL, "request_fingerprint" TEXT NOT NULL, "method" "FeePaymentMethod" NOT NULL,
  "amount_minor" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'INR', "state" "FeePaymentState" NOT NULL DEFAULT 'POSTED',
  "instrument_reference" TEXT, "provider" TEXT, "provider_payment_id" TEXT, "paid_at" TIMESTAMP(3) NOT NULL, "posted_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_payments_amount_check" CHECK ("amount_minor" > 0 AND "currency" = 'INR'),
  CONSTRAINT "fee_payments_school_fk" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_payments_campus_fk" FOREIGN KEY ("trust_id","school_id","campus_id") REFERENCES "campuses"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_payments_year_fk" FOREIGN KEY ("trust_id","school_id","academic_year_id") REFERENCES "academic_years"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_payments_student_fk" FOREIGN KEY ("trust_id","student_profile_id") REFERENCES "student_profiles"("trust_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_payments_poster_fk" FOREIGN KEY ("posted_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "fee_payments_scope_id_key" ON "fee_payments"("trust_id","school_id","id");
CREATE UNIQUE INDEX "fee_payments_idempotency_key" ON "fee_payments"("trust_id","school_id","idempotency_key");
CREATE UNIQUE INDEX "fee_payments_provider_key" ON "fee_payments"("trust_id","school_id","provider","provider_payment_id");
CREATE INDEX "fee_payments_collection_idx" ON "fee_payments"("trust_id","school_id","campus_id","paid_at","method");
CREATE INDEX "fee_payments_student_idx" ON "fee_payments"("trust_id","school_id","academic_year_id","student_profile_id","paid_at");

CREATE TABLE "fee_payment_allocations" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "payment_id" TEXT NOT NULL, "assignment_id" TEXT NOT NULL,
  "amount_minor" INTEGER NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_payment_allocations_amount_check" CHECK ("amount_minor" > 0),
  CONSTRAINT "fee_payment_allocations_payment_fk" FOREIGN KEY ("trust_id","school_id","payment_id") REFERENCES "fee_payments"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_payment_allocations_assignment_fk" FOREIGN KEY ("trust_id","school_id","assignment_id") REFERENCES "student_fee_assignments"("trust_id","school_id","id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "fee_payment_allocations_key" ON "fee_payment_allocations"("trust_id","school_id","payment_id","assignment_id");
CREATE INDEX "fee_payment_allocations_assignment_idx" ON "fee_payment_allocations"("trust_id","school_id","assignment_id","created_at");

CREATE TABLE "fee_receipt_sequences" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "academic_year_id" TEXT NOT NULL,
  "current_value" INTEGER NOT NULL DEFAULT 0, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_receipt_sequences_value_check" CHECK ("current_value" >= 0),
  CONSTRAINT "fee_receipt_sequences_school_fk" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_receipt_sequences_year_fk" FOREIGN KEY ("trust_id","school_id","academic_year_id") REFERENCES "academic_years"("trust_id","school_id","id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "fee_receipt_sequences_key" ON "fee_receipt_sequences"("trust_id","school_id","academic_year_id");

CREATE TABLE "fee_receipts" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "payment_id" TEXT NOT NULL, "receipt_number" TEXT NOT NULL,
  "amount_minor" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'INR', "snapshot" JSONB NOT NULL,
  "finalized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finalized_by" TEXT NOT NULL,
  CONSTRAINT "fee_receipts_amount_check" CHECK ("amount_minor" > 0 AND "currency" = 'INR'),
  CONSTRAINT "fee_receipts_payment_fk" FOREIGN KEY ("trust_id","school_id","payment_id") REFERENCES "fee_payments"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_receipts_finalizer_fk" FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "fee_receipts_payment_global_key" ON "fee_receipts"("payment_id");
CREATE UNIQUE INDEX "fee_receipts_scope_id_key" ON "fee_receipts"("trust_id","school_id","id");
CREATE UNIQUE INDEX "fee_receipts_number_key" ON "fee_receipts"("trust_id","school_id","receipt_number");
CREATE UNIQUE INDEX "fee_receipts_payment_key" ON "fee_receipts"("trust_id","school_id","payment_id");
CREATE INDEX "fee_receipts_finalized_idx" ON "fee_receipts"("trust_id","school_id","finalized_at");

CREATE TABLE "fee_payment_reversals" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "payment_id" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "reversed_by" TEXT NOT NULL, "reversed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_payment_reversals_payment_fk" FOREIGN KEY ("trust_id","school_id","payment_id") REFERENCES "fee_payments"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_payment_reversals_reverser_fk" FOREIGN KEY ("reversed_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "fee_payment_reversals_payment_global_key" ON "fee_payment_reversals"("payment_id");
CREATE UNIQUE INDEX "fee_payment_reversals_scope_id_key" ON "fee_payment_reversals"("trust_id","school_id","id");
CREATE UNIQUE INDEX "fee_payment_reversals_payment_key" ON "fee_payment_reversals"("trust_id","school_id","payment_id");
CREATE INDEX "fee_payment_reversals_date_idx" ON "fee_payment_reversals"("trust_id","school_id","reversed_at");

CREATE TABLE "fee_refunds" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "payment_id" TEXT NOT NULL, "amount_minor" INTEGER NOT NULL,
  "reason" TEXT NOT NULL, "state" "FeeRefundState" NOT NULL DEFAULT 'PENDING', "requested_by" TEXT NOT NULL, "decided_by" TEXT,
  "decision_note" TEXT, "decided_at" TIMESTAMP(3), "paid_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_refunds_amount_check" CHECK ("amount_minor" > 0),
  CONSTRAINT "fee_refunds_payment_fk" FOREIGN KEY ("trust_id","school_id","payment_id") REFERENCES "fee_payments"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "fee_refunds_requester_fk" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "fee_refunds_approver_fk" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "fee_refunds_scope_id_key" ON "fee_refunds"("trust_id","school_id","id");
CREATE INDEX "fee_refunds_queue_idx" ON "fee_refunds"("trust_id","school_id","state","created_at");
CREATE INDEX "fee_refunds_payment_idx" ON "fee_refunds"("trust_id","school_id","payment_id","state");

CREATE TABLE "payment_gateway_events" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "provider" TEXT NOT NULL, "provider_event_id" TEXT NOT NULL,
  "provider_payment_id" TEXT, "state" "GatewayEventState" NOT NULL DEFAULT 'RECEIVED', "event_type" TEXT NOT NULL, "payload_hash" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reconciled_at" TIMESTAMP(3),
  CONSTRAINT "payment_gateway_events_school_fk" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "payment_gateway_events_key" ON "payment_gateway_events"("trust_id","school_id","provider","provider_event_id");
CREATE INDEX "payment_gateway_events_state_idx" ON "payment_gateway_events"("trust_id","school_id","state","received_at");

CREATE TABLE "daily_collection_closures" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "campus_id" TEXT NOT NULL, "academic_year_id" TEXT NOT NULL,
  "collection_date" DATE NOT NULL, "gross_amount_minor" INTEGER NOT NULL, "reversal_minor" INTEGER NOT NULL, "refund_minor" INTEGER NOT NULL,
  "net_amount_minor" INTEGER NOT NULL, "method_summary" JSONB NOT NULL, "closed_by" TEXT NOT NULL, "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_collection_closures_amount_check" CHECK ("gross_amount_minor" >= 0 AND "reversal_minor" >= 0 AND "refund_minor" >= 0),
  CONSTRAINT "daily_collection_closures_school_fk" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT,
  CONSTRAINT "daily_collection_closures_campus_fk" FOREIGN KEY ("trust_id","school_id","campus_id") REFERENCES "campuses"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "daily_collection_closures_year_fk" FOREIGN KEY ("trust_id","school_id","academic_year_id") REFERENCES "academic_years"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "daily_collection_closures_closer_fk" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "daily_collection_closures_key" ON "daily_collection_closures"("trust_id","school_id","campus_id","collection_date");
CREATE INDEX "daily_collection_closures_year_idx" ON "daily_collection_closures"("trust_id","school_id","academic_year_id","collection_date");

CREATE TABLE "financial_audit_entries" (
  "id" TEXT PRIMARY KEY, "trust_id" TEXT NOT NULL, "school_id" TEXT NOT NULL, "campus_id" TEXT, "academic_year_id" TEXT,
  "student_profile_id" TEXT, "direction" "FinancialDirection" NOT NULL, "amount_minor" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'INR',
  "action" TEXT NOT NULL, "resource_type" TEXT NOT NULL, "resource_id" TEXT NOT NULL, "correlation_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL, "metadata" JSONB, "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_audit_entries_amount_check" CHECK ("amount_minor" >= 0 AND "currency" = 'INR'),
  CONSTRAINT "financial_audit_entries_school_fk" FOREIGN KEY ("trust_id","school_id") REFERENCES "schools"("trust_id","id") ON DELETE RESTRICT,
  CONSTRAINT "financial_audit_entries_campus_fk" FOREIGN KEY ("trust_id","school_id","campus_id") REFERENCES "campuses"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "financial_audit_entries_year_fk" FOREIGN KEY ("trust_id","school_id","academic_year_id") REFERENCES "academic_years"("trust_id","school_id","id") ON DELETE RESTRICT,
  CONSTRAINT "financial_audit_entries_student_fk" FOREIGN KEY ("trust_id","student_profile_id") REFERENCES "student_profiles"("trust_id","id") ON DELETE RESTRICT,
  CONSTRAINT "financial_audit_entries_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX "financial_audit_entries_student_idx" ON "financial_audit_entries"("trust_id","school_id","student_profile_id","occurred_at");
CREATE INDEX "financial_audit_entries_resource_idx" ON "financial_audit_entries"("trust_id","school_id","resource_type","resource_id","occurred_at");
CREATE INDEX "financial_audit_entries_date_idx" ON "financial_audit_entries"("trust_id","school_id","occurred_at");

CREATE FUNCTION reject_financial_history_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'financial history is append-only; create a reversal or correction entry'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "fee_receipts_append_only" BEFORE UPDATE OR DELETE ON "fee_receipts" FOR EACH ROW EXECUTE FUNCTION reject_financial_history_mutation();
CREATE TRIGGER "fee_payment_allocations_append_only" BEFORE UPDATE OR DELETE ON "fee_payment_allocations" FOR EACH ROW EXECUTE FUNCTION reject_financial_history_mutation();
CREATE TRIGGER "financial_audit_entries_append_only" BEFORE UPDATE OR DELETE ON "financial_audit_entries" FOR EACH ROW EXECUTE FUNCTION reject_financial_history_mutation();
CREATE TRIGGER "daily_collection_closures_append_only" BEFORE UPDATE OR DELETE ON "daily_collection_closures" FOR EACH ROW EXECUTE FUNCTION reject_financial_history_mutation();

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'fee_categories','fee_heads','fee_structures','fee_installments','fee_structure_lines','student_fee_assignments',
    'fee_adjustments','fee_payments','fee_payment_allocations','fee_receipt_sequences','fee_receipts','fee_payment_reversals',
    'fee_refunds','payment_gateway_events','daily_collection_closures','financial_audit_entries'
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
GRANT SELECT, INSERT, UPDATE ON "fee_categories","fee_heads","fee_structures","fee_installments","fee_structure_lines","student_fee_assignments","fee_adjustments","fee_payments","fee_receipt_sequences","fee_refunds","payment_gateway_events" TO nasaq_app;
GRANT SELECT, INSERT ON "fee_payment_allocations","fee_receipts","fee_payment_reversals","daily_collection_closures","financial_audit_entries" TO nasaq_app;
