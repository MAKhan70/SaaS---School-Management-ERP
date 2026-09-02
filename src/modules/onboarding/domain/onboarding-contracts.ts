import { BoardType } from "@/generated/prisma";
import { passwordSchema } from "@/modules/identity/domain/auth-contracts";
import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(/^[A-Z0-9-]+$/);

export const tenantOnboardingSchema = z
  .object({
    trustName: z.string().trim().min(3).max(120),
    trustSlug: z
      .string()
      .trim()
      .min(3)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    schoolName: z.string().trim().min(3).max(120),
    schoolCode: codeSchema,
    campusName: z.string().trim().min(3).max(120),
    campusCode: codeSchema,
    academicYearName: z.string().trim().min(4).max(40),
    academicYearCode: codeSchema,
    academicYearStartsOn: z.coerce.date(),
    academicYearEndsOn: z.coerce.date(),
    boardType: z.enum(BoardType),
    administratorName: z.string().trim().min(2).max(100),
    administratorEmail: z
      .email()
      .transform((value) => value.trim().toLowerCase()),
    administratorPassword: passwordSchema,
    staffEmails: z
      .array(z.email().transform((value) => value.trim().toLowerCase()))
      .max(10)
      .default([]),
  })
  .refine((input) => input.academicYearStartsOn < input.academicYearEndsOn, {
    message: "Academic year end date must be after its start date",
    path: ["academicYearEndsOn"],
  });

export type TenantOnboardingInput = z.infer<typeof tenantOnboardingSchema>;
