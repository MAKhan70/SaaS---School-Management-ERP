import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  privateDocumentMimeTypeSchema,
  privateDocumentNameSchema,
  privateStorageKeySchema,
} from "@/lib/private-file-policy";

export const admissionStages = [
  "ENQUIRY",
  "CONTACTED",
  "FOLLOW_UP_SCHEDULED",
  "APPLICATION_STARTED",
  "APPLICATION_SUBMITTED",
  "DOCUMENTS_PENDING",
  "UNDER_REVIEW",
  "ASSESSMENT_SCHEDULED",
  "INTERVIEW_SCHEDULED",
  "OFFERED",
  "WAITLISTED",
  "ADMITTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export type AdmissionStageValue = (typeof admissionStages)[number];

const transitions: Record<AdmissionStageValue, readonly AdmissionStageValue[]> =
  {
    ENQUIRY: ["CONTACTED", "WITHDRAWN"],
    CONTACTED: [
      "FOLLOW_UP_SCHEDULED",
      "APPLICATION_STARTED",
      "REJECTED",
      "WITHDRAWN",
    ],
    FOLLOW_UP_SCHEDULED: ["CONTACTED", "APPLICATION_STARTED", "WITHDRAWN"],
    APPLICATION_STARTED: ["APPLICATION_SUBMITTED", "WITHDRAWN"],
    APPLICATION_SUBMITTED: ["DOCUMENTS_PENDING", "UNDER_REVIEW", "WITHDRAWN"],
    DOCUMENTS_PENDING: ["UNDER_REVIEW", "WITHDRAWN"],
    UNDER_REVIEW: [
      "ASSESSMENT_SCHEDULED",
      "INTERVIEW_SCHEDULED",
      "OFFERED",
      "WAITLISTED",
      "REJECTED",
      "WITHDRAWN",
    ],
    ASSESSMENT_SCHEDULED: [
      "UNDER_REVIEW",
      "INTERVIEW_SCHEDULED",
      "OFFERED",
      "WAITLISTED",
      "REJECTED",
      "WITHDRAWN",
    ],
    INTERVIEW_SCHEDULED: [
      "UNDER_REVIEW",
      "OFFERED",
      "WAITLISTED",
      "REJECTED",
      "WITHDRAWN",
    ],
    OFFERED: ["ADMITTED", "REJECTED", "WITHDRAWN"],
    WAITLISTED: ["OFFERED", "REJECTED", "WITHDRAWN"],
    ADMITTED: ["WITHDRAWN"],
    REJECTED: [],
    WITHDRAWN: [],
  };

export function canTransitionAdmission(
  from: AdmissionStageValue,
  to: AdmissionStageValue,
) {
  return transitions[from].includes(to);
}

const id = z.string().min(1).max(100);
const shortText = z.string().trim().min(1).max(160);
const optionalContact = z.string().trim().max(254).optional();

export const admissionFormFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9]{1,49}$/),
  label: shortText,
  type: z.enum([
    "text",
    "email",
    "phone",
    "date",
    "textarea",
    "select",
    "checkbox",
  ]),
  required: z.boolean().default(false),
  helpText: z.string().trim().max(240).optional(),
  options: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
});

export const admissionFormDefinitionSchema = z.object({
  fields: z
    .array(admissionFormFieldSchema)
    .min(1)
    .max(40)
    .superRefine((fields, context) => {
      const keys = new Set<string>();
      fields.forEach((field, index) => {
        if (keys.has(field.key))
          context.addIssue({
            code: "custom",
            path: [index, "key"],
            message: "Field keys must be unique",
          });
        keys.add(field.key);
        if (field.type === "select" && !field.options?.length)
          context.addIssue({
            code: "custom",
            path: [index, "options"],
            message: "Select fields require options",
          });
      });
    }),
});

export const publicAdmissionSubmissionSchema = z
  .object({
    formToken: z.string().min(20).max(1000),
    website: z.string().max(0).default(""),
    applicantName: shortText,
    dateOfBirth: z.iso.date().optional(),
    email: optionalContact.refine(
      (value) => !value || z.email().safeParse(value).success,
      "Enter a valid email address",
    ),
    phone: optionalContact.refine(
      (value) => !value || /^\+?[1-9]\d{7,14}$/.test(value),
      "Enter a valid phone number",
    ),
    source: z.string().trim().min(1).max(80).default("PUBLIC_FORM"),
    targetGradeClassId: id.optional(),
    siblingStudentProfileId: id.optional(),
    answers: z
      .record(z.string(), z.union([z.string().max(2000), z.boolean()]))
      .default({}),
  })
  .refine((input) => input.email || input.phone, {
    message: "Email or phone is required",
    path: ["email"],
  });

