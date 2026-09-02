import { BoardType } from "@/generated/prisma";
import { passwordSchema } from "@/modules/identity/domain/auth-contracts";
import { tenantFeatures } from "@/modules/platform-admin/domain/feature-catalogue";
import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(/^[A-Z0-9-]+$/);
const featureKeys = tenantFeatures.map((feature) => feature.key) as [
  string,
  ...string[],
];

export const clientProvisionSchema = z
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
    administratorFirstName: z.string().trim().min(1).max(60),
    administratorLastName: z.string().trim().min(1).max(60),
    administratorEmail: z
      .email()
      .transform((value) => value.trim().toLowerCase()),
    administratorPhone: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{7,14}$/),
    featureKeys: z.array(z.enum(featureKeys)).min(1).max(tenantFeatures.length),
  })
  .refine((input) => input.academicYearStartsOn < input.academicYearEndsOn, {
    message: "Academic year end date must be after its start date",
    path: ["academicYearEndsOn"],
  });

export const featureUpdateSchema = z.object({
  featureKeys: z.array(z.enum(featureKeys)).min(1).max(tenantFeatures.length),
});

export const supportAccessSchema = z.object({
  reason: z.string().trim().min(10).max(300),
  durationMinutes: z.coerce.number().int().min(5).max(60).default(30),
});

export const invitationAcceptanceSchema = z
  .object({
    trustId: z.string().min(1).max(128),
    token: z.string().min(32).max(512),
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export type ClientProvisionInput = z.infer<typeof clientProvisionSchema>;
