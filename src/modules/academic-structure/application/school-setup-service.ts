import {
  AuditOutcome,
  BoardConfigurationStatus,
  RecordStatus,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import type { RequestMetadata } from "@/modules/identity/domain/request-security";
import {
  academicYearsOverlap,
  type SchoolSetupMutation,
} from "@/modules/academic-structure/domain/school-setup-contracts";
import { requirePermission } from "@/server/authorization/authorize";
import { withTenant } from "@/server/database/tenant-context";

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function assertRange(startsOn: Date, endsOn: Date): void {
  if (startsOn >= endsOn)
    throw new Error("The end date must follow the start date");
}

function audit(
  transaction: Prisma.TransactionClient,
  context: AuthenticatedContext,
  metadata: RequestMetadata,
  action: string,
  resourceType: string,
  resourceId: string,
  changes: Prisma.InputJsonValue,
  reasonCode?: string,
) {
  return transaction.auditEvent.create({
    data: {
      trustId: context.trustId,
      schoolId: context.schoolId,
      campusId: context.campusId,
      actorUserId: context.userId,
      effectiveActorUserId: context.userId,
      action,
      resourceType,
      resourceId,
      outcome: AuditOutcome.SUCCEEDED,
      correlationId: metadata.correlationId,
      reasonCode,
      changes,
      metadata: {
        ...(metadata.ipHash ? { ipHash: metadata.ipHash } : {}),
        ...(metadata.userAgentHash
          ? { userAgentHash: metadata.userAgentHash }
          : {}),
      },
    },
  });
}

export class SchoolSetupService {
  constructor(private readonly client: PrismaClient) {}

  async overview(context: AuthenticatedContext) {
    requirePermission(context, "academic.structure.manage", {
      trustId: context.trustId,
      schoolId: context.schoolId,
    });
    return withTenant(
      this.client,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: crypto.randomUUID(),
      },
      async (tx) => {
        const schoolWhere = {
          trustId: context.trustId,
          schoolId: context.schoolId,
        };
        const [
          trust,
          school,
          academicYears,
          boards,
          terms,
          grades,
          sections,
          streams,
          departments,
          subjects,
          rooms,
          periods,
          calendarDays,
          workingDayRules,
          gradingScales,
          houses,
          numberingRules,
        ] = await Promise.all([
          tx.trust.findFirstOrThrow({
            where: { id: context.trustId },
            select: {
              id: true,
              name: true,
              defaultLocale: true,
              defaultTimezone: true,
              defaultCurrency: true,
            },
          }),
          tx.school.findFirstOrThrow({
            where: { id: context.schoolId, trustId: context.trustId },
            select: {
              id: true,
              code: true,
              name: true,
              campuses: {
                where: { status: RecordStatus.ACTIVE },
                select: { id: true, code: true, name: true, timezone: true },
                orderBy: { name: "asc" },
              },
            },
          }),
          tx.academicYear.findMany({
            where: {
              trustId: context.trustId,
              OR: [{ schoolId: context.schoolId }, { schoolId: null }],
            },
            orderBy: { startsOn: "desc" },
          }),
          tx.boardConfiguration.findMany({
            where: schoolWhere,
            orderBy: [{ boardType: "asc" }, { version: "desc" }],
          }),
          tx.academicTerm.findMany({
            where: schoolWhere,
            orderBy: [{ academicYearId: "asc" }, { sequence: "asc" }],
          }),
          tx.gradeClass.findMany({
            where: schoolWhere,
            orderBy: [{ level: "asc" }, { name: "asc" }],
          }),
          tx.section.findMany({ where: schoolWhere, orderBy: { name: "asc" } }),
          tx.stream.findMany({ where: schoolWhere, orderBy: { name: "asc" } }),
          tx.department.findMany({
            where: schoolWhere,
            orderBy: { name: "asc" },
          }),
          tx.subject.findMany({ where: schoolWhere, orderBy: { name: "asc" } }),
          tx.room.findMany({ where: schoolWhere, orderBy: { name: "asc" } }),
          tx.period.findMany({
            where: schoolWhere,
            orderBy: [{ academicYearId: "asc" }, { sequence: "asc" }],
          }),
          tx.schoolCalendarDay.findMany({
            where: schoolWhere,
            orderBy: { date: "asc" },
          }),
          tx.workingDayRule.findMany({
            where: schoolWhere,
            orderBy: { weekday: "asc" },
          }),
          tx.gradingScale.findMany({
            where: schoolWhere,
            include: { bands: { orderBy: { sequence: "asc" } } },
            orderBy: [{ code: "asc" }, { version: "desc" }],
          }),
          tx.house.findMany({ where: schoolWhere, orderBy: { name: "asc" } }),
          tx.numberingRule.findMany({
            where: schoolWhere,
            orderBy: [{ entityType: "asc" }, { version: "desc" }],
          }),
        ]);
        return {
          trust,
          school,
          academicYears,
          boards,
          terms,
          grades,
          sections,
          streams,
          departments,
          subjects,
          rooms,
          periods,
          calendarDays,
          workingDayRules,
          gradingScales,
          houses,
          numberingRules,
        };
      },
    );
  }

  async mutate(
    context: AuthenticatedContext,
    input: SchoolSetupMutation,
    metadata: RequestMetadata,
  ) {
    const permission =
      input.action === "profile.update"
        ? "institutions.school.manage"
        : "academic.structure.manage";
    const requestedCampusId =
      input.action === "section.create" || input.action === "room.create"
        ? input.campusId
        : input.action === "period.create" || input.action === "calendar.create"
          ? input.campusId
          : input.action === "profile.update" && input.resource === "campus"
            ? input.resourceId
            : undefined;
    requirePermission(context, permission, {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(requestedCampusId ? { campusId: requestedCampusId } : {}),
    });
    return withTenant(
      this.client,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      async (tx) => {
        const result = await this.apply(tx, context, input);
        await audit(
          tx,
          context,
          metadata,
          input.action,
          result.resourceType,
          result.id,
          result.changes,
          input.action === "configuration.archive" ? input.reason : undefined,
        );
        return result;
      },
    );
  }

  private async apply(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    input: SchoolSetupMutation,
  ): Promise<{
    id: string;
    resourceType: string;
    changes: Prisma.InputJsonValue;
  }> {
    const scope = { trustId: context.trustId, schoolId: context.schoolId };
    if (input.action === "profile.update") {
      if (input.resource === "trust") {
        requirePermission(context, "institutions.trust.manage", {
          trustId: context.trustId,
        });
        if (input.resourceId !== context.trustId)
          throw new Error("Resource is outside active trust");
        const row = await tx.trust.update({
          where: { id: context.trustId },
          data: {
            name: input.name,
            defaultLocale: input.defaultLocale,
            defaultTimezone: input.defaultTimezone,
            defaultCurrency: input.defaultCurrency,
          },
        });
        return {
          id: row.id,
          resourceType: "Trust",
          changes: {
            name: input.name,
            ...(input.defaultLocale
              ? { defaultLocale: input.defaultLocale }
              : {}),
            ...(input.defaultTimezone
              ? { defaultTimezone: input.defaultTimezone }
              : {}),
            ...(input.defaultCurrency
              ? { defaultCurrency: input.defaultCurrency }
              : {}),
          },
        };
      }
      if (input.resource === "school") {
        if (input.resourceId !== context.schoolId)
          throw new Error("Resource is outside active school");
        const row = await tx.school.update({
          where: {
            trustId_id: { trustId: context.trustId, id: input.resourceId },
          },
          data: { name: input.name, code: input.code },
        });
        return {
          id: row.id,
          resourceType: "School",
          changes: {
            name: input.name,
            ...(input.code ? { code: input.code } : {}),
          },
        };
      }
      if (context.campusId && input.resourceId !== context.campusId)
        throw new Error("Resource is outside active campus");
      const row = await tx.campus.update({
        where: { trustId_schoolId_id: { ...scope, id: input.resourceId } },
        data: { name: input.name, code: input.code, timezone: input.timezone },
      });
      return {
        id: row.id,
        resourceType: "Campus",
        changes: {
          name: input.name,
          ...(input.code ? { code: input.code } : {}),
          ...(input.timezone ? { timezone: input.timezone } : {}),
        },
      };
    }
    if (
      input.action === "academicYear.create" ||
      input.action === "academicYear.copy"
    ) {
      const startsOn = dateOnly(input.startsOn);
      const endsOn = dateOnly(input.endsOn);
      assertRange(startsOn, endsOn);
      const becomesActive =
        input.action === "academicYear.create" && input.status === "ACTIVE";
      const active = becomesActive
        ? await tx.academicYear.findMany({
            where: { ...scope, status: "ACTIVE" },
            select: { startsOn: true, endsOn: true },
          })
        : [];
      if (
        active.some((year) => academicYearsOverlap(year, { startsOn, endsOn }))
      )
        throw new Error("An active academic year already overlaps these dates");
      const year = await tx.academicYear.create({
        data: {
          ...scope,
          code: input.code,
          name: input.name,
          startsOn,
          endsOn,
          status:
            input.action === "academicYear.create" ? input.status : "PLANNED",
          ...(input.action === "academicYear.copy"
            ? { copiedFromId: input.sourceAcademicYearId }
            : {}),
        },
      });
      if (input.action === "academicYear.copy")
        await this.copyYearConfiguration(
          tx,
          context,
          input.sourceAcademicYearId,
          year.id,
        );
      return {
        id: year.id,
        resourceType: "AcademicYear",
        changes: {
          code: year.code,
          status: year.status,
          ...(year.copiedFromId ? { copiedFromId: year.copiedFromId } : {}),
        },
      };
    }
    if (input.action === "board.createVersion") {
      const latest = await tx.boardConfiguration.aggregate({
        where: { ...scope, boardType: input.boardType },
        _max: { version: true },
      });
      const row = await tx.boardConfiguration.create({
        data: {
          ...scope,
          boardType: input.boardType,
          stateCode: input.stateCode,
          name: input.name,
          version: (latest._max.version ?? 0) + 1,
          rules: input.rules as Prisma.InputJsonValue,
          effectiveFrom: dateOnly(input.effectiveFrom),
          status: BoardConfigurationStatus.DRAFT,
        },
      });
      return {
        id: row.id,
        resourceType: "BoardConfiguration",
        changes: { version: row.version, boardType: row.boardType },
      };
    }
    if (input.action === "term.create") {
      const year = await this.assertYear(tx, context, input.academicYearId);
      const startsOn = dateOnly(input.startsOn);
      const endsOn = dateOnly(input.endsOn);
      assertRange(startsOn, endsOn);
      if (startsOn < year.startsOn || endsOn > year.endsOn)
        throw new Error("Term dates must fall inside the academic year");
      const row = await tx.academicTerm.create({
        data: {
          ...scope,
          academicYearId: input.academicYearId,
          code: input.code,
          name: input.name,
          sequence: input.sequence,
          startsOn,
          endsOn,
        },
      });
      return {
        id: row.id,
        resourceType: "AcademicTerm",
        changes: { code: row.code, academicYearId: row.academicYearId },
      };
    }
    if (input.action === "catalog.create")
      return this.createCatalog(tx, context, input);
    if (input.action === "section.create") {
      await Promise.all([
        this.assertYear(tx, context, input.academicYearId),
        tx.campus.findFirstOrThrow({ where: { ...scope, id: input.campusId } }),
        tx.gradeClass.findFirstOrThrow({
          where: { ...scope, id: input.gradeClassId },
        }),
      ]);
      const row = await tx.section.create({
        data: {
          ...scope,
          campusId: input.campusId,
          academicYearId: input.academicYearId,
          gradeClassId: input.gradeClassId,
          streamId: input.streamId,
          code: input.code,
          name: input.name,
          capacity: input.capacity,
        },
      });
      return {
        id: row.id,
        resourceType: "Section",
        changes: { code: row.code },
      };
    }
    if (input.action === "room.create") {
      await tx.campus.findFirstOrThrow({
        where: { ...scope, id: input.campusId },
      });
      const row = await tx.room.create({
        data: {
          ...scope,
          campusId: input.campusId,
          code: input.code,
          name: input.name,
          roomType: input.roomType,
          capacity: input.capacity,
        },
      });
      return { id: row.id, resourceType: "Room", changes: { code: row.code } };
    }
    if (input.action === "period.create") {
      if (input.startsMinute >= input.endsMinute)
        throw new Error("Period end must follow its start");
      await this.assertYear(tx, context, input.academicYearId);
      const row = await tx.period.create({
        data: {
          ...scope,
          academicYearId: input.academicYearId,
          campusId: input.campusId,
          code: input.code,
          name: input.name,
          sequence: input.sequence,
          startsMinute: input.startsMinute,
          endsMinute: input.endsMinute,
          isInstruction: input.isInstruction,
        },
      });
      return {
        id: row.id,
        resourceType: "Period",
        changes: { code: row.code },
      };
    }
    if (input.action === "calendar.create") {
      const year = await this.assertYear(tx, context, input.academicYearId);
      const calendarDate = dateOnly(input.date);
      if (calendarDate < year.startsOn || calendarDate > year.endsOn)
        throw new Error("Calendar date must fall inside the academic year");
      const row = await tx.schoolCalendarDay.create({
        data: {
          ...scope,
          academicYearId: input.academicYearId,
          campusId: input.campusId,
          date: calendarDate,
          type: input.type,
          name: input.name,
          description: input.description,
        },
      });
      return {
        id: row.id,
        resourceType: "SchoolCalendarDay",
        changes: { date: input.date, type: row.type },
      };
    }
    if (input.action === "workingDays.replace") {
      await this.assertYear(tx, context, input.academicYearId);
      await tx.workingDayRule.deleteMany({
        where: { ...scope, academicYearId: input.academicYearId },
      });
      await tx.workingDayRule.createMany({
        data: Array.from({ length: 7 }, (_, index) => ({
          ...scope,
          academicYearId: input.academicYearId,
          weekday: index + 1,
          isWorking: input.weekdays.includes(index + 1),
        })),
      });
      return {
        id: input.academicYearId,
        resourceType: "WorkingDayRule",
        changes: { weekdays: input.weekdays },
      };
    }
    if (input.action === "gradingScale.createVersion") {
      const orderedBands = [...input.bands].sort(
        (left, right) => left.minimumValue - right.minimumValue,
      );
      for (const [index, band] of orderedBands.entries()) {
        if (band.minimumValue > band.maximumValue)
          throw new Error("A grading band has an invalid range");
        const previous = orderedBands[index - 1];
        if (previous && band.minimumValue <= previous.maximumValue)
          throw new Error("Grading bands must not overlap");
      }
      const latest = await tx.gradingScale.aggregate({
        where: { ...scope, code: input.code },
        _max: { version: true },
      });
      const row = await tx.gradingScale.create({
        data: {
          ...scope,
          academicYearId: input.academicYearId,
          code: input.code,
          name: input.name,
          version: (latest._max.version ?? 0) + 1,
          effectiveFrom: dateOnly(input.effectiveFrom),
          bands: {
            create: input.bands.map((band, index) => ({
              ...scope,
              ...band,
              sequence: index + 1,
            })),
          },
        },
      });
      return {
        id: row.id,
        resourceType: "GradingScale",
        changes: { code: row.code, version: row.version },
      };
    }
    if (input.action === "numbering.createVersion") {
      const latest = await tx.numberingRule.aggregate({
        where: { ...scope, entityType: input.entityType },
        _max: { version: true },
      });
      const row = await tx.numberingRule.create({
        data: {
          ...scope,
          academicYearId: input.academicYearId,
          entityType: input.entityType,
          prefixTemplate: input.prefixTemplate,
          suffixTemplate: input.suffixTemplate,
          padding: input.padding,
          resetPolicy: input.resetPolicy,
          version: (latest._max.version ?? 0) + 1,
          effectiveFrom: dateOnly(input.effectiveFrom),
        },
      });
      return {
        id: row.id,
        resourceType: "NumberingRule",
        changes: { entityType: row.entityType, version: row.version },
      };
    }
    return this.archive(tx, context, input.kind, input.resourceId);
  }

  private async assertYear(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    id: string,
  ) {
    return tx.academicYear.findFirstOrThrow({
      where: {
        id,
        trustId: context.trustId,
        OR: [{ schoolId: context.schoolId }, { schoolId: null }],
      },
    });
  }

  private async createCatalog(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    input: Extract<SchoolSetupMutation, { action: "catalog.create" }>,
  ) {
    const scope = { trustId: context.trustId, schoolId: context.schoolId };
    if (input.kind === "grade") {
      if (!input.boardConfigurationId || input.level === undefined)
        throw new Error("Grade requires a board and level");
      const row = await tx.gradeClass.create({
        data: {
          ...scope,
          boardConfigurationId: input.boardConfigurationId,
          code: input.code,
          name: input.name,
          level: input.level,
        },
      });
      return {
        id: row.id,
        resourceType: "GradeClass",
        changes: { code: row.code },
      };
    }
    if (input.kind === "stream") {
      const row = await tx.stream.create({
        data: { ...scope, code: input.code, name: input.name },
      });
      return {
        id: row.id,
        resourceType: "Stream",
        changes: { code: row.code },
      };
    }
    if (input.kind === "department") {
      const row = await tx.department.create({
        data: { ...scope, code: input.code, name: input.name },
      });
      return {
        id: row.id,
        resourceType: "Department",
        changes: { code: row.code },
      };
    }
    if (input.kind === "subject") {
      const row = await tx.subject.create({
        data: {
          ...scope,
          code: input.code,
          name: input.name,
          departmentId: input.departmentId,
        },
      });
      return {
        id: row.id,
        resourceType: "Subject",
        changes: { code: row.code },
      };
    }
    const row = await tx.house.create({
      data: {
        ...scope,
        code: input.code,
        name: input.name,
        colour: input.colour,
      },
    });
    return { id: row.id, resourceType: "House", changes: { code: row.code } };
  }

  private async copyYearConfiguration(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    sourceId: string,
    targetId: string,
  ) {
    const scope = { trustId: context.trustId, schoolId: context.schoolId };
    const [sourceYear, targetYear, terms, rules, periods] = await Promise.all([
      this.assertYear(tx, context, sourceId),
      this.assertYear(tx, context, targetId),
      tx.academicTerm.findMany({
        where: {
          ...scope,
          academicYearId: sourceId,
          status: RecordStatus.ACTIVE,
        },
      }),
      tx.workingDayRule.findMany({
        where: {
          ...scope,
          academicYearId: sourceId,
          status: RecordStatus.ACTIVE,
        },
      }),
      tx.period.findMany({
        where: {
          ...scope,
          academicYearId: sourceId,
          status: RecordStatus.ACTIVE,
        },
      }),
    ]);
    const shift = targetYear.startsOn.getTime() - sourceYear.startsOn.getTime();
    await Promise.all([
      terms.length
        ? tx.academicTerm.createMany({
            data: terms.map((term) => ({
              trustId: term.trustId,
              schoolId: term.schoolId,
              academicYearId: targetId,
              code: term.code,
              name: term.name,
              sequence: term.sequence,
              startsOn: new Date(term.startsOn.getTime() + shift),
              endsOn: new Date(term.endsOn.getTime() + shift),
              status: term.status,
            })),
          })
        : Promise.resolve(),
      rules.length
        ? tx.workingDayRule.createMany({
            data: rules.map((rule) => ({
              trustId: rule.trustId,
              schoolId: rule.schoolId,
              academicYearId: targetId,
              weekday: rule.weekday,
              isWorking: rule.isWorking,
              status: rule.status,
            })),
          })
        : Promise.resolve(),
      periods.length
        ? tx.period.createMany({
            data: periods.map((period) => ({
              trustId: period.trustId,
              schoolId: period.schoolId,
              academicYearId: targetId,
              campusId: period.campusId,
              code: period.code,
              name: period.name,
              sequence: period.sequence,
              startsMinute: period.startsMinute,
              endsMinute: period.endsMinute,
              isInstruction: period.isInstruction,
              status: period.status,
            })),
          })
        : Promise.resolve(),
    ]);
  }

  private async archive(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    kind: Extract<
      SchoolSetupMutation,
      { action: "configuration.archive" }
    >["kind"],
    id: string,
  ) {
    const where = { trustId: context.trustId, schoolId: context.schoolId, id };
    const archivedAt = new Date();
    if (kind === "academicYear") {
      const year = await tx.academicYear.findFirstOrThrow({
        where: {
          trustId: context.trustId,
          id,
          OR: [{ schoolId: context.schoolId }, { schoolId: null }],
        },
        select: { id: true },
      });
      await tx.academicYear.update({
        where: { trustId_id: { trustId: context.trustId, id: year.id } },
        data: { status: "ARCHIVED", archivedAt },
      });
    } else if (kind === "term")
      await tx.academicTerm.update({
        where: {
          id: (
            await tx.academicTerm.findFirstOrThrow({
              where,
              select: { id: true },
            })
          ).id,
        },
        data: { status: RecordStatus.ARCHIVED, archivedAt },
      });
    else if (kind === "board")
      await tx.boardConfiguration.update({
        where: { trustId_schoolId_id: { ...where } },
        data: { status: "RETIRED", archivedAt },
      });
    else if (kind === "grade")
      await tx.gradeClass.update({
        where: { trustId_schoolId_id: { ...where } },
        data: { status: RecordStatus.ARCHIVED, archivedAt },
      });
    else if (kind === "section")
      await tx.section.update({
        where: {
          id: (
            await tx.section.findFirstOrThrow({ where, select: { id: true } })
          ).id,
        },
        data: { status: RecordStatus.ARCHIVED, archivedAt },
      });
    else if (kind === "stream")
      await tx.stream.update({
        where: { trustId_schoolId_id: { ...where } },
        data: { status: RecordStatus.ARCHIVED, archivedAt },
      });
    else if (kind === "department")
      await tx.department.update({
        where: { trustId_schoolId_id: { ...where } },
        data: { status: RecordStatus.ARCHIVED, archivedAt },
      });
    else if (kind === "subject")
      await tx.subject.update({
        where: { trustId_schoolId_id: { ...where } },
        data: { status: RecordStatus.ARCHIVED, archivedAt },
      });
    else if (kind === "room")
      await tx.room.update({
        where: {
          id: (await tx.room.findFirstOrThrow({ where, select: { id: true } }))
            .id,
        },
        data: { status: RecordStatus.ARCHIVED, archivedAt },
      });
    else if (kind === "period")
      await tx.period.update({
        where: {
          id: (
            await tx.period.findFirstOrThrow({ where, select: { id: true } })
          ).id,
        },
        data: { status: RecordStatus.ARCHIVED, archivedAt },
      });
    else if (kind === "calendar")
      await tx.schoolCalendarDay.update({
        where: {
          id: (
            await tx.schoolCalendarDay.findFirstOrThrow({
              where,
              select: { id: true },
            })
          ).id,
        },
        data: { status: RecordStatus.ARCHIVED, archivedAt },
      });
    else if (kind === "gradingScale")
      await tx.gradingScale.update({
        where: { trustId_schoolId_id: { ...where } },
        data: { status: "RETIRED", archivedAt },
      });
    else if (kind === "house")
      await tx.house.update({
        where: { trustId_schoolId_id: { ...where } },
        data: { status: RecordStatus.ARCHIVED, archivedAt },
      });
    else
      await tx.numberingRule.update({
        where: {
          id: (
            await tx.numberingRule.findFirstOrThrow({
              where,
              select: { id: true },
            })
          ).id,
        },
        data: { status: RecordStatus.ARCHIVED, archivedAt },
      });
    return { id, resourceType: kind, changes: { status: "ARCHIVED" } };
  }
}
