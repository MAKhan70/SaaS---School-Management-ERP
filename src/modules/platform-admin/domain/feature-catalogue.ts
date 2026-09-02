export const tenantFeatures = [
  {
    key: "core",
    label: "Core administration",
    prefixes: [
      "platform.",
      "dashboard.",
      "institutions.",
      "memberships.",
      "academic.",
      "profile.",
      "children.",
    ],
  },
  { key: "students", label: "Student information", prefixes: ["students."] },
  { key: "admissions", label: "Admissions CRM", prefixes: ["admissions."] },
  { key: "attendance", label: "Attendance", prefixes: ["attendance."] },
  {
    key: "examinations",
    label: "Examinations and report cards",
    prefixes: ["assessments."],
  },
  { key: "fees", label: "Fee management", prefixes: ["finance."] },
  {
    key: "analytics",
    label: "Analytics and assisted drafts",
    prefixes: ["analytics.", "ai."],
  },
  {
    key: "operations",
    label: "Operational modules",
    prefixes: [
      "operations.",
      "hr.",
      "library.",
      "transport.",
      "hostel.",
      "health.",
      "security.",
      "timetable.",
      "homework.",
      "lesson.",
      "leave.",
      "payroll.",
      "visitors.",
      "reception.",
      "inventory.",
      "certificate.",
      "alumni.",
      "communications.",
      "events.",
      "activities.",
      "discipline.",
      "documents.",
      "support.",
    ],
  },
] as const;

export type TenantFeatureKey = (typeof tenantFeatures)[number]["key"];

export function featureForPermission(
  permissionKey: string,
): TenantFeatureKey | undefined {
  return tenantFeatures.find((feature) =>
    feature.prefixes.some((prefix) => permissionKey.startsWith(prefix)),
  )?.key;
}
