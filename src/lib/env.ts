import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_TIMEZONE: z.string().default("Asia/Kolkata"),
  APP_ORIGIN: z.url().optional(),
  DATABASE_URL: z.url().startsWith("postgresql://").optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  values: Record<string, string | undefined>,
): ServerEnv {
  return serverEnvSchema.parse(values);
}

export function assertProductionEnv(
  values: Record<string, string | undefined>,
): ServerEnv {
  const parsed = parseServerEnv(values);
  if (parsed.NODE_ENV === "production") {
    if (!parsed.APP_ORIGIN?.startsWith("https://")) {
      throw new Error("APP_ORIGIN must use HTTPS in production");
    }
    if (!parsed.DATABASE_URL || !parsed.AUTH_SECRET) {
      throw new Error(
        "DATABASE_URL and AUTH_SECRET are required in production",
      );
    }
  }
  return parsed;
}
