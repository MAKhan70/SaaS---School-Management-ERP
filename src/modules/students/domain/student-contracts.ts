import { createHash } from "node:crypto";

import { z } from "zod";

import {
  privateDocumentMimeTypeSchema,
  privateDocumentNameSchema,
  privateStorageKeySchema,
} from "@/lib/private-file-policy";

const id = z.string().min(1).max(100);
const shortText = z.string().trim().min(1).max(120);
const optionalText = z.string().trim().max(500).optional();
const date = z.iso.date();

export const studentDirectoryQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: z
    .enum([
      "ADMITTED",
      "ACTIVE",
      "WITHDRAWN",
      "TRANSFERRED",
      "GRADUATED",
      "ALUMNI",
      "ARCHIVED",
    ])
    .optional(),
  gradeId: id.optional(),
  sectionId: id.optional(),
  houseId: id.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const addressSchema = z.object({
  type: z.enum(["CURRENT", "PERMANENT", "CORRESPONDENCE"]),
  line1: shortText,
  line2: optionalText,
  locality: optionalText,
  city: shortText,
  district: optionalText,
  stateCode: z.string().trim().length(2).toUpperCase(),
  postalCode: z.string().regex(/^\d{6}$/),
});

export const createStudentSchema = z.object({
  firstName: shortText,
  lastName: shortText,
  preferredName: z.string().trim().max(120).optional(),
  dateOfBirth: date,
  admissionDate: date,
  academicYearId: id,
  campusId: id,
  sectionId: id.optional(),
  admissionNumber: z.string().trim().max(50).optional(),
  admissionCategory: z.string().trim().max(80).optional(),
  previousSchool: z.string().trim().max(160).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{7,14}$/)
    .optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  address: addressSchema.optional(),
  transportEligible: z.boolean().default(false),
  hostelEligible: z.boolean().default(false),
  duplicateOverrideReason: z.string().trim().min(10).max(500).optional(),
});

const guardianSchema = z.object({
  action: z.literal("guardian.assign"),
  studentId: id,
  firstName: shortText,
  lastName: shortText,
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{7,14}$/),
  email: z.string().trim().toLowerCase().email().optional(),
  relationshipType: z.enum([
    "FATHER",
    "MOTHER",
    "LEGAL_GUARDIAN",
    "GRANDPARENT",
    "SIBLING",
    "OTHER",
  ]),
  isPrimary: z.boolean().default(false),
  canPickUp: z.boolean().default(false),
  receivesCommunication: z.boolean().default(true),
  hasCustody: z.boolean().default(false),
  priority: z.number().int().min(1).max(20).default(1),
  effectiveFrom: date,
});

const enrollmentAction = z.object({
  action: z.enum([
    "enrollment.enrol",
    "enrollment.transfer-section",
    "enrollment.promote",
    "enrollment.detain",
    "enrollment.withdraw",
    "enrollment.transfer-school",
    "enrollment.graduate",
    "enrollment.mark-alumni",
  ]),
  studentId: id,
  effectiveOn: date,
  academicYearId: id.optional(),
  schoolId: id.optional(),
  campusId: id.optional(),
  sectionId: id.optional(),
  rollNumber: z.string().trim().max(30).optional(),
  reason: z.string().trim().min(3).max(500).optional(),
});

export const studentMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("student.create"), data: createStudentSchema }),
  z.object({
    action: z.literal("student.update"),
    studentId: id,
    data: createStudentSchema
      .pick({
        firstName: true,
        lastName: true,
        preferredName: true,
        phone: true,
        email: true,
        address: true,
        transportEligible: true,
        hostelEligible: true,
      })
      .partial(),
  }),
  guardianSchema,
  enrollmentAction,
  z.object({
    action: z.enum(["student.archive", "student.restore"]),
    studentId: id,
    reason: z.string().trim().min(10).max(500),
  }),
  z.object({
    action: z.literal("sensitive.upsert"),
    studentId: id,
    type: z.enum(["MEDICAL_ALERT", "ALLERGY", "ACCOMMODATION", "DEMOGRAPHIC"]),
    value: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("note.create"),
    studentId: id,
    body: z.string().trim().min(1).max(4000),
    visibility: z.enum(["STANDARD", "RESTRICTED"]).default("STANDARD"),
  }),
  z.object({
    action: z.literal("document.register"),
    studentId: id,
    campusId: id.optional(),
    type: shortText,
    displayName: privateDocumentNameSchema,
    storageKey: privateStorageKeySchema,
    mimeType: privateDocumentMimeTypeSchema,
    sizeBytes: z.number().int().positive().max(25_000_000),
  }),
]);

export type StudentMutation = z.infer<typeof studentMutationSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export function normalizedContactHash(value: string): string {
  return createHash("sha256")
    .update(
      value
        .trim()
        .toLocaleLowerCase("en-IN")
        .replace(/[\s()-]/g, ""),
    )
    .digest("hex");
}

export function duplicateFingerprint(input: {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}): string {
  return [input.firstName, input.lastName, input.dateOfBirth]
    .map((part) => part.trim().toLocaleLowerCase("en-IN").replace(/\s+/g, " "))
    .join("|");
}

export const studentCsvHeaders = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "admissionDate",
  "academicYearId",
  "campusId",
  "sectionId",
  "phone",
  "email",
] as const;

export function parseStudentCsv(csv: string) {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines.length === 0)
    return { accepted: [], errors: [{ row: 1, message: "CSV is empty" }] };
  const headers = lines[0]?.split(",").map((value) => value.trim()) ?? [];
  if (studentCsvHeaders.some((header) => !headers.includes(header)))
    return {
      accepted: [],
      errors: [{ row: 1, message: "CSV headers do not match the template" }],
    };
  const accepted: Array<Record<string, string>> = [];
  const errors: Array<{ row: number; message: string }> = [];
  lines.slice(1, 251).forEach((line, index) => {
    const values = line.split(",").map((value) => value.trim());
    const row = Object.fromEntries(
      headers.map((header, column) => [header, values[column] ?? ""]),
    );
    const result = createStudentSchema.safeParse({
      ...row,
      transportEligible: false,
      hostelEligible: false,
    });
    if (result.success) accepted.push(row);
    else
      errors.push({
        row: index + 2,
        message: result.error.issues[0]?.message ?? "Invalid row",
      });
  });
  return { accepted, errors };
}
