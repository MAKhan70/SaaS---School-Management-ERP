import { z } from "zod";

const id = z.string().min(1).max(100);
const code = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_-]{1,39}$/);
const label = z.string().trim().min(2).max(120);
const amount = z
  .string()
  .trim()
  .regex(/^(0|[1-9]\d{0,12})(?:\.\d{1,2})?$/);
const reason = z.string().trim().min(5).max(500);
const date = z.iso.date();

export const feeWorkspaceQuerySchema = z.object({
  studentProfileId: id.optional(),
  report: z.enum(["outstanding", "collections"]).optional(),
  from: date.optional(),
  to: date.optional(),
});

export const feeMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("category.create"), code, name: label }),
  z.object({
    action: z.literal("head.create"),
    categoryId: id,
    code,
    name: label,
    kind: z.enum([
      "REGULAR",
      "OPTIONAL",
      "TRANSPORT",
      "HOSTEL",
      "LATE_FEE",
      "FINE",
      "OTHER",
    ]),
    refundable: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("structure.create"),
    gradeClassId: id,
    code,
    name: label,
    version: z.coerce.number().int().min(1).max(100),
    installments: z
      .array(
        z.object({
          code,
          name: label,
          dueOn: date,
          lines: z
            .array(z.object({ feeHeadId: id, amount }))
            .min(1)
            .max(100),
        }),
      )
      .min(1)
      .max(20),
  }),
  z.object({
    action: z.literal("assignment.create"),
    studentProfileId: id,
    enrollmentId: id,
    feeHeadId: id,
    structureLineId: id.optional(),
    installmentId: id.optional(),
    source: z.enum([
      "CLASS",
      "STUDENT",
      "OPTIONAL",
      "TRANSPORT",
      "HOSTEL",
      "CARRY_FORWARD",
    ]),
    description: label,
    amount,
    dueOn: date,
  }),
  z.object({
    action: z.literal("assignment.class.apply"),
    feeStructureId: id,
    sectionId: id,
  }),
  z.object({
    action: z.literal("adjustment.request"),
    assignmentId: id,
    kind: z.enum([
      "DISCOUNT",
      "CONCESSION",
      "SCHOLARSHIP",
      "WAIVER",
      "LATE_FEE",
      "FINE",
      "CREDIT_NOTE",
    ]),
    amount,
    reason,
  }),
  z.object({
    action: z.literal("adjustment.decide"),
    adjustmentId: id,
    approve: z.boolean(),
    note: reason,
  }),
  z.object({
    action: z.literal("payment.post"),
    studentProfileId: id,
    idempotencyKey: z.string().trim().min(8).max(120),
    method: z.enum([
      "CASH",
      "CHEQUE",
      "BANK_TRANSFER",
      "UPI",
      "CARD",
      "ONLINE_GATEWAY",
    ]),
    amount,
    paidAt: z.iso.datetime({ offset: true }),
    instrumentReference: z.string().trim().max(120).optional(),
    allocations: z
      .array(z.object({ assignmentId: id, amount }))
      .min(1)
      .max(100),
  }),
  z.object({ action: z.literal("payment.reverse"), paymentId: id, reason }),
  z.object({
    action: z.literal("refund.request"),
    paymentId: id,
    amount,
    reason,
  }),
  z.object({
    action: z.literal("refund.decide"),
    refundId: id,
    approve: z.boolean(),
    note: reason,
  }),
  z.object({
    action: z.literal("gateway.reconcile"),
    providerEventId: z.string().trim().min(4).max(160),
    providerPaymentId: z.string().trim().min(4).max(160),
    eventType: z.enum([
      "PAYMENT_CONFIRMED",
      "PAYMENT_FAILED",
      "REFUND_CONFIRMED",
    ]),
  }),
  z.object({ action: z.literal("collection.close"), campusId: id, date }),
]);

export type FeeMutation = z.infer<typeof feeMutationSchema>;
