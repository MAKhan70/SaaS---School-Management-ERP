import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("prisma", "migrations");
const entries = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const failures = [];
const seenPrefixes = new Set();
for (const name of entries) {
  const match = /^(\d{14})_[a-z0-9_]+$/.exec(name);
  if (!match) failures.push(`${name}: use YYYYMMDDHHMMSS_snake_case`);
  const prefix = match?.[1];
  if (prefix && seenPrefixes.has(prefix))
    failures.push(`${name}: duplicate timestamp`);
  if (prefix) seenPrefixes.add(prefix);

  const sqlPath = path.join(root, name, "migration.sql");
  const sql = await readFile(sqlPath, "utf8");
  if (!sql.trim()) failures.push(`${name}: migration.sql is empty`);
  if (
    /\b(?:DROP\s+(?:TABLE|COLUMN|TYPE)|TRUNCATE\s+TABLE)\b/i.test(sql) &&
    !sql.includes("migration-check: allow-destructive")
  ) {
    failures.push(
      `${name}: destructive SQL requires an explicit reviewed allow marker`,
    );
  }
}

if (failures.length) {
  console.error(
    [
      "Migration safety check failed:",
      ...failures.map((item) => `- ${item}`),
    ].join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(`Migration safety check passed (${entries.length} migrations).`);
}
