import { parseServerEnv } from "@/lib/env";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY =
  /(?:authorization|cookie|password|token|secret|aadhaar|medical|health|credential|encryption.?key|email|phone|address|birth|student|person|payload|input|output|body|answers?|notes?)/i;

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";
export type LogFields = Readonly<Record<string, unknown>>;

function sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return { name: value.name };
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : sanitize(item, seen),
    ]),
  );
}

export function createLogEntry(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
  now = new Date(),
): Record<string, unknown> {
  const sanitizedFields = sanitize(fields);
  return {
    timestamp: now.toISOString(),
    level,
    service: "nasaq-web",
    event,
    ...(sanitizedFields && typeof sanitizedFields === "object"
      ? sanitizedFields
      : {}),
  };
}

const levels: readonly LogLevel[] = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
];

function shouldLog(level: LogLevel): boolean {
  const configured = parseServerEnv(process.env).LOG_LEVEL;
  return levels.indexOf(level) <= levels.indexOf(configured);
}

export function log(level: LogLevel, event: string, fields: LogFields = {}) {
  if (!shouldLog(level)) return;
  const line = JSON.stringify(createLogEntry(level, event, fields));
  if (level === "fatal" || level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