export const admissionQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  stage: z.enum(admissionStages).optional(),
  counselorUserId: id.optional(),
  gradeClassId: id.optional(),
});

export const admissionMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("form.create"),
    academicYearId: id,
    kind: z.enum(["ENQUIRY", "APPLICATION"]),
    code: z
      .string()
      .trim()
      .regex(/^[A-Z0-9-]{2,40}$/),
    name: shortText,
    fields: z.array(admissionFormFieldSchema).min(1).max(40),
  }),
  z.object({
    action: z.literal("form.publish"),
    formId: id,
    publicKey: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{12,80}$/),
  }),
  z.object({
    action: z.literal("stage.transition"),
    applicationId: id,
    to: z.enum(admissionStages),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("counselor.assign"),
    applicationId: id,
    counselorUserId: id,
  }),
  z.object({
    action: z.literal("note.add"),
    applicationId: id,
    note: z.string().trim().min(1).max(4000),
  }),
  z.object({
    action: z.literal("follow-up.create"),
    applicationId: id,
    title: shortText,
    dueAt: z.iso.datetime(),
    assigneeUserId: id.optional(),
  }),
  z.object({
    action: z.literal("follow-up.complete"),
    applicationId: id,
    followUpId: id,
  }),
  z.object({
    action: z.literal("document.upsert"),
    applicationId: id,
    code: z.string().trim().min(1).max(60),
    label: shortText,
    required: z.boolean().default(true),
    status: z.enum(["PENDING", "RECEIVED", "VERIFIED", "REJECTED", "WAIVED"]),
    storageKey: privateStorageKeySchema.optional(),
    displayName: privateDocumentNameSchema.optional(),
    mimeType: privateDocumentMimeTypeSchema.optional(),
    sizeBytes: z.number().int().positive().max(25_000_000).optional(),
  }),
  z.object({
    action: z.literal("fee.update"),
    applicationId: id,
    amountMinor: z.number().int().min(0),
    currency: z.string().length(3).toUpperCase(),
    status: z.enum(["NOT_REQUIRED", "PENDING", "PAID", "WAIVED", "REFUNDED"]),
    reference: z.string().trim().max(120).optional(),
  }),
  z.object({
    action: z.literal("schedule.create"),
    applicationId: id,
    type: z.enum(["ASSESSMENT", "INTERVIEW"]),
    scheduledFor: z.iso.datetime(),
    durationMinutes: z.number().int().min(10).max(480).default(30),
    location: z.string().trim().max(200).optional(),
    assigneeUserId: id.optional(),
  }),
  z.object({
    action: z.literal("application.convert"),
    applicationId: id,
    campusId: id,
    sectionId: id.optional(),
    admissionDate: z.iso.date(),
    duplicateOverrideReason: z.string().trim().min(10).max(500).optional(),
  }),
  z.object({
    action: z.literal("seat-plan.upsert"),
    academicYearId: id,
    gradeClassId: id,
    capacity: z.number().int().min(0).max(10000),
    holdOfferedSeats: z.boolean().default(true),
  }),
]);

export type AdmissionMutation = z.infer<typeof admissionMutationSchema>;
export type PublicAdmissionSubmission = z.infer<
  typeof publicAdmissionSubmissionSchema
>;

function formSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production")
    throw new Error("AUTH_SECRET is required for public admission forms");
  return secret ?? "development-only-admission-form-secret";
}

export function createPublicFormToken(
  publicKey: string,
  now = new Date(),
): string {
  const issuedAt = now.getTime().toString();
  const nonce = crypto.randomUUID();
  const payload = `${publicKey}.${issuedAt}.${nonce}`;
  const signature = createHmac("sha256", formSecret())
    .update(payload)
    .digest("base64url");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyPublicFormToken(
  publicKey: string,
  token: string,
  now = new Date(),
): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 4 || parts[0] !== publicKey) return false;
    const issuedAt = Number(parts[1]);
    const age = now.getTime() - issuedAt;
    if (!Number.isFinite(issuedAt) || age < 0 || age > 2 * 60 * 60 * 1000)
      return false;
    const payload = parts.slice(0, 3).join(".");
    const expected = createHmac("sha256", formSecret())
      .update(payload)
      .digest();
    const supplied = Buffer.from(parts[3] ?? "", "base64url");
    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  } catch {
    return false;
  }
}
