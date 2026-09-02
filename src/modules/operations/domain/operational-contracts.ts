import { z } from "zod";

import { operationalModuleSlugs } from "@/modules/operations/domain/operational-catalogue";

const id = z.string().trim().min(1).max(100);
const code = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{1,39}$/);
const reference = z
  .string()
  .trim()
  .regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/);
const title = z.string().trim().min(3).max(160);
const summary = z.string().trim().min(3).max(500);
const date = z.iso.date();

export const operationalModuleSlugSchema = z.enum(operationalModuleSlugs);

export const operationalWorkspaceQuerySchema = z.object({
  state: z
    .enum([
      "DRAFT",
      "ACTIVE",
      "PENDING_APPROVAL",
      "APPROVED",
      "COMPLETED",
      "ARCHIVED",
    ])
    .optional(),
  recordType: code.optional(),
  search: z.string().trim().min(2).max(80).optional(),
});

export const operationalMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      recordType: code,
      referenceNumber: reference,
      title,
      summary: summary.optional(),
      effectiveFrom: date.optional(),
      effectiveTo: date.optional(),
      assignedToUserId: id.optional(),
      details: z.record(z.string().max(40), z.string().max(200)).optional(),
    })
    .superRefine((value, context) => {
      if (
        value.effectiveFrom &&
        value.effectiveTo &&
        value.effectiveTo < value.effectiveFrom
      )
        context.addIssue({
          code: "custom",
          path: ["effectiveTo"],
          message: "Effective end date must not precede the start date",
        });
    }),
  z.object({
    action: z.literal("transition"),
    recordId: id,
    expectedVersion: z.coerce.number().int().positive(),
    toState: z.enum([
      "ACTIVE",
      "PENDING_APPROVAL",
      "APPROVED",
      "COMPLETED",
      "ARCHIVED",
    ]),
    reason: z.string().trim().min(5).max(500),
  }),
]);

export type OperationalMutation = z.infer<typeof operationalMutationSchema>;
