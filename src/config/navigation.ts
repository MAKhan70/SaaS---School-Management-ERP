import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import {
  BookOpen,
  Boxes,
  BusFront,
  CalendarCheck2,
  ChartNoAxesCombined,
  ClipboardCheck,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  Library,
  ReceiptIndianRupee,
  School,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";

export interface NavigationItem {
  label: string;
  href?: Route;
  icon: LucideIcon;
  permission: string;
  status?: "planned";
}

export const navigation: readonly NavigationItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "platform.dashboard.read",
  },
  {
    label: "Institutions",
    icon: School,
    permission: "institutions.school.manage",
    status: "planned",
  },
  {
    label: "Students",
    href: "/students" as Route,
    icon: GraduationCap,
    permission: "students.profile.read",
  },
  {
    label: "Admissions",
    href: "/admissions" as Route,
    icon: UserRoundPlus,
    permission: "admissions.crm.read",
  },
  {
    label: "Staff & HR",
    icon: UsersRound,
    permission: "hr.staff.manage",
    status: "planned",
  },
  {
    label: "Attendance",
    href: "/attendance" as Route,
    icon: CalendarCheck2,
    permission: "attendance.session.read",
  },
  {
    label: "Fees",
    href: "/fees" as Route,
    icon: ReceiptIndianRupee,
    permission: "finance.fees.read",
  },
  {
    label: "Academics",
    href: "/school-setup" as Route,
    icon: BookOpen,
    permission: "academic.structure.manage",
  },
  {
    label: "Examinations",
    href: "/examinations" as Route,
    icon: ClipboardCheck,
    permission: "assessments.workspace.read",
  },
  {
    label: "Operations",
    href: "/operations" as Route,
    icon: Boxes,
    permission: "operations.portfolio.read",
  },
  {
    label: "Analytics",
    href: "/analytics" as Route,
    icon: ChartNoAxesCombined,
    permission: "analytics.dashboard.read",
  },
  {
    label: "Library",
    icon: Library,
    permission: "library.circulation.manage",
    status: "planned",
  },
  {
    label: "Transport",
    icon: BusFront,
    permission: "transport.operations.manage",
    status: "planned",
  },
  {
    label: "Health centre",
    icon: HeartPulse,
    permission: "health.records.read",
    status: "planned",
  },
];

export function navigationForPermissions(
  permissionKeys: readonly string[],
): readonly NavigationItem[] {
  const granted = new Set(permissionKeys);
  return navigation.filter((item) => granted.has(item.permission));
}
