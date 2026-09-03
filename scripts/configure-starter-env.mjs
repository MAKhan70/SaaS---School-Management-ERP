import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");

let contents;
try {
  contents = await readFile(envPath, "utf8");
} catch (error) {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    throw new Error(
      ".env.local is missing. Copy .env.example to .env.local and add DATABASE_URL and DIRECT_DATABASE_URL first.",
    );
  }
  throw error;
}

function hasUsableValue(key) {
  const match = contents.match(new RegExp(`^${key}=(.*)$`, "m"));
  return Boolean(match?.[1]?.trim().replace(/^['\"]|['\"]$/g, ""));
}

function setIfMissing(key, value) {
  if (hasUsableValue(key)) {
    return;
  }

  const serialized = JSON.stringify(value);
  const linePattern = new RegExp(`^${key}=.*$`, "m");
  if (linePattern.test(contents)) {
    contents = contents.replace(linePattern, `${key}=${serialized}`);
    return;
  }

  const separator = contents.endsWith("\n") ? "" : "\n";
  contents += `${separator}${key}=${serialized}\n`;
}

function temporaryPassword() {
  return `${randomBytes(18).toString("base64url")}!Aa1`;
}

setIfMissing("AUTH_SECRET", randomBytes(48).toString("base64url"));
setIfMissing("STUDENT_DATA_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
setIfMissing("PLATFORM_ADMIN_EMAIL", "platform-admin@demo.nasaq.test");
setIfMissing("PLATFORM_ADMIN_NAME", "NASAQ Starter Administrator");
setIfMissing("PLATFORM_ADMIN_PASSWORD", temporaryPassword());
setIfMissing("DEMO_USER_PASSWORD", temporaryPassword());

await writeFile(envPath, contents, { encoding: "utf8", mode: 0o600 });

console.log("Starter-only credentials and application secrets are configured.");
console.log(
  "The private values are stored in .env.local and are ignored by Git.",
);
