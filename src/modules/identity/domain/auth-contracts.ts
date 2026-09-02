import { z } from "zod";

const emailSchema = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  returnUrl: z.string().max(2048).optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(256),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const switchContextSchema = z.object({
  trustId: z.string().min(1).max(64),
  schoolId: z.string().min(1).max(64),
  campusId: z.string().min(1).max(64).optional(),
  academicYearId: z.string().min(1).max(64),
});

export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  try {
    const parsed = new URL(value, "https://local.invalid");
    return parsed.origin === "https://local.invalid"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export type SignInInput = z.infer<typeof signInSchema>;
export type SwitchContextInput = z.infer<typeof switchContextSchema>;
