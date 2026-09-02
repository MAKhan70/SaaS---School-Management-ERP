import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import {
  dashboardQuerySchema,
  portalPermission,
  resolveDashboardPortal,
  type DashboardListItem,
  type DashboardPortal,
  type DashboardQuery,
  type DashboardSection,
  type DashboardViewModel,
} from "@/modules/dashboards/domain/dashboard-contracts";
import { requirePermission } from "@/server/authorization/authorize";
import { withTenant } from "@/server/database/tenant-context";

const pendingAdmissionStages = [
  "ENQUIRY",
  "CONTACTED",
  "FOLLOW_UP_SCHEDULED",
  "APPLICATION_STARTED",
  "APPLICATION_SUBMITTED",
  "DOCUMENTS_PENDING",
  "UNDER_REVIEW",
  "ASSESSMENT_SCHEDULED",
  "INTERVIEW_SCHEDULED",
  "OFFERED",
  "WAITLISTED",
] as const;

const portalCopy: Record<
  DashboardPortal,
  { heading: string; introduction: string }
> = {
  SCHOOL_ADMIN: {
    heading: "School administrator dashboard",
    introduction:
      "Enrollment, operations, admissions, attendance, and finance in one authorized view.",
  },
  PRINCIPAL: {
    heading: "Principal dashboard",
    introduction:
      "Academic performance, class trends, workload, and approvals for the selected context.",
  },
  TEACHER: {
    heading: "Teacher portal",
    introduction:
      "Your assigned classes, teaching schedule, attendance, gradebook work, and upcoming tasks.",
  },
  STUDENT: {
    heading: "Student portal",
    introduction:
      "Your timetable, attendance, learning work, published results, fees, and announcements.",
  },
  PARENT: {
    heading: "Parent portal",
    introduction: "Authorized information and actions for the selected child.",
  },
  ACCOUNTANT: {
    heading: "Accountant portal",
    introduction:
      "Collections, outstanding balances, approvals, receipts, and reconciliation queues.",
  },
};

const countFormat = new Intl.NumberFormat("en-IN");
const moneyFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function money(minorUnits: number): string {
  return moneyFormat.format(minorUnits / 100);
}

