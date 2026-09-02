import { z } from "zod";

const identifier = z.string().min(1).max(100);

export const dashboardQuerySchema = z.object({
  date: z.iso.date().optional(),
  schoolId: identifier.optional(),
  campusId: identifier.optional(),
  academicYearId: identifier.optional(),
  gradeClassId: identifier.optional(),
  sectionId: identifier.optional(),
  studentProfileId: identifier.optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const dashboardPortals = [
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "ACCOUNTANT",
] as const;

export type DashboardPortal = (typeof dashboardPortals)[number];

export const portalPermission = {
  SCHOOL_ADMIN: "dashboard.admin.read",
  PRINCIPAL: "dashboard.principal.read",
  TEACHER: "dashboard.teacher.read",
  STUDENT: "dashboard.student.read",
  PARENT: "dashboard.parent.read",
  ACCOUNTANT: "dashboard.accountant.read",
} as const satisfies Record<DashboardPortal, string>;

const portalPriority: readonly DashboardPortal[] = [
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "ACCOUNTANT",
];

export function resolveDashboardPortal(
  permissionKeys: readonly string[],
): DashboardPortal | null {
  const granted = new Set(permissionKeys);
  return (
    portalPriority.find((portal) => granted.has(portalPermission[portal])) ??
    null
  );
}

export type DashboardMetric = {
  key: string;
  label: string;
  value: string;
  note: string;
  tone?: "default" | "positive" | "warning" | "critical";
};

export type DashboardListItem = {
  id: string;
  title: string;
  detail?: string;
  meta?: string;
  value?: string;
  progressPercent?: number;
  href?: string;
  status?: string;
};

export type DashboardSection = {
  key: string;
  title: string;
  description: string;
  emptyMessage: string;
  items: DashboardListItem[];
};

export type DashboardFilterOption = { id: string; name: string };

export type DashboardViewModel = {
  portal: DashboardPortal;
  heading: string;
  introduction: string;
  generatedAt: string;
  sourceUpdatedAt: string;
  stale: boolean;
  selectedDate: string;
  selectedStudentProfileId?: string;
  filters: {
    schools: DashboardFilterOption[];
    campuses: DashboardFilterOption[];
    academicYears: DashboardFilterOption[];
    grades: DashboardFilterOption[];
    sections: DashboardFilterOption[];
    children: DashboardFilterOption[];
    selectedSchoolId: string;
    selectedCampusId?: string;
    selectedAcademicYearId: string;
    selectedGradeClassId?: string;
    selectedSectionId?: string;
  };
  metrics: DashboardMetric[];
  sections: DashboardSection[];
};
