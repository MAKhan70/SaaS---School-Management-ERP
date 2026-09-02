import { z } from "zod";

export const attendanceDateSchema = z.iso.date();

export const builtInAttendanceStatuses = [
  { code: "PRESENT", name: "Present", category: "PRESENT", fraction: 100 },
  { code: "ABSENT", name: "Absent", category: "ABSENT", fraction: 0 },
  { code: "LATE", name: "Late", category: "LATE", fraction: 100 },
  { code: "EXCUSED", name: "Excused", category: "EXCUSED", fraction: 0 },
  { code: "HALF_DAY", name: "Half day", category: "HALF_DAY", fraction: 50 },
  {
    code: "MEDICAL_LEAVE",
    name: "Medical leave",
    category: "MEDICAL_LEAVE",
    fraction: 0,
  },
  {
    code: "SCHOOL_ACTIVITY",
    name: "School activity",
    category: "SCHOOL_ACTIVITY",
    fraction: 100,
  },
] as const;

export const attendanceStatusCategorySchema = z.enum([
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
  "HALF_DAY",
  "MEDICAL_LEAVE",
  "SCHOOL_ACTIVITY",
  "CUSTOM",
]);

const identifier = z.string().min(1).max(100);
const reason = z.string().trim().min(5).max(500);

export const attendanceWorkspaceQuerySchema = z.object({
  sectionId: identifier.optional(),
  date: attendanceDateSchema.optional(),
  periodId: identifier.optional(),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

const attendanceEntrySchema = z.object({
  enrollmentId: identifier,
  studentProfileId: identifier,
  statusCode: z.string().trim().min(1).max(40),
  minutesLate: z.coerce.number().int().min(0).max(600).optional(),
  note: z.string().trim().max(300).optional(),
});

const studentBulkSubmitSchema = z.object({
  action: z.literal("student.bulk.submit"),
  sectionId: identifier,
  date: attendanceDateSchema,
  periodId: identifier.nullish(),
  clientSubmissionId: z.uuid(),
  correctionReason: reason.optional(),
  records: z.array(attendanceEntrySchema).min(1).max(250),
});

const sessionMutationBase = z.object({ sessionId: identifier });

const staffTimestamp = z.iso.datetime({ offset: true });

export const attendanceMutationSchema = z.discriminatedUnion("action", [
  studentBulkSubmitSchema,
  sessionMutationBase.extend({ action: z.literal("student.session.lock") }),
  sessionMutationBase.extend({
    action: z.literal("student.session.reopen.request"),
    reason,
  }),
  z.object({
    action: z.literal("student.session.reopen.decide"),
    requestId: identifier,
    approve: z.boolean(),
    note: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("student.leave.request"),
    studentProfileId: identifier,
    sectionId: identifier,
    startsOn: attendanceDateSchema,
    endsOn: attendanceDateSchema,
    reason,
  }),
  z.object({
    action: z.literal("student.leave.decide"),
    requestId: identifier,
    approve: z.boolean(),
    note: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("status.create"),
    code: z
      .string()
      .trim()
      .regex(/^[A-Z][A-Z0-9_]{1,39}$/),
    name: z.string().trim().min(2).max(80),
    countsAsPresent: z.boolean(),
    presentFraction: z.coerce.number().int().min(0).max(100),
  }),
  z.object({
    action: z.literal("staff.check"),
    staffProfileId: identifier,
    date: attendanceDateSchema,
    checkInAt: staffTimestamp.optional(),
    checkOutAt: staffTimestamp.optional(),
    source: z
      .enum(["MANUAL", "RFID", "BARCODE", "QR_CODE", "BIOMETRIC"])
      .default("MANUAL"),
  }),
  z.object({
    action: z.literal("staff.correction.request"),
    attendanceRecordId: identifier,
    proposedCheckInAt: staffTimestamp.optional(),
    proposedCheckOutAt: staffTimestamp.optional(),
    reason,
  }),
  z.object({
    action: z.literal("staff.correction.decide"),
    requestId: identifier,
    approve: z.boolean(),
    note: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("staff.shift.assign"),
    staffProfileId: identifier,
    shiftId: identifier,
    effectiveFrom: attendanceDateSchema,
    effectiveTo: attendanceDateSchema.optional(),
  }),
  z.object({
    action: z.literal("staff.leave.request"),
    staffProfileId: identifier,
    startsOn: attendanceDateSchema,
    endsOn: attendanceDateSchema,
    leaveType: z.string().trim().min(2).max(60),
    reason,
  }),
  z.object({
    action: z.literal("staff.leave.decide"),
    requestId: identifier,
    approve: z.boolean(),
    note: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("device.event.ingest"),
    deviceId: identifier,
    externalEventId: z.string().trim().min(1).max(150),
    subjectToken: z.string().min(4).max(300),
    occurredAt: staffTimestamp,
    eventKind: z.enum(["CHECK_IN", "CHECK_OUT", "PRESENCE"]),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
]);

export type AttendanceMutation = z.infer<typeof attendanceMutationSchema>;

export function isPreviousDay(date: string, now = new Date()): boolean {
  return date < now.toISOString().slice(0, 10);
}

export function calculateAttendancePercentage(
  fractions: readonly number[],
): number {
  if (!fractions.length) return 0;
  return (
    Math.round(
      (fractions.reduce((total, value) => total + value, 0) /
        (fractions.length * 100)) *
        10_000,
    ) / 100
  );
}

export function consecutiveAbsenceCount(categories: readonly string[]): number {
  let longest = 0;
  let current = 0;
  for (const category of categories) {
    if (category === "ABSENT") {
      current += 1;
      longest = Math.max(longest, current);
    } else current = 0;
  }
  return longest;
}