function percentage(numerator: number, denominator: number): string {
  return denominator === 0
    ? "—"
    : `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function dayRange(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00.000+05:30`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

function defaultIndiaDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function section(
  key: string,
  title: string,
  description: string,
  emptyMessage: string,
  items: DashboardListItem[],
): DashboardSection {
  return { key, title, description, emptyMessage, items };
}

function feedItem(item: {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date | null;
  dueAt: Date | null;
  linkHref: string | null;
  kind: string;
}): DashboardListItem {
  const eventTime = item.dueAt ?? item.startsAt;
  return {
    id: item.id,
    title: item.title,
    detail: item.description ?? undefined,
    meta: eventTime ? dateTimeFormat.format(eventTime) : undefined,
    href: item.linkHref ?? undefined,
    status: item.kind.replaceAll("_", " ").toLowerCase(),
  };
}

type ScopedSelection = {
  schoolId: string;
  campusId?: string;
  academicYearId: string;
  gradeClassId?: string;
  sectionId?: string;
};

export class DashboardQueryService {
  constructor(private readonly database: PrismaClient) {}

  async getDashboard(
    context: AuthenticatedContext,
    input: DashboardQuery,
    now = new Date(),
  ): Promise<DashboardViewModel> {
    const query = dashboardQuerySchema.parse(input);
    const portal = resolveDashboardPortal(context.permissionKeys);
    if (!portal) {
      requirePermission(context, "dashboard.admin.read", {
        trustId: context.trustId,
        schoolId: context.schoolId,
      });
      throw new Error("Unreachable permission decision");
    }

    const schoolId = query.schoolId ?? context.schoolId;
    const allowedSchool = context.schools.find(
      (school) => school.id === schoolId,
    );
    if (!allowedSchool) {
      requirePermission(context, portalPermission[portal], {
        trustId: context.trustId,
        schoolId,
      });
      throw new Error("Unreachable school scope decision");
    }
    if (
      query.campusId &&
      !allowedSchool.campuses.some((campus) => campus.id === query.campusId)
    ) {
      requirePermission(context, portalPermission[portal], {
        trustId: context.trustId,
        schoolId,
        campusId: query.campusId,
      });
      throw new Error("Campus does not belong to the selected school context");
    }

    return withTenant(
      this.database,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: crypto.randomUUID(),
      },
      async (transaction) => {
        const academicYears = await transaction.academicYear.findMany({
          where: { trustId: context.trustId, schoolId },
          select: { id: true, name: true, status: true },
          orderBy: { startsOn: "desc" },
        });
        const academicYearId =
          query.academicYearId ??
          academicYears.find((year) => year.status === "ACTIVE")?.id ??
          context.academicYearId;
        if (!academicYears.some((year) => year.id === academicYearId)) {
          requirePermission(context, portalPermission[portal], {
            trustId: context.trustId,
            schoolId,
            campusId: query.campusId,
          });
          throw new Error(
            "Academic year does not belong to the selected school",
          );
        }

        const campuses = allowedSchool.campuses;
        const campusId = query.campusId ?? context.campusId;
        const grades = await transaction.gradeClass.findMany({
          where: {
            trustId: context.trustId,
            schoolId,
            status: "ACTIVE",
            sections: { some: { academicYearId, status: "ACTIVE" } },
          },
          select: { id: true, name: true },
          orderBy: [{ level: "asc" }, { name: "asc" }],
        });
        const gradeClassId = query.gradeClassId;
        if (
          gradeClassId &&
          !grades.some((grade) => grade.id === gradeClassId)
        ) {
          throw new Error(
            "Grade does not belong to the selected academic context",
          );
        }
        const sections = await transaction.section.findMany({
          where: {
            trustId: context.trustId,
            schoolId,
            academicYearId,
            status: "ACTIVE",
            ...(campusId ? { campusId } : {}),
            ...(gradeClassId ? { gradeClassId } : {}),
          },
          select: {
            id: true,
            name: true,
            gradeClass: { select: { name: true } },
          },
          orderBy: { name: "asc" },
        });
        if (
          query.sectionId &&
          !sections.some((item) => item.id === query.sectionId)
        ) {
          throw new Error(
            "Section does not belong to the selected academic context",
          );
        }

        const selected: ScopedSelection = {
          schoolId,
          campusId,
          academicYearId,
          gradeClassId,
          sectionId: query.sectionId,
        };
        const selectedDate = query.date ?? defaultIndiaDate(now);
        const children = await this.getChildren(
          transaction,
          context,
          selected,
          now,
        );
        const studentProfileId =
          query.studentProfileId ??
          (portal === "STUDENT"
            ? await this.getOwnStudentId(transaction, context, selected)
            : children[0]?.id);

        this.authorizePortal(
          context,
          portal,
          selected,
          studentProfileId,
          children,
        );

        const content = await this.buildPortal(
          transaction,
          context,
          portal,
          selected,
          selectedDate,
          studentProfileId,
          now,
        );
        const latest = content.sourceDates.reduce(
          (current, value) => (value > current ? value : current),
          new Date(0),
        );
        const sourceUpdatedAt = latest.getTime() === 0 ? now : latest;

        return {
          portal,
          ...portalCopy[portal],
          generatedAt: now.toISOString(),
          sourceUpdatedAt: sourceUpdatedAt.toISOString(),
          stale:
            now.getTime() - sourceUpdatedAt.getTime() > 24 * 60 * 60 * 1000,
          selectedDate,
          selectedStudentProfileId: studentProfileId,
          filters: {
            schools: context.schools.map(({ id, name }) => ({ id, name })),
            campuses: campuses.map(({ id, name }) => ({ id, name })),
            academicYears: academicYears.map(({ id, name }) => ({ id, name })),
            grades,
            sections: sections.map((item) => ({
              id: item.id,
              name: `${item.gradeClass.name} · ${item.name}`,
            })),
            children,
            selectedSchoolId: schoolId,
            selectedCampusId: campusId,
            selectedAcademicYearId: academicYearId,
            selectedGradeClassId: gradeClassId,
            selectedSectionId: query.sectionId,
          },
          metrics: content.metrics,
          sections: content.sections,
        };
      },
    );
  }

  private authorizePortal(
    context: AuthenticatedContext,
    portal: DashboardPortal,
    selected: ScopedSelection,
    studentProfileId: string | undefined,
    children: readonly { id: string; personId: string }[],
  ): void {
    const resource: Parameters<typeof requirePermission>[2] = {
      trustId: context.trustId,
      schoolId: selected.schoolId,
      campusId: selected.campusId,
    };
    if (portal === "STUDENT") resource.ownerUserId = context.userId;
    if (portal === "PARENT") {
      const child = children.find((item) => item.id === studentProfileId);
      if (!child) {
        requirePermission(context, portalPermission[portal], {
          ...resource,
          personId: "unlinked-child",
        });
      }
      resource.personId = child?.personId;
    }
    requirePermission(context, portalPermission[portal], resource);
  }

  private async getOwnStudentId(
    transaction: Prisma.TransactionClient,
    context: AuthenticatedContext,
    selected: ScopedSelection,
  ): Promise<string | undefined> {
    const student = await transaction.studentProfile.findFirst({
      where: {
        trustId: context.trustId,
        person: { userId: context.userId },
        enrollments: {
          some: {
            trustId: context.trustId,
            schoolId: selected.schoolId,
            academicYearId: selected.academicYearId,
            status: "ACTIVE",
          },
        },
      },
      select: { id: true },
    });
    return student?.id;
  }

  private async getChildren(
    transaction: Prisma.TransactionClient,
    context: AuthenticatedContext,
    selected: ScopedSelection,
    now: Date,
  ): Promise<{ id: string; name: string; personId: string }[]> {
    const relationships = await transaction.guardianRelationship.findMany({
      where: {
        trustId: context.trustId,
        guardianPerson: { userId: context.userId },
        status: "ACTIVE",
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        studentProfile: {
          enrollments: {
            some: {
              schoolId: selected.schoolId,
              academicYearId: selected.academicYearId,
              status: "ACTIVE",
            },
          },
        },
      },
      select: {
        studentProfile: {
          select: {
            id: true,
            personId: true,
            person: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { priority: "asc" }],
    });
    return relationships.map(({ studentProfile }) => ({
      id: studentProfile.id,
      personId: studentProfile.personId,
      name: `${studentProfile.person.firstName} ${studentProfile.person.lastName ?? ""}`.trim(),
    }));
  }

  private async buildPortal(
    transaction: Prisma.TransactionClient,
    context: AuthenticatedContext,
    portal: DashboardPortal,
    selected: ScopedSelection,
    selectedDate: string,
    studentProfileId: string | undefined,
    now: Date,
  ): Promise<{
    metrics: DashboardViewModel["metrics"];
    sections: DashboardSection[];
    sourceDates: Date[];
  }> {
    if (portal === "TEACHER") {
      return this.teacherPortal(transaction, context, selected, selectedDate);
    }
    if (portal === "STUDENT" || portal === "PARENT") {
      return this.familyPortal(
        transaction,
        portal,
        context,
        selected,
        studentProfileId,
        now,
      );
    }
    if (portal === "ACCOUNTANT") {
      return this.accountantPortal(
        transaction,
        context,
        selected,
        selectedDate,
      );
    }
    return this.leadershipPortal(
      transaction,
      portal,
      context,
      selected,
      selectedDate,
    );
  }

  private async leadershipPortal(
    transaction: Prisma.TransactionClient,
    portal: "SCHOOL_ADMIN" | "PRINCIPAL",
    context: AuthenticatedContext,
    selected: ScopedSelection,
    selectedDate: string,
  ) {
    const { start, end } = dayRange(selectedDate);
    const enrollmentWhere = {
      trustId: context.trustId,
      schoolId: selected.schoolId,
      academicYearId: selected.academicYearId,
      status: "ACTIVE" as const,
      ...(selected.campusId ? { campusId: selected.campusId } : {}),
      ...(selected.sectionId ? { sectionId: selected.sectionId } : {}),
      ...(selected.gradeClassId
        ? { section: { gradeClassId: selected.gradeClassId } }
        : {}),
    };
    const attendanceWhere = {
      trustId: context.trustId,
      schoolId: selected.schoolId,
      academicYearId: selected.academicYearId,
      attendanceDate: { gte: start, lt: end },
      ...(selected.campusId ? { campusId: selected.campusId } : {}),
      ...(selected.sectionId ? { sectionId: selected.sectionId } : {}),
    };
    const feedAudience =
      portal === "SCHOOL_ADMIN" ? "SCHOOL_ADMIN" : "PRINCIPAL";
    const [
      enrollmentCount,
      attendance,
      payments,
      pendingAdmissions,
      activeStaff,
      upcomingExams,
      feeds,
      sectionAttendance,
      pendingAdjustments,
      pendingRefunds,
      workload,
      results,
    ] = await Promise.all([
      transaction.studentEnrollment.count({ where: enrollmentWhere }),
      transaction.studentAttendanceRecord.findMany({
        where: attendanceWhere,
        select: {
          updatedAt: true,
          statusDefinition: { select: { countsAsPresent: true } },
        },
      }),
      transaction.feePayment.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          state: "POSTED",
          paidAt: { gte: start, lt: end },
          ...(selected.campusId ? { campusId: selected.campusId } : {}),
        },
        select: { amountMinor: true, createdAt: true },
      }),
      transaction.admissionApplication.count({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          stage: { in: [...pendingAdmissionStages] },
          ...(selected.campusId ? { campusId: selected.campusId } : {}),
        },
      }),
      transaction.staffAssignment.count({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          status: "ACTIVE",
          effectiveFrom: { lte: start },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
          ...(selected.campusId ? { campusId: selected.campusId } : {}),
        },
      }),
      transaction.examination.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          startsOn: { gte: start },
          archivedAt: null,
          ...(selected.campusId ? { campusId: selected.campusId } : {}),
        },
        select: {
          id: true,
          name: true,
          startsOn: true,
          state: true,
          updatedAt: true,
        },
        orderBy: { startsOn: "asc" },
        take: 6,
      }),
      transaction.dashboardFeedItem.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          audience: { in: [feedAudience, "SHARED"] },
          status: "ACTIVE",
          ...(selected.campusId
            ? { OR: [{ campusId: null }, { campusId: selected.campusId }] }
            : {}),
        },
        orderBy: [{ dueAt: "asc" }, { startsAt: "asc" }],
        take: 8,
      }),
      transaction.studentAttendanceRecord.groupBy({
        by: ["sectionId", "statusDefinitionId"],
        where: attendanceWhere,
        _count: true,
      }),
      transaction.feeAdjustment.count({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          approvalState: "PENDING",
        },
      }),
      transaction.feeRefund.count({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          state: "PENDING",
        },
      }),
      transaction.attendanceTeachingAssignment.groupBy({
        by: ["teacherUserId"],
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          status: "ACTIVE",
          ...(selected.campusId ? { campusId: selected.campusId } : {}),
        },
        _count: true,
        orderBy: { _count: { teacherUserId: "desc" } },
        take: 6,
      }),
      transaction.studentResult.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          state: "PUBLISHED",
          ...(selected.campusId ? { campusId: selected.campusId } : {}),
          ...(selected.sectionId ? { sectionId: selected.sectionId } : {}),
        },
        select: { percentage: true, updatedAt: true },
      }),
    ]);

    const present = attendance.filter(
      (item) => item.statusDefinition.countsAsPresent,
    ).length;
    const collected = payments.reduce((sum, item) => sum + item.amountMinor, 0);
    const academicAverage = results.length
      ? results.reduce((sum, result) => sum + Number(result.percentage), 0) /
        results.length
      : null;
    const metrics =
      portal === "SCHOOL_ADMIN"
        ? [
            {
              key: "enrollment",
              label: "Current enrollment",
              value: countFormat.format(enrollmentCount),
              note: "Active in selected academic year",
            },
            {
              key: "attendance",
              label: "Attendance summary",
              value: percentage(present, attendance.length),
              note: `${countFormat.format(attendance.length)} records on selected date`,
            },
            {
              key: "fees",
              label: "Fee collection",
              value: money(collected),
              note: "Posted on selected date",
            },
            {
              key: "admissions",
              label: "Pending admissions",
              value: countFormat.format(pendingAdmissions),
              note: "Open pipeline stages",
              tone: pendingAdmissions
                ? ("warning" as const)
                : ("positive" as const),
            },
            {
              key: "staff",
              label: "Staff availability",
              value: countFormat.format(activeStaff),
              note: "Active assignments",
            },
            {
              key: "exams",
              label: "Upcoming examinations",
              value: countFormat.format(upcomingExams.length),
              note: "Scheduled from selected date",
            },
          ]
        : [
            {
              key: "performance",
              label: "Academic performance",
              value:
                academicAverage === null
                  ? "—"
                  : `${academicAverage.toFixed(1)}%`,
              note: "Published result average",
            },
            {
              key: "attendance",
              label: "Class attendance",
              value: percentage(present, attendance.length),
              note: "Selected date",
            },
            {
              key: "fees",
              label: "Fee collection overview",
              value: money(collected),
              note: "Posted on selected date",
            },
            {
              key: "risk",
              label: "At-risk indicators",
              value: countFormat.format(
                results.filter((result) => Number(result.percentage) < 40)
                  .length,
              ),
              note: "Published results below 40%",
              tone: "warning" as const,
            },
            {
              key: "workload",
              label: "Teacher workload",
              value: countFormat.format(
                workload.reduce((sum, item) => sum + item._count, 0),
              ),
              note: "Active teaching assignments",
            },
            {
              key: "approvals",
              label: "Pending approvals",
              value: countFormat.format(pendingAdjustments + pendingRefunds),
              note: "Fee adjustments and refunds",
              tone:
                pendingAdjustments + pendingRefunds
                  ? ("warning" as const)
                  : ("positive" as const),
            },
          ];

    const sectionItems = sectionAttendance.map((item) => ({
      id: `${item.sectionId}-${item.statusDefinitionId}`,
      title: `Section ${item.sectionId.slice(-6)}`,
      value: countFormat.format(item._count),
      detail: "Attendance records by status",
    }));
    return {
      metrics,
      sections: [
        section(
          "alerts",
          portal === "PRINCIPAL"
            ? "Pending approvals and alerts"
            : "Operational alerts",
          "Time-sensitive items for the selected school context.",
          "No active alerts.",
          feeds.map(feedItem),
        ),
        section(
          "attendance-comparison",
          "Class attendance comparison",
          "Server-calculated attendance record counts by section and status.",
          "No attendance has been submitted for the selected date.",
          sectionItems,
        ),
        section(
          "examinations",
          "Upcoming examinations",
          "Scheduled assessments in the active academic context.",
          "No upcoming examinations.",
          upcomingExams.map((exam) => ({
            id: exam.id,
            title: exam.name,
            meta: dateTimeFormat.format(exam.startsOn),
            status: exam.state.toLowerCase().replaceAll("_", " "),
          })),
        ),
      ],
      sourceDates: [
        ...attendance.map((item) => item.updatedAt),
        ...payments.map((item) => item.createdAt),
        ...upcomingExams.map((item) => item.updatedAt),
        ...feeds.map((item) => item.updatedAt),
        ...results.map((item) => item.updatedAt),
      ],
    };
  }

  private async teacherPortal(
    transaction: Prisma.TransactionClient,
    context: AuthenticatedContext,
    selected: ScopedSelection,
    selectedDate: string,
  ) {
    const { start, end } = dayRange(selectedDate);
    const assignments = await transaction.attendanceTeachingAssignment.findMany(
      {
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          teacherUserId: context.userId,
          status: "ACTIVE",
          effectiveFrom: { lte: start },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
          ...(selected.campusId ? { campusId: selected.campusId } : {}),
          ...(selected.sectionId ? { sectionId: selected.sectionId } : {}),
        },
        select: {
          id: true,
          updatedAt: true,
          sectionId: true,
          section: {
            select: { name: true, gradeClass: { select: { name: true } } },
          },
          subject: { select: { name: true } },
        },
        orderBy: { section: { name: "asc" } },
      },
    );
    const assignedSectionIds = assignments.map((item) => item.sectionId);
    const [sessions, gradebooks, notes, feeds] = await Promise.all([
      transaction.studentAttendanceSession.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          sectionId: { in: assignedSectionIds },
          attendanceDate: { gte: start, lt: end },
          markedBy: context.userId,
        },
        select: { id: true, sectionId: true, state: true, updatedAt: true },
      }),
      transaction.examinationSubject.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          assignedTeacherUserId: context.userId,
          sectionId: { in: assignedSectionIds },
          status: "ACTIVE",
        },
        select: {
          id: true,
          updatedAt: true,
          subject: { select: { name: true } },
          examination: { select: { name: true } },
          register: { select: { state: true } },
        },
      }),
      transaction.studentNote.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          createdBy: context.userId,
          visibility: "STANDARD",
          archivedAt: null,
        },
        select: {
          id: true,
          createdAt: true,
          studentProfile: { select: { studentNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      transaction.dashboardFeedItem.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          audience: { in: ["TEACHER", "SHARED"] },
          status: "ACTIVE",
          OR: [
            { teacherUserId: context.userId },
            { teacherUserId: null, sectionId: { in: assignedSectionIds } },
          ],
        },
        orderBy: [{ dueAt: "asc" }, { startsAt: "asc" }],
        take: 12,
      }),
    ]);
    const classItems = assignments.map((item) => ({
      id: item.id,
      title: `${item.section.gradeClass.name} · ${item.section.name}`,
      detail: item.subject?.name ?? "Class teacher assignment",
      href: `/attendance?sectionId=${encodeURIComponent(item.sectionId)}`,
    }));
    return {
      metrics: [
        {
          key: "classes",
          label: "Assigned classes",
          value: countFormat.format(assignments.length),
          note: "Effective assignments only",
        },
        {
          key: "attendance",
          label: "Attendance marking",
          value: countFormat.format(sessions.length),
          note: "Sessions submitted on selected date",
        },
        {
          key: "marks",
          label: "Marks entry",
          value: countFormat.format(gradebooks.length),
          note: "Assigned examination subjects",
        },
        {
          key: "notes",
          label: "Student notes",
          value: countFormat.format(notes.length),
          note: "Recent standard-visibility notes",
        },
      ],
      sections: [
        section(
          "classes",
          "Assigned classes",
          "Only effective teaching assignments for your account.",
          "No classes are assigned in this context.",
          classItems,
        ),
        section(
          "schedule",
          "Timetable and lesson plans",
          "Seeded demonstration schedule content, scoped to assigned classes.",
          "No timetable or lesson plans are available.",
          feeds
            .filter((item) => ["TIMETABLE", "LESSON_PLAN"].includes(item.kind))
            .map(feedItem),
        ),
        section(
          "homework",
          "Homework and upcoming tasks",
          "Work due for your assigned classes.",
          "No upcoming work.",
          feeds
            .filter((item) => ["HOMEWORK", "TASK"].includes(item.kind))
            .map(feedItem),
        ),
        section(
          "gradebook",
          "Marks entry",
          "Assigned examination subjects and gradebook state.",
          "No marks-entry work is assigned.",
          gradebooks.map((item) => ({
            id: item.id,
            title: item.examination.name,
            detail: item.subject.name,
            status: item.register?.state.toLowerCase() ?? "not started",
            href: "/examinations",
          })),
        ),
        section(
          "notes",
          "Student notes",
          "Sensitive note bodies are intentionally excluded from the dashboard.",
          "No recent student notes.",
          notes.map((item) => ({
            id: item.id,
            title: `Student ${item.studentProfile.studentNumber}`,
            meta: dateTimeFormat.format(item.createdAt),
            status: "standard visibility",
          })),
        ),
      ],
      sourceDates: [
        ...assignments.map((item) => item.updatedAt),
        ...sessions.map((item) => item.updatedAt),
        ...gradebooks.map((item) => item.updatedAt),
        ...notes.map((item) => item.createdAt),
        ...feeds.map((item) => item.updatedAt),
      ],
    };
  }

  private async familyPortal(
    transaction: Prisma.TransactionClient,
    portal: "STUDENT" | "PARENT",
    context: AuthenticatedContext,
    selected: ScopedSelection,
    studentProfileId: string | undefined,
    now: Date,
  ) {
    if (!studentProfileId) {
      return {
        metrics: [
          {
            key: "attendance",
            label: "Attendance",
            value: "—",
            note: "No active student enrollment",
          },
          {
            key: "results",
            label: "Published results",
            value: "0",
            note: "No student selected",
          },
          {
            key: "fees",
            label: "Fee status",
            value: "—",
            note: "No student selected",
          },
        ],
        sections: [
          section(
            "student",
            "Student information",
            "The portal requires an active, authorized student relationship.",
            "No active student is available in this school and academic year.",
            [],
          ),
        ],
        sourceDates: [now],
      };
    }
    const enrollment = await transaction.studentEnrollment.findFirst({
      where: {
        trustId: context.trustId,
        schoolId: selected.schoolId,
        academicYearId: selected.academicYearId,
        studentProfileId,
        status: "ACTIVE",
        ...(selected.campusId ? { campusId: selected.campusId } : {}),
      },
      select: {
        id: true,
        sectionId: true,
        campusId: true,
        updatedAt: true,
        section: {
          select: { name: true, gradeClass: { select: { name: true } } },
        },
      },
    });
    if (!enrollment)
      throw new Error("Student is not enrolled in the selected context");
    const [
      attendance,
      results,
      assignments,
      allocations,
      payments,
      leaveRequests,
      feeds,
    ] = await Promise.all([
      transaction.studentAttendanceRecord.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          studentProfileId,
        },
        select: {
          updatedAt: true,
          statusDefinition: { select: { countsAsPresent: true } },
        },
      }),
      transaction.studentResult.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          studentProfileId,
          state: "PUBLISHED",
        },
        select: {
          id: true,
          percentage: true,
          gradeCode: true,
          updatedAt: true,
          examination: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      transaction.studentFeeAssignment.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          studentProfileId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          amountMinor: true,
          description: true,
          dueOn: true,
          updatedAt: true,
        },
        orderBy: { dueOn: "asc" },
      }),
      transaction.feePaymentAllocation.groupBy({
        by: ["assignmentId"],
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          assignment: { studentProfileId },
          payment: { state: "POSTED" },
        },
        _sum: { amountMinor: true },
      }),
      transaction.feePayment.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          studentProfileId,
          state: "POSTED",
        },
        select: {
          id: true,
          amountMinor: true,
          paidAt: true,
          createdAt: true,
          receipt: { select: { receiptNumber: true } },
        },
        orderBy: { paidAt: "desc" },
        take: 5,
      }),
      transaction.studentLeaveRequest.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          studentProfileId,
        },
        select: {
          id: true,
          startsOn: true,
          endsOn: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { startsOn: "desc" },
        take: 5,
      }),
      transaction.dashboardFeedItem.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          status: "ACTIVE",
          audience: { in: [portal, "SHARED"] },
          OR: [
            { studentProfileId },
            { studentProfileId: null, sectionId: enrollment.sectionId },
            { studentProfileId: null, sectionId: null },
          ],
        },
        orderBy: [{ dueAt: "asc" }, { startsAt: "asc" }],
        take: 16,
      }),
    ]);
    const paidByAssignment = new Map(
      allocations.map((item) => [
        item.assignmentId,
        item._sum.amountMinor ?? 0,
      ]),
    );
    const outstanding = assignments.reduce(
      (sum, item) =>
        sum +
        Math.max(0, item.amountMinor - (paidByAssignment.get(item.id) ?? 0)),
      0,
    );
    const present = attendance.filter(
      (item) => item.statusDefinition.countsAsPresent,
    ).length;
    const upcomingExamFeeds = feeds.filter(
      (item) =>
        item.kind === "TASK" && item.title.toLowerCase().includes("exam"),
    );
    return {
      metrics: [
        {
          key: "attendance",
          label: "Attendance",
          value: percentage(present, attendance.length),
          note: `${countFormat.format(attendance.length)} recorded sessions`,
        },
        {
          key: "homework",
          label: "Homework",
          value: countFormat.format(
            feeds.filter((item) => item.kind === "HOMEWORK").length,
          ),
          note: "Visible assignments",
        },
        {
          key: "results",
          label: "Published results",
          value: countFormat.format(results.length),
          note: "Unpublished results are excluded",
        },
        {
          key: "fees",
          label: "Fee status",
          value: money(outstanding),
          note: "Outstanding assigned fees",
        },
      ],
      sections: [
        section(
          "timetable",
          "Timetable",
          `${enrollment.section.gradeClass.name} · ${enrollment.section.name}`,
          "No timetable entries are available.",
          feeds.filter((item) => item.kind === "TIMETABLE").map(feedItem),
        ),
        section(
          "homework",
          "Homework and learning resources",
          "Class-scoped learning items for the selected student.",
          "No homework or learning resources are available.",
          feeds
            .filter((item) =>
              ["HOMEWORK", "LEARNING_RESOURCE"].includes(item.kind),
            )
            .map(feedItem),
        ),
        section(
          "examinations",
          "Examination schedule",
          "Upcoming examination reminders.",
          "No upcoming examination reminders.",
          upcomingExamFeeds.map(feedItem),
        ),
        section(
          "results",
          "Published results",
          "Only published result snapshots are shown.",
          "No results have been published.",
          results.map((result) => ({
            id: result.id,
            title: result.examination.name,
            value: `${Number(result.percentage).toFixed(1)}%`,
            detail: result.gradeCode ? `Grade ${result.gradeCode}` : undefined,
            meta: dateTimeFormat.format(result.updatedAt),
          })),
        ),
        section(
          "fees",
          "Fee ledger and payment",
          "Posted payments and current outstanding items.",
          "No fee assignments are available.",
          assignments.map((item) => ({
            id: item.id,
            title: item.description,
            value: money(
              Math.max(
                0,
                item.amountMinor - (paidByAssignment.get(item.id) ?? 0),
              ),
            ),
            meta: `Due ${dateTimeFormat.format(item.dueOn)}`,
            href: "/fees",
            status: "payment available where permitted",
          })),
        ),
        section(
          "announcements",
          "Announcements",
          "School and class announcements.",
          "No announcements are available.",
          feeds.filter((item) => item.kind === "ANNOUNCEMENT").map(feedItem),
        ),
        ...(portal === "PARENT"
          ? [
              section(
                "leave",
                "Leave requests",
                "Recent requests for the selected child.",
                "No leave requests.",
                leaveRequests.map((item) => ({
                  id: item.id,
                  title: `${dateTimeFormat.format(item.startsOn)} to ${dateTimeFormat.format(item.endsOn)}`,
                  status: item.status.toLowerCase(),
                })),
              ),
              section(
                "meetings",
                "Teacher meeting requests",
                "Requests scoped to the selected child.",
                "No meeting requests.",
                feeds
                  .filter((item) => item.kind === "TEACHER_MEETING")
                  .map(feedItem),
              ),
            ]
          : []),
      ],
      sourceDates: [
        enrollment.updatedAt,
        ...attendance.map((item) => item.updatedAt),
        ...results.map((item) => item.updatedAt),
        ...assignments.map((item) => item.updatedAt),
        ...payments.map((item) => item.createdAt),
        ...leaveRequests.map((item) => item.updatedAt),
        ...feeds.map((item) => item.updatedAt),
      ],
    };
  }

  private async accountantPortal(
    transaction: Prisma.TransactionClient,
    context: AuthenticatedContext,
    selected: ScopedSelection,
    selectedDate: string,
  ) {
    const { start, end } = dayRange(selectedDate);
    const [
      payments,
      assignments,
      allocations,
      gatewayEvents,
      refunds,
      concessions,
      receipts,
      feeds,
    ] = await Promise.all([
      transaction.feePayment.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          state: "POSTED",
          paidAt: { gte: start, lt: end },
          ...(selected.campusId ? { campusId: selected.campusId } : {}),
        },
        select: { id: true, amountMinor: true, method: true, createdAt: true },
      }),
      transaction.studentFeeAssignment.aggregate({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          status: "ACTIVE",
          ...(selected.campusId ? { campusId: selected.campusId } : {}),
        },
        _sum: { amountMinor: true },
      }),
      transaction.feePaymentAllocation.aggregate({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          payment: {
            academicYearId: selected.academicYearId,
            state: "POSTED",
            ...(selected.campusId ? { campusId: selected.campusId } : {}),
          },
        },
        _sum: { amountMinor: true },
      }),
      transaction.paymentGatewayEvent.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          state: "RECEIVED",
        },
        select: { id: true, provider: true, eventType: true, receivedAt: true },
        orderBy: { receivedAt: "asc" },
        take: 6,
      }),
      transaction.feeRefund.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          state: "PENDING",
        },
        select: {
          id: true,
          amountMinor: true,
          reason: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 6,
      }),
      transaction.feeAdjustment.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          approvalState: "PENDING",
          kind: { in: ["CONCESSION", "SCHOLARSHIP", "WAIVER"] },
        },
        select: {
          id: true,
          kind: true,
          amountMinor: true,
          reason: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 6,
      }),
      transaction.feeReceipt.findMany({
        where: { trustId: context.trustId, schoolId: selected.schoolId },
        select: {
          id: true,
          receiptNumber: true,
          amountMinor: true,
          finalizedAt: true,
        },
        orderBy: { finalizedAt: "desc" },
        take: 8,
      }),
      transaction.dashboardFeedItem.findMany({
        where: {
          trustId: context.trustId,
          schoolId: selected.schoolId,
          academicYearId: selected.academicYearId,
          audience: { in: ["ACCOUNTANT", "SHARED"] },
          status: "ACTIVE",
        },
        orderBy: [{ dueAt: "asc" }, { startsAt: "asc" }],
        take: 6,
      }),
    ]);
    const collection = payments.reduce(
      (sum, item) => sum + item.amountMinor,
      0,
    );
    const outstanding = Math.max(
      0,
      (assignments._sum.amountMinor ?? 0) - (allocations._sum.amountMinor ?? 0),
    );
    return {
      metrics: [
        {
          key: "collection",
          label: "Daily collections",
          value: money(collection),
          note: `${countFormat.format(payments.length)} posted payments`,
        },
        {
          key: "outstanding",
          label: "Outstanding amounts",
          value: money(outstanding),
          note: "Assigned less posted allocations",
          tone: outstanding ? ("warning" as const) : ("positive" as const),
        },
        {
          key: "reconciliation",
          label: "Payment reconciliation",
          value: countFormat.format(gatewayEvents.length),
          note: "Received gateway events",
        },
        {
          key: "approvals",
          label: "Approval queue",
          value: countFormat.format(refunds.length + concessions.length),
          note: "Refunds and concessions",
        },
      ],
      sections: [
        section(
          "reconciliation",
          "Payment reconciliation",
          "Idempotently received provider events awaiting reconciliation.",
          "No events await reconciliation.",
          gatewayEvents.map((item) => ({
            id: item.id,
            title: item.provider,
            detail: item.eventType,
            meta: dateTimeFormat.format(item.receivedAt),
            status: "received",
          })),
        ),
        section(
          "refunds",
          "Refund requests",
          "Pending refund approvals.",
          "No refund requests are pending.",
          refunds.map((item) => ({
            id: item.id,
            title: item.reason,
            value: money(item.amountMinor),
            meta: dateTimeFormat.format(item.createdAt),
            status: "pending",
          })),
        ),
        section(
          "concessions",
          "Concession approvals",
          "Concessions, scholarships, and waivers awaiting a decision.",
          "No concession approvals are pending.",
          concessions.map((item) => ({
            id: item.id,
            title: item.reason,
            detail: item.kind.toLowerCase(),
            value: money(item.amountMinor),
            status: "pending",
          })),
        ),
        section(
          "receipts",
          "Receipt search",
          "Most recently finalized receipts.",
          "No receipts are available.",
          receipts.map((item) => ({
            id: item.id,
            title: item.receiptNumber,
            value: money(item.amountMinor),
            meta: dateTimeFormat.format(item.finalizedAt),
            href: "/fees",
          })),
        ),
        section(
          "tasks",
          "Upcoming finance tasks",
          "School-scoped operational reminders.",
          "No upcoming finance tasks.",
          feeds.map(feedItem),
        ),
      ],
      sourceDates: [
        ...payments.map((item) => item.createdAt),
        ...gatewayEvents.map((item) => item.receivedAt),
        ...refunds.map((item) => item.updatedAt),
        ...concessions.map((item) => item.updatedAt),
        ...receipts.map((item) => item.finalizedAt),
        ...feeds.map((item) => item.updatedAt),
      ],
    };
  }
}
