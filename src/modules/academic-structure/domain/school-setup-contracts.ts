import { z } from "zod";

const identifier = z.string().trim().min(1).max(64);
const label = z.string().trim().min(1).max(160);
const date = z.iso.date();

export const institutionProfileMutationSchema = z.object({
  action: z.literal("profile.update"),
  resource: z.enum(["trust", "school", "campus"]),
  resourceId: identifier,
  name: label,
  code: identifier.optional(),
  defaultLocale: z
    .string()
    .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
    .optional(),
  defaultTimezone: z.string().trim().min(3).max(80).optional(),
  defaultCurrency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  timezone: z.string().trim().min(3).max(80).optional(),
});

export const schoolSetupMutationSchema = z.discriminatedUnion("action", [
  institutionProfileMutationSchema,
  z.object({
    action: z.literal("academicYear.create"),
    code: identifier,
    name: label,
    startsOn: date,
    endsOn: date,
    status: z.enum(["PLANNED", "ACTIVE"]).default("PLANNED"),
  }),
  z.object({
    action: z.literal("academicYear.copy"),
    sourceAcademicYearId: identifier,
    code: identifier,
    name: label,
    startsOn: date,
    endsOn: date,
  }),
  z.object({
    action: z.literal("board.createVersion"),
    boardType: z.enum([
      "CBSE",
      "CISCE",
      "MAHARASHTRA_STATE",
      "OTHER_STATE",
      "CUSTOM",
    ]),
    stateCode: z.string().trim().max(8).optional(),
    name: label,
    effectiveFrom: date,
    rules: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    action: z.literal("term.create"),
    academicYearId: identifier,
    code: identifier,
    name: label,
    sequence: z.coerce.number().int().positive(),
    startsOn: date,
    endsOn: date,
  }),
  z.object({
    action: z.literal("catalog.create"),
    kind: z.enum(["grade", "stream", "department", "subject", "house"]),
    code: identifier,
    name: label,
    boardConfigurationId: identifier.optional(),
    departmentId: identifier.optional(),
    level: z.coerce.number().int().min(0).max(20).optional(),
    colour: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
  z.object({
    action: z.literal("section.create"),
    campusId: identifier,
    academicYearId: identifier,
    gradeClassId: identifier,
    streamId: identifier.optional(),
    code: identifier,
    name: label,
    capacity: z.coerce.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("room.create"),
    campusId: identifier,
    code: identifier,
    name: label,
    roomType: label,
    capacity: z.coerce.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal("period.create"),
    academicYearId: identifier,
    campusId: identifier.optional(),
    code: identifier,
    name: label,
    sequence: z.coerce.number().int().positive(),
    startsMinute: z.coerce.number().int().min(0).max(1439),
    endsMinute: z.coerce.number().int().min(1).max(1440),
    isInstruction: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("calendar.create"),
    academicYearId: identifier,
    campusId: identifier.optional(),
    date,
    type: z.enum(["WORKING_DAY", "HOLIDAY", "NON_WORKING_DAY", "SCHOOL_EVENT"]),
    name: label,
    description: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("workingDays.replace"),
    academicYearId: identifier,
    weekdays: z.array(z.number().int().min(1).max(7)).min(1),
  }),
  z.object({
    action: z.literal("gradingScale.createVersion"),
    academicYearId: identifier.optional(),
    code: identifier,
    name: label,
    effectiveFrom: date,
    bands: z
      .array(
        z.object({
          code: identifier,
          name: label,
          minimumValue: z.coerce.number(),
          maximumValue: z.coerce.number(),
          gradePoint: z.coerce.number().optional(),
        }),
      )
      .min(1),
  }),
  z.object({
    action: z.literal("numbering.createVersion"),
    entityType: z.enum(["STUDENT", "EMPLOYEE"]),
    academicYearId: identifier.optional(),
    prefixTemplate: z.string().trim().max(80),
    suffixTemplate: z.string().trim().max(80).optional(),
    padding: z.coerce.number().int().min(2).max(12),
    resetPolicy: z.enum(["NEVER", "ACADEMIC_YEAR", "CALENDAR_YEAR"]),
    effectiveFrom: date,
  }),
  z.object({
    action: z.literal("configuration.archive"),
    kind: z.enum([
      "academicYear",
      "term",
      "board",
      "grade",
      "section",
      "stream",
      "department",
      "subject",
      "room",
      "period",
      "calendar",
      "gradingScale",
      "house",
      "numberingRule",
    ]),
    resourceId: identifier,
    reason: z.string().trim().min(3).max(300),
  }),
]);

export type SchoolSetupMutation = z.output<typeof schoolSetupMutationSchema>;
export type InstitutionProfileMutation = z.output<
  typeof institutionProfileMutationSchema
>;

export function academicYearsOverlap(
  first: { startsOn: Date; endsOn: Date },
  second: { startsOn: Date; endsOn: Date },
): boolean {
  return first.startsOn <= second.endsOn && second.startsOn <= first.endsOn;
}

export const importTemplateColumns = {
  grades: ["code", "name", "level", "boardConfigurationId"],
  subjects: ["code", "name", "departmentId"],
  rooms: ["campusId", "code", "name", "roomType", "capacity"],
  holidays: ["academicYearId", "campusId", "date", "name", "description"],
} as const;

export type ImportTemplate = keyof typeof importTemplateColumns;

export function csvTemplate(kind: ImportTemplate): string {
  return `${importTemplateColumns[kind].join(",")}\n`;
}
