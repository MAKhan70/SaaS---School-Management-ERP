import { z } from "zod";

const id = z.string().min(1).max(100);
const reason = z.string().trim().min(5).max(500);
const marks = z.string().regex(/^\d{1,6}(?:\.\d{1,2})?$/);

export const examinationWorkspaceQuerySchema = z.object({
  examinationId: id.optional(),
  examinationSubjectId: id.optional(),
});

const markValueSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("MARKED"),
    marks,
  }),
  z.object({
    status: z.enum(["ABSENT", "EXEMPT"]),
    marks: z.null().optional(),
  }),
]);

export const examinationMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("marks.bulk.save"),
    examinationSubjectId: id,
    reason: reason.optional(),
    records: z
      .array(
        z
          .object({
            enrollmentId: id,
            studentProfileId: id,
            componentId: id,
            teacherRemark: z.string().trim().max(500).optional(),
          })
          .and(markValueSchema),
      )
      .min(1)
      .max(500),
  }),
  z.object({ action: z.literal("register.approve"), registerId: id }),
  z.object({ action: z.literal("register.lock"), registerId: id }),
  z.object({
    action: z.literal("register.reopen.request"),
    registerId: id,
    reason,
  }),
  z.object({
    action: z.literal("register.reopen.decide"),
    requestId: id,
    approve: z.boolean(),
    note: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("moderation.request"),
    markEntryId: id,
    proposed: markValueSchema,
    reason,
  }),
  z.object({
    action: z.literal("moderation.decide"),
    requestId: id,
    approve: z.boolean(),
    note: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("results.calculate"),
    examinationId: id,
    studentProfileId: id,
    teacherRemark: z.string().trim().max(1000).optional(),
    principalRemark: z.string().trim().max(1000).optional(),
    promotionRecommendation: z.enum([
      "PROMOTE",
      "PROMOTE_WITH_SUPPORT",
      "DETAIN",
      "REVIEW_REQUIRED",
      "NOT_APPLICABLE",
    ]),
  }),
  z.object({
    action: z.literal("results.publish"),
    examinationId: id,
    studentProfileIds: z.array(id).min(1).max(500).optional(),
  }),
  z.object({
    action: z.literal("report.preview"),
    examinationId: id,
    templateId: id,
    studentProfileId: id,
  }),
  z.object({
    action: z.literal("report.generate"),
    examinationId: id,
    templateId: id,
    studentProfileId: id.optional(),
    kind: z.enum(["INDIVIDUAL", "BULK"]),
  }),
]);

export type ExaminationMutation = z.infer<typeof examinationMutationSchema>;
