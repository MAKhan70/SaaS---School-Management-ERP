import type { PrismaClient } from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import {
  analyticsQuerySchema,
  type AnalyticsPoint,
  type AnalyticsQuery,
  type AnalyticsSeries,
  type AnalyticsViewModel,
} from "@/modules/analytics/domain/analytics-contracts";
import { requirePermission } from "@/server/authorization/authorize";
import { withTenant } from "@/server/database/tenant-context";

const day = 86_400_000;
const staleAfter = 24 * 60 * 60 * 1_000;

function startOfDate(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

function endOfDate(value?: string): Date | undefined {
  const start = startOfDate(value);
  return start ? new Date(start.getTime() + day) : undefined;
}

function monthKey(value: Date): string {
  return value.toISOString().slice(0, 7);
}

function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}-01T00:00:00.000Z`));
}

function groupedPoints<T>(
  rows: readonly T[],
  keyOf: (row: T) => string,
  valueOf: (row: T) => number,
  labelOf: (key: string) => string = (key) => key,
): AnalyticsPoint[] {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    grouped.set(key, (grouped.get(key) ?? 0) + valueOf(row));
  }
  return [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ key, label: labelOf(key), value }));
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

export class AnalyticsService {
  constructor(private readonly database: PrismaClient) {}

  async dashboard(
    context: AuthenticatedContext,
    input: AnalyticsQuery,
    now = new Date(),
  ): Promise<AnalyticsViewModel> {
    const query = analyticsQuerySchema.parse(input);
    const schoolId = query.schoolId ?? context.schoolId;
    const allowedSchool = context.schools.find(
      (school) => school.id === schoolId,
    );
    requirePermission(context, "analytics.dashboard.read", {
      trustId: context.trustId,
      schoolId,
      campusId: query.campusId,
    });
    if (!allowedSchool) throw new Error("School is outside the active scope");
    if (
      query.campusId &&
      !allowedSchool.campuses.some((campus) => campus.id === query.campusId)
    )
      throw new Error("Campus is outside the active scope");

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
        const academicYearId = query.academicYearId ?? context.academicYearId;
        if (!academicYears.some((year) => year.id === academicYearId))
          throw new Error("Academic year is outside the active school scope");

        const scope = {
          trustId: context.trustId,
          schoolId,
          academicYearId,
          ...(query.campusId ? { campusId: query.campusId } : {}),
        };
        const dateRange = {
          ...(query.from ? { gte: startOfDate(query.from) } : {}),
          ...(query.to ? { lt: endOfDate(query.to) } : {}),
        };
        const today = new Date(
          `${now.toISOString().slice(0, 10)}T00:00:00.000Z`,
        );

        const [
          enrollments,
          admissions,
          attendance,
          results,
          payments,
          feeAssignments,
          teachingAssignments,
          indicators,
          campuses,
        ] = await Promise.all([
          transaction.studentEnrollment.findMany({
            where: {
              ...scope,
              ...(query.sectionId ? { sectionId: query.sectionId } : {}),
              ...(query.gradeClassId
                ? { section: { gradeClassId: query.gradeClassId } }
                : {}),
              ...(query.from || query.to ? { startsOn: dateRange } : {}),
            },
            select: {
              startsOn: true,
              campusId: true,
              status: true,
              updatedAt: true,
            },
          }),
          transaction.admissionApplication.findMany({
            where: {
              ...scope,
              ...(query.from || query.to ? { createdAt: dateRange } : {}),
            },
            select: { stage: true, updatedAt: true },
          }),
          transaction.studentAttendanceRecord.findMany({
            where: {
              ...scope,
              ...(query.sectionId ? { sectionId: query.sectionId } : {}),
              ...(query.from || query.to ? { attendanceDate: dateRange } : {}),
            },
            select: {
              attendanceDate: true,
              campusId: true,
              updatedAt: true,
              statusDefinition: { select: { presentFraction: true } },
            },
          }),
          transaction.studentResult.findMany({
            where: {
              ...scope,
              ...(query.sectionId ? { sectionId: query.sectionId } : {}),
            },
            select: {
              percentage: true,
              updatedAt: true,
              examination: { select: { id: true, name: true } },
            },
          }),
          transaction.feePayment.findMany({
            where: {
              ...scope,
              state: "POSTED",
              ...(query.from || query.to ? { paidAt: dateRange } : {}),
            },
            select: { amountMinor: true, paidAt: true, createdAt: true },
          }),
          transaction.studentFeeAssignment.findMany({
            where: {
              ...scope,
              status: "ACTIVE",
              ...(query.sectionId ? { sectionId: query.sectionId } : {}),
            },
            select: {
              amountMinor: true,
              dueOn: true,
              updatedAt: true,
              allocations: {
                select: {
                  amountMinor: true,
                  payment: { select: { state: true } },
                },
              },
              adjustments: {
                where: { approvalState: "APPROVED" },
                select: { amountMinor: true, direction: true },
              },
            },
          }),
          transaction.attendanceTeachingAssignment.findMany({
            where: {
              ...scope,
              status: "ACTIVE",
              effectiveFrom: { lte: today },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
            },
            select: {
              teacherUserId: true,
              sectionId: true,
              subjectId: true,
              updatedAt: true,
              teacher: {
                select: { profile: { select: { displayName: true } } },
              },
            },
          }),
          transaction.studentSupportIndicator.findMany({
            where: { ...scope },
            select: { status: true, updatedAt: true },
          }),
          transaction.campus.findMany({
            where: { trustId: context.trustId, schoolId, status: "ACTIVE" },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
        ]);

        const admissionCounts = new Map<string, number>();
        for (const row of admissions)
          admissionCounts.set(
            row.stage,
            (admissionCounts.get(row.stage) ?? 0) + 1,
          );

        const attendanceByDate = new Map<
          string,
          { present: number; total: number }
        >();
        for (const row of attendance) {
          const key = row.attendanceDate.toISOString().slice(0, 10);
          const aggregate = attendanceByDate.get(key) ?? {
            present: 0,
            total: 0,
          };
          aggregate.present += row.statusDefinition.presentFraction;
          aggregate.total += 10_000;
          attendanceByDate.set(key, aggregate);
        }

        const resultGroups = new Map<
          string,
          { label: string; total: number; count: number }
        >();
        for (const row of results) {
          const aggregate = resultGroups.get(row.examination.id) ?? {
            label: row.examination.name,
            total: 0,
            count: 0,
          };
          aggregate.total += Number(row.percentage);
          aggregate.count += 1;
          resultGroups.set(row.examination.id, aggregate);
        }

        const outstandingByDueMonth = new Map<string, number>();
        for (const assignment of feeAssignments) {
          const allocated = assignment.allocations.reduce(
            (total, allocation) =>
              total +
              (allocation.payment.state === "POSTED"
                ? allocation.amountMinor
                : 0),
            0,
          );
          const adjusted = assignment.adjustments.reduce(
            (total, adjustment) =>
              total +
              (adjustment.direction === "DEBIT"
                ? adjustment.amountMinor
                : -adjustment.amountMinor),
            assignment.amountMinor,
          );
          const outstanding = Math.max(0, adjusted - allocated);
          const key = monthKey(assignment.dueOn);
          outstandingByDueMonth.set(
            key,
            (outstandingByDueMonth.get(key) ?? 0) + outstanding,
          );
        }

        const workload = new Map<
          string,
          { label: string; assignments: Set<string> }
        >();
        for (const row of teachingAssignments) {
          const aggregate = workload.get(row.teacherUserId) ?? {
            label: row.teacher.profile?.displayName ?? "Assigned teacher",
            assignments: new Set<string>(),
          };
          aggregate.assignments.add(
            `${row.sectionId}:${row.subjectId ?? "CLASS"}`,
          );
          workload.set(row.teacherUserId, aggregate);
        }

        const campusEnrollment = new Map<string, number>();
        const campusAttendance = new Map<
          string,
          { present: number; total: number }
        >();
        for (const row of enrollments)
          if (row.status === "ACTIVE")
            campusEnrollment.set(
              row.campusId,
              (campusEnrollment.get(row.campusId) ?? 0) + 1,
            );
        for (const row of attendance) {
          const aggregate = campusAttendance.get(row.campusId) ?? {
            present: 0,
            total: 0,
          };
          aggregate.present += row.statusDefinition.presentFraction;
          aggregate.total += 10_000;
          campusAttendance.set(row.campusId, aggregate);
        }

        const series: AnalyticsSeries[] = [
          {
            metric: "enrollment",
            title: "Enrollment trends",
            description: "Enrollment starts recorded by month.",
            valueLabel: "Students",
            points: groupedPoints(
              enrollments,
              (row) => monthKey(row.startsOn),
              () => 1,
              monthLabel,
            ),
          },
          {
            metric: "admissions",
            title: "Admission funnel",
            description: "Applications currently in each auditable stage.",
            valueLabel: "Applications",
            points: [...admissionCounts].map(([key, value]) => ({
              key,
              label: titleCase(key),
              value,
            })),
          },
          {
            metric: "attendance",
            title: "Attendance trends",
            description: "Recorded attendance percentage by day.",
            valueLabel: "Percent",
            points: [...attendanceByDate].sort().map(([key, value]) => ({
              key,
              label: key,
              value: value.total
                ? Number(((value.present / value.total) * 100).toFixed(1))
                : 0,
            })),
          },
          {
            metric: "academic-performance",
            title: "Academic performance",
            description: "Average calculated result percentage by examination.",
            valueLabel: "Percent",
            points: [...resultGroups].map(([key, value]) => ({
              key,
              label: value.label,
              value: Number((value.total / value.count).toFixed(1)),
            })),
          },
          {
            metric: "fee-collection",
            title: "Fee collection",
            description: "Posted fee payments by month, shown in rupees.",
            valueLabel: "INR",
            points: groupedPoints(
              payments,
              (row) => monthKey(row.paidAt),
              (row) => row.amountMinor / 100,
              monthLabel,
            ),
          },
          {
            metric: "outstanding-fees",
            title: "Outstanding fees",
            description:
              "Assigned fees less approved credits and allocated payments, by due month.",
            valueLabel: "INR",
            points: [...outstandingByDueMonth].sort().map(([key, value]) => ({
              key,
              label: monthLabel(key),
              value: value / 100,
            })),
          },
          {
            metric: "teacher-workload",
            title: "Teacher workload",
            description:
              "Distinct active class and subject assignments. This is not a performance score.",
            valueLabel: "Assignments",
            points: [...workload].map(([key, value]) => ({
              key,
              label: value.label,
              value: value.assignments.size,
            })),
          },
          {
            metric: "student-support",
            title: "Student support indicators",
            description:
              "Staff-review indicators by review status; indicators are not predictions or decisions.",
            valueLabel: "Indicators",
            points: groupedPoints(
              indicators,
              (row) => row.status,
              () => 1,
              titleCase,
            ),
          },
          {
            metric: "campus-comparison",
            title: "Campus comparison",
            description:
              "Enrollment count and recorded attendance percentage by campus.",
            valueLabel: "Students",
            points: campuses.map((campus) => {
              const recorded = campusAttendance.get(campus.id);
              return {
                key: campus.id,
                label: campus.name,
                value: campusEnrollment.get(campus.id) ?? 0,
                secondaryValue: recorded?.total
                  ? Number(
                      ((recorded.present / recorded.total) * 100).toFixed(1),
                    )
                  : 0,
              };
            }),
          },
        ];

        const updates = [
          ...enrollments.map((row) => row.updatedAt),
          ...admissions.map((row) => row.updatedAt),
          ...attendance.map((row) => row.updatedAt),
          ...results.map((row) => row.updatedAt),
          ...payments.map((row) => row.createdAt),
          ...feeAssignments.map((row) => row.updatedAt),
          ...teachingAssignments.map((row) => row.updatedAt),
          ...indicators.map((row) => row.updatedAt),
        ];
        const sourceUpdatedAt = updates.length
          ? new Date(Math.max(...updates.map((value) => value.getTime())))
          : now;
        const freshness = updates.length
          ? now.getTime() - sourceUpdatedAt.getTime() > staleAfter
            ? "stale"
            : "fresh"
          : "unavailable";

        return {
          generatedAt: now.toISOString(),
          sourceUpdatedAt: sourceUpdatedAt.toISOString(),
          freshness,
          freshnessDescription:
            freshness === "fresh"
              ? "Authoritative sources were updated within the last 24 hours."
              : freshness === "stale"
                ? "The newest contributing source is more than 24 hours old."
                : "No contributing source records are available for this scope.",
          scope,
          filters: {
            schools: context.schools.map(({ id, name }) => ({ id, name })),
            campuses,
            academicYears: academicYears.map(({ id, name }) => ({ id, name })),
          },
          series: query.metric
            ? series.filter((item) => item.metric === query.metric)
            : series,
        };
      },
    );
  }
}
