import {
  AuditOutcome,
  AuditSensitivity,
  EnrollmentEventType,
  EnrollmentStatus,
  NumberingEntityType,
  RecordStatus,
  StudentAdmissionStatus,
  StudentProfileStatus,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import type { RequestMetadata } from "@/modules/identity/domain/request-security";
import { csvCell } from "@/lib/csv";
import { authorize, requirePermission } from "@/server/authorization/authorize";
import { withTenant } from "@/server/database/tenant-context";

import {
  createStudentSchema,
  duplicateFingerprint,
  normalizedContactHash,
  parseStudentCsv,
  type CreateStudentInput,
  type StudentMutation,
} from "../domain/student-contracts";
import {
  decryptStudentData,
  encryptStudentData,
  maskIdentifier,
} from "../infrastructure/student-data-crypto";

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function audit(
  tx: Prisma.TransactionClient,
  context: AuthenticatedContext,
  metadata: RequestMetadata,
  action: string,
  resourceId: string,
  changes: Prisma.InputJsonValue | undefined,
  sensitivity: AuditSensitivity = AuditSensitivity.STANDARD,
) {
  return tx.auditEvent.create({
    data: {
      trustId: context.trustId,
      schoolId: context.schoolId,
      campusId: context.campusId,
      actorUserId: context.userId,
      effectiveActorUserId: context.userId,
      action,
      resourceType: "StudentProfile",
      resourceId,
      outcome: AuditOutcome.SUCCEEDED,
      sensitivity,
      correlationId: metadata.correlationId,
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

async function scopedStudent(
  tx: Prisma.TransactionClient,
  context: AuthenticatedContext,
  studentId: string,
) {
  return tx.studentProfile.findFirstOrThrow({
    where: {
      id: studentId,
      trustId: context.trustId,
      OR: [
        {
          admissions: {
            some: {
              schoolId: context.schoolId,
              ...(context.campusId ? { campusId: context.campusId } : {}),
            },
          },
        },
        {
          enrollments: {
            some: {
              schoolId: context.schoolId,
              ...(context.campusId ? { campusId: context.campusId } : {}),
            },
          },
        },
      ],
    },
    select: { id: true, personId: true, lifecycleStatus: true, status: true },
  });
}

export class StudentService {
  constructor(private readonly client: PrismaClient) {}

  async directory(
    context: AuthenticatedContext,
    query: {
      search: string;
      status?: string;
      gradeId?: string;
      sectionId?: string;
      houseId?: string;
      page: number;
      pageSize: number;
    },
  ) {
    requirePermission(context, "students.profile.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    });
    return withTenant(
      this.client,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: crypto.randomUUID(),
      },
      async (tx) => {
        const where: Prisma.StudentProfileWhereInput = {
          trustId: context.trustId,
          ...(query.status
            ? { lifecycleStatus: query.status as StudentProfileStatus }
            : {}),
          ...(query.search
            ? {
                OR: [
                  {
                    studentNumber: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                  {
                    person: {
                      firstName: {
                        contains: query.search,
                        mode: "insensitive",
                      },
                    },
                  },
                  {
                    person: {
                      lastName: { contains: query.search, mode: "insensitive" },
                    },
                  },
                  {
                    admissions: {
                      some: {
                        schoolId: context.schoolId,
                        admissionNumber: {
                          contains: query.search,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
          admissions: {
            some: {
              schoolId: context.schoolId,
              ...(context.campusId ? { campusId: context.campusId } : {}),
            },
          },
          ...(query.sectionId || query.gradeId
            ? {
                enrollments: {
                  some: {
                    schoolId: context.schoolId,
                    status: EnrollmentStatus.ACTIVE,
                    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
                    ...(query.gradeId
                      ? { section: { gradeClassId: query.gradeId } }
                      : {}),
                  },
                },
              }
            : {}),
          ...(query.houseId
            ? {
                houseAssignments: {
                  some: {
                    schoolId: context.schoolId,
                    houseId: query.houseId,
                    status: RecordStatus.ACTIVE,
                  },
                },
              }
            : {}),
        };
        const [total, students, grades, sections, houses] = await Promise.all([
          tx.studentProfile.count({ where }),
          tx.studentProfile.findMany({
            where,
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            orderBy: [
              { person: { lastName: "asc" } },
              { person: { firstName: "asc" } },
            ],
            select: {
              id: true,
              studentNumber: true,
              lifecycleStatus: true,
              person: {
                select: {
                  firstName: true,
                  lastName: true,
                  preferredName: true,
                },
              },
              admissions: {
                where: {
                  schoolId: context.schoolId,
                  ...(context.campusId ? { campusId: context.campusId } : {}),
                },
                orderBy: { admittedOn: "desc" },
                take: 1,
                select: { admissionNumber: true },
              },
              enrollments: {
                where: {
                  schoolId: context.schoolId,
                  ...(context.campusId ? { campusId: context.campusId } : {}),
                  status: EnrollmentStatus.ACTIVE,
                },
                take: 1,
                select: {
                  rollNumber: true,
                  campus: { select: { id: true, name: true } },
                  section: {
                    select: {
                      id: true,
                      name: true,
                      gradeClass: { select: { id: true, name: true } },
                    },
                  },
                },
              },
              houseAssignments: {
                where: {
                  schoolId: context.schoolId,
                  ...(context.campusId ? { campusId: context.campusId } : {}),
                  status: RecordStatus.ACTIVE,
                },
                take: 1,
                select: { house: { select: { id: true, name: true } } },
              },
            },
          }),
          tx.gradeClass.findMany({
            where: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              status: RecordStatus.ACTIVE,
            },
            select: { id: true, name: true },
            orderBy: { level: "asc" },
          }),
          tx.section.findMany({
            where: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              ...(context.campusId ? { campusId: context.campusId } : {}),
              status: RecordStatus.ACTIVE,
            },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
          tx.house.findMany({
            where: {
              trustId: context.trustId,
              schoolId: context.schoolId,
              status: RecordStatus.ACTIVE,
            },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
        ]);
        return {
          students,
          filters: { grades, sections, houses },
          pagination: { page: query.page, pageSize: query.pageSize, total },
        };
      },
    );
  }

  async profile(
    context: AuthenticatedContext,
    studentId: string,
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "students.profile.read", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    });
    return withTenant(
      this.client,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      async (tx) => {
        await scopedStudent(tx, context, studentId);
        const canReadSensitive = authorize(context, "students.sensitive.read", {
          trustId: context.trustId,
          schoolId: context.schoolId,
          ...(context.campusId ? { campusId: context.campusId } : {}),
        }).allowed;
        const student = await tx.studentProfile.findFirstOrThrow({
          where: { id: studentId, trustId: context.trustId },
          include: {
            person: {
              include: {
                contacts: { where: { status: RecordStatus.ACTIVE } },
                addresses: { where: { status: RecordStatus.ACTIVE } },
                sensitiveIdentifiers: {
                  where: { archivedAt: null },
                  select: { id: true, type: true, lastFour: true },
                },
              },
            },
            admissions: {
              where: {
                schoolId: context.schoolId,
                ...(context.campusId ? { campusId: context.campusId } : {}),
              },
              orderBy: { admittedOn: "desc" },
              include: {
                campus: { select: { name: true } },
                academicYear: { select: { name: true } },
              },
            },
            guardianRelationships: {
              where: { status: RecordStatus.ACTIVE },
              include: {
                guardianPerson: {
                  include: {
                    contacts: { where: { status: RecordStatus.ACTIVE } },
                  },
                },
              },
              orderBy: { priority: "asc" },
            },
            emergencyContacts: {
              where: {
                schoolId: context.schoolId,
                ...(context.campusId ? { campusId: context.campusId } : {}),
                status: RecordStatus.ACTIVE,
              },
              orderBy: { priority: "asc" },
            },
            enrollments: {
              where: {
                schoolId: context.schoolId,
                ...(context.campusId ? { campusId: context.campusId } : {}),
              },
              orderBy: { startsOn: "desc" },
              include: {
                academicYear: { select: { name: true } },
                campus: { select: { name: true } },
                section: {
                  include: { gradeClass: { select: { name: true } } },
                },
              },
            },
            enrollmentEvents: {
              where: { schoolId: context.schoolId },
              orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
            },
            documents: {
              where: {
                schoolId: context.schoolId,
                ...(context.campusId ? { campusId: context.campusId } : {}),
                archivedAt: null,
              },
              select: {
                id: true,
                type: true,
                displayName: true,
                mimeType: true,
                sizeBytes: true,
                status: true,
                createdAt: true,
              },
            },
            notes: {
              where: {
                schoolId: context.schoolId,
                archivedAt: null,
                ...(canReadSensitive ? {} : { visibility: "STANDARD" }),
              },
              orderBy: { createdAt: "desc" },
            },
            tags: {
              where: { schoolId: context.schoolId },
              include: { tag: true },
            },
            houseAssignments: {
              where: {
                schoolId: context.schoolId,
                ...(context.campusId ? { campusId: context.campusId } : {}),
              },
              include: {
                house: true,
                academicYear: { select: { name: true } },
              },
              orderBy: { startsOn: "desc" },
            },
            identityCards: {
              where: {
                schoolId: context.schoolId,
                ...(context.campusId ? { campusId: context.campusId } : {}),
              },
              orderBy: { createdAt: "desc" },
            },
            ...(canReadSensitive
              ? { sensitiveRecords: { where: { status: RecordStatus.ACTIVE } } }
              : {}),
          },
        });
        const sensitive =
          canReadSensitive && "sensitiveRecords" in student
            ? student.sensitiveRecords.map((record) => ({
                type: record.type,
                value: decryptStudentData(
                  {
                    ciphertext: record.ciphertext,
                    iv: record.iv,
                    authTag: record.authTag,
                    keyVersion: record.keyVersion,
                  },
                  { trustId: context.trustId, studentId, type: record.type },
                ),
              }))
            : undefined;
        await audit(
          tx,
          context,
          metadata,
          "student.profile.read",
          studentId,
          undefined,
          AuditSensitivity.SENSITIVE,
        );
        if (canReadSensitive && sensitive?.length)
          await audit(
            tx,
            context,
            metadata,
            "student.sensitive.read",
            studentId,
            undefined,
            AuditSensitivity.RESTRICTED,
          );
        return {
          ...student,
          person: {
            ...student.person,
            sensitiveIdentifiers: student.person.sensitiveIdentifiers.map(
              (item) => ({
                id: item.id,
                type: item.type,
                maskedValue: maskIdentifier(item.lastFour),
              }),
            ),
          },
          sensitiveAccess: canReadSensitive,
          sensitive,
          sensitiveRecords: undefined,
        };
      },
    );
  }

  async mutate(
    context: AuthenticatedContext,
    input: StudentMutation,
    metadata: RequestMetadata,
  ) {
    const permission = input.action.startsWith("enrollment.")
      ? "students.enrollment.manage"
      : input.action === "guardian.assign"
        ? "students.guardian.manage"
        : input.action === "sensitive.upsert"
          ? "students.sensitive.write"
          : input.action === "document.register"
            ? "students.documents.manage"
            : input.action === "student.archive" ||
                input.action === "student.restore"
              ? "students.lifecycle.manage"
              : "students.profile.write";
    requirePermission(context, permission, {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(input.action === "student.create"
        ? { campusId: input.data.campusId }
        : context.campusId
          ? { campusId: context.campusId }
          : {}),
    });
    return withTenant(
      this.client,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      async (tx) => {
        const result =
          input.action === "student.create"
            ? await this.create(tx, context, input.data)
            : await this.applyMutation(tx, context, input);
        await audit(
          tx,
          context,
          metadata,
          input.action,
          result.id,
          result.changes,
          input.action === "sensitive.upsert"
            ? AuditSensitivity.RESTRICTED
            : AuditSensitivity.STANDARD,
        );
        return result;
      },
    );
  }

  async previewImport(context: AuthenticatedContext, csv: string) {
    requirePermission(context, "students.bulk.import", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    });
    return parseStudentCsv(csv);
  }

  async commitImport(
    context: AuthenticatedContext,
    rows: unknown[],
    metadata: RequestMetadata,
  ) {
    requirePermission(context, "students.bulk.import", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    });
    requirePermission(context, "students.profile.write", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    });
    const inputs = createStudentSchema.array().min(1).max(250).parse(rows);
    return withTenant(
      this.client,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      async (tx) => {
        const created = [];
        for (const input of inputs)
          created.push(await this.create(tx, context, input));
        await audit(
          tx,
          context,
          metadata,
          "student.bulk.import",
          context.schoolId,
          { recordCount: created.length },
          AuditSensitivity.SENSITIVE,
        );
        return {
          imported: created.length,
          studentIds: created.map((item) => item.id),
        };
      },
    );
  }

  async exportCsv(context: AuthenticatedContext, metadata: RequestMetadata) {
    requirePermission(context, "students.data.export", {
      trustId: context.trustId,
      schoolId: context.schoolId,
      ...(context.campusId ? { campusId: context.campusId } : {}),
    });
    const result = await this.directory(context, {
      search: "",
      page: 1,
      pageSize: 100,
    });
    const rows = result.students.map((student) =>
      [
        student.studentNumber,
        student.admissions[0]?.admissionNumber,
        student.person.firstName,
        student.person.lastName,
        student.lifecycleStatus,
        student.enrollments[0]?.section.gradeClass.name,
        student.enrollments[0]?.section.name,
      ]
        .map(csvCell)
        .join(","),
    );
    await withTenant(
      this.client,
      {
        trustId: context.trustId,
        actorUserId: context.userId,
        correlationId: metadata.correlationId,
      },
      (tx) =>
        audit(
          tx,
          context,
          metadata,
          "student.export",
          context.schoolId,
          { recordCount: rows.length },
          AuditSensitivity.RESTRICTED,
        ),
    );
    return [
      "studentNumber,admissionNumber,firstName,lastName,status,grade,section",
      ...rows,
    ].join("\n");
  }

  private async nextAdmissionNumber(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    input: Pick<CreateStudentInput, "academicYearId" | "admissionNumber">,
  ): Promise<string> {
    if (input.admissionNumber) return input.admissionNumber;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const rule = await tx.numberingRule.findFirst({
        where: {
          trustId: context.trustId,
          schoolId: context.schoolId,
          entityType: NumberingEntityType.STUDENT,
          status: RecordStatus.ACTIVE,
          OR: [
            { academicYearId: input.academicYearId },
            { academicYearId: null },
          ],
        },
        orderBy: [{ academicYearId: "desc" }, { version: "desc" }],
      });
      if (!rule)
        throw new Error("Student admission numbering is not configured");
      const claimed = await tx.numberingRule.updateMany({
        where: {
          id: rule.id,
          trustId: context.trustId,
          nextNumber: rule.nextNumber,
        },
        data: { nextNumber: { increment: 1 } },
      });
      if (claimed.count === 1) {
        const school = await tx.school.findFirstOrThrow({
          where: { id: context.schoolId, trustId: context.trustId },
          select: { code: true },
        });
        const year = await tx.academicYear.findFirstOrThrow({
          where: { id: input.academicYearId, trustId: context.trustId },
          select: { code: true },
        });
        const number = String(rule.nextNumber).padStart(rule.padding, "0");
        const render = (template: string) =>
          template
            .replaceAll("{SCHOOL}", school.code)
            .replaceAll("{YEAR}", year.code)
            .replaceAll("{NUMBER}", number);
        return `${render(rule.prefixTemplate)}${number}${rule.suffixTemplate ? render(rule.suffixTemplate) : ""}`;
      }
    }
    throw new Error("Could not reserve an admission number");
  }

  private async create(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    raw: CreateStudentInput,
  ) {
    const input = createStudentSchema.parse(raw);
    const section = input.sectionId
      ? await tx.section.findFirstOrThrow({
          where: {
            id: input.sectionId,
            trustId: context.trustId,
            schoolId: context.schoolId,
            campusId: input.campusId,
            academicYearId: input.academicYearId,
            status: RecordStatus.ACTIVE,
          },
        })
      : undefined;
    await tx.campus.findFirstOrThrow({
      where: {
        id: input.campusId,
        trustId: context.trustId,
        schoolId: context.schoolId,
        status: RecordStatus.ACTIVE,
      },
    });
    const fingerprint = duplicateFingerprint(input);
    const contactHashes = [input.phone, input.email]
      .filter((value): value is string => Boolean(value))
      .map(normalizedContactHash);
    const candidates = await tx.studentProfile.findMany({
      where: {
        trustId: context.trustId,
        person: {
          OR: [
            { dateOfBirth: dateOnly(input.dateOfBirth) },
            ...(contactHashes.length
              ? [
                  {
                    contacts: {
                      some: { normalizedHash: { in: contactHashes } },
                    },
                  },
                ]
              : []),
          ],
        },
        admissions: { some: { schoolId: context.schoolId } },
      },
      include: { person: { include: { contacts: true } } },
      take: 20,
    });
    const possibleDuplicates = candidates.filter(
      (candidate) =>
        duplicateFingerprint({
          firstName: candidate.person.firstName,
          lastName: candidate.person.lastName,
          dateOfBirth:
            candidate.person.dateOfBirth?.toISOString().slice(0, 10) ?? "",
        }) === fingerprint ||
        candidate.person.contacts.some((contact) =>
          contactHashes.includes(contact.normalizedHash),
        ),
    );
    if (possibleDuplicates.length && !input.duplicateOverrideReason)
      throw new Error("Possible duplicate student found");
    const admissionNumber = await this.nextAdmissionNumber(tx, context, input);
    const person = await tx.person.create({
      data: {
        trustId: context.trustId,
        firstName: input.firstName,
        lastName: input.lastName,
        preferredName: input.preferredName,
        dateOfBirth: dateOnly(input.dateOfBirth),
        contacts: {
          create: [
            ...(input.phone
              ? [
                  {
                    type: "PHONE" as const,
                    value: input.phone,
                    normalizedHash: normalizedContactHash(input.phone),
                    isPrimary: true,
                  },
                ]
              : []),
            ...(input.email
              ? [
                  {
                    type: "EMAIL" as const,
                    value: input.email,
                    normalizedHash: normalizedContactHash(input.email),
                    isPrimary: true,
                  },
                ]
              : []),
          ],
        },
        ...(input.address
          ? { addresses: { create: { ...input.address } } }
          : {}),
      },
    });
    const student = await tx.studentProfile.create({
      data: {
        trustId: context.trustId,
        personId: person.id,
        studentNumber: admissionNumber,
        lifecycleStatus: section
          ? StudentProfileStatus.ACTIVE
          : StudentProfileStatus.ADMITTED,
        transportEligible: input.transportEligible,
        hostelEligible: input.hostelEligible,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
    });
    await tx.studentAdmission.create({
      data: {
        trustId: context.trustId,
        studentProfileId: student.id,
        schoolId: context.schoolId,
        campusId: input.campusId,
        academicYearId: input.academicYearId,
        admissionNumber,
        admittedOn: dateOnly(input.admissionDate),
        category: input.admissionCategory,
        previousSchool: input.previousSchool,
      },
    });
    if (section) {
      const enrollment = await tx.studentEnrollment.create({
        data: {
          trustId: context.trustId,
          studentProfileId: student.id,
          schoolId: context.schoolId,
          campusId: input.campusId,
          academicYearId: input.academicYearId,
          sectionId: section.id,
          startsOn: dateOnly(input.admissionDate),
        },
      });
      await tx.studentEnrollmentEvent.create({
        data: {
          trustId: context.trustId,
          schoolId: context.schoolId,
          studentProfileId: student.id,
          type: EnrollmentEventType.ENROLLED,
          toEnrollmentId: enrollment.id,
          occurredOn: dateOnly(input.admissionDate),
          actorUserId: context.userId,
        },
      });
    }
    return {
      id: student.id,
      changes: {
        admissionNumber,
        enrolled: Boolean(section),
        duplicateOverride: Boolean(input.duplicateOverrideReason),
      },
    };
  }

  private async applyMutation(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    input: Exclude<StudentMutation, { action: "student.create" }>,
  ) {
    const student = await scopedStudent(tx, context, input.studentId);
    if (input.action === "student.update") {
      await tx.person.update({
        where: {
          trustId_id: { trustId: context.trustId, id: student.personId },
        },
        data: {
          firstName: input.data.firstName,
          lastName: input.data.lastName,
          preferredName: input.data.preferredName,
        },
      });
      await tx.studentProfile.update({
        where: { trustId_id: { trustId: context.trustId, id: student.id } },
        data: {
          transportEligible: input.data.transportEligible,
          hostelEligible: input.data.hostelEligible,
          updatedBy: context.userId,
        },
      });
      if (input.data.phone) {
        await tx.personContact.upsert({
          where: {
            trustId_personId_type_value: {
              trustId: context.trustId,
              personId: student.personId,
              type: "PHONE",
              value: input.data.phone,
            },
          },
          create: {
            trustId: context.trustId,
            personId: student.personId,
            type: "PHONE",
            value: input.data.phone,
            normalizedHash: normalizedContactHash(input.data.phone),
            isPrimary: true,
          },
          update: {
            normalizedHash: normalizedContactHash(input.data.phone),
            isPrimary: true,
            status: RecordStatus.ACTIVE,
            archivedAt: null,
          },
        });
      }
      if (input.data.email) {
        await tx.personContact.upsert({
          where: {
            trustId_personId_type_value: {
              trustId: context.trustId,
              personId: student.personId,
              type: "EMAIL",
              value: input.data.email,
            },
          },
          create: {
            trustId: context.trustId,
            personId: student.personId,
            type: "EMAIL",
            value: input.data.email,
            normalizedHash: normalizedContactHash(input.data.email),
            isPrimary: true,
          },
          update: {
            normalizedHash: normalizedContactHash(input.data.email),
            isPrimary: true,
            status: RecordStatus.ACTIVE,
            archivedAt: null,
          },
        });
      }
      if (input.data.address) {
        await tx.personAddress.upsert({
          where: {
            trustId_personId_type: {
              trustId: context.trustId,
              personId: student.personId,
              type: input.data.address.type,
            },
          },
          create: {
            trustId: context.trustId,
            personId: student.personId,
            ...input.data.address,
          },
          update: {
            ...input.data.address,
            status: RecordStatus.ACTIVE,
            archivedAt: null,
          },
        });
      }
      return { id: student.id, changes: { fields: Object.keys(input.data) } };
    }
    if (input.action === "guardian.assign") {
      const guardian = await tx.person.create({
        data: {
          trustId: context.trustId,
          firstName: input.firstName,
          lastName: input.lastName,
          contacts: {
            create: [
              {
                type: "PHONE",
                value: input.phone,
                normalizedHash: normalizedContactHash(input.phone),
                isPrimary: true,
              },
              ...(input.email
                ? [
                    {
                      type: "EMAIL" as const,
                      value: input.email,
                      normalizedHash: normalizedContactHash(input.email),
                      isPrimary: true,
                    },
                  ]
                : []),
            ],
          },
        },
      });
      await tx.guardianRelationship.create({
        data: {
          trustId: context.trustId,
          studentProfileId: student.id,
          guardianPersonId: guardian.id,
          relationshipType: input.relationshipType,
          isPrimary: input.isPrimary,
          canPickUp: input.canPickUp,
          receivesCommunication: input.receivesCommunication,
          hasCustody: input.hasCustody,
          priority: input.priority,
          effectiveFrom: dateOnly(input.effectiveFrom),
        },
      });
      return {
        id: student.id,
        changes: {
          guardianAssigned: true,
          relationshipType: input.relationshipType,
        },
      };
    }
    if (input.action === "sensitive.upsert") {
      const encrypted = encryptStudentData(input.value, {
        trustId: context.trustId,
        studentId: student.id,
        type: input.type,
      });
      await tx.studentSensitiveRecord.upsert({
        where: {
          trustId_studentProfileId_type: {
            trustId: context.trustId,
            studentProfileId: student.id,
            type: input.type,
          },
        },
        create: {
          trustId: context.trustId,
          studentProfileId: student.id,
          type: input.type,
          ...encrypted,
        },
        update: { ...encrypted, status: RecordStatus.ACTIVE, archivedAt: null },
      });
      return {
        id: student.id,
        changes: { type: input.type, value: "[REDACTED]" },
      };
    }
    if (input.action === "note.create") {
      await tx.studentNote.create({
        data: {
          trustId: context.trustId,
          schoolId: context.schoolId,
          studentProfileId: student.id,
          body: input.body,
          visibility: input.visibility,
          createdBy: context.userId,
        },
      });
      return {
        id: student.id,
        changes: { noteCreated: true, visibility: input.visibility },
      };
    }
    if (input.action === "document.register") {
      await tx.studentDocument.create({
        data: {
          trustId: context.trustId,
          schoolId: context.schoolId,
          campusId: input.campusId,
          studentProfileId: student.id,
          type: input.type,
          displayName: input.displayName,
          storageKey: input.storageKey,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          uploadedBy: context.userId,
        },
      });
      return {
        id: student.id,
        changes: { documentRegistered: true, displayName: input.displayName },
      };
    }
    if (
      input.action === "student.archive" ||
      input.action === "student.restore"
    ) {
      const restore = input.action === "student.restore";
      await tx.studentProfile.update({
        where: { trustId_id: { trustId: context.trustId, id: student.id } },
        data: {
          status: restore ? RecordStatus.ACTIVE : RecordStatus.ARCHIVED,
          lifecycleStatus: restore
            ? StudentProfileStatus.ADMITTED
            : StudentProfileStatus.ARCHIVED,
          archivedAt: restore ? null : new Date(),
          updatedBy: context.userId,
        },
      });
      if (restore)
        await tx.studentEnrollmentEvent.create({
          data: {
            trustId: context.trustId,
            schoolId: context.schoolId,
            studentProfileId: student.id,
            type: EnrollmentEventType.RESTORED,
            occurredOn: new Date(),
            reason: input.reason,
            actorUserId: context.userId,
          },
        });
      return {
        id: student.id,
        changes: { restored: restore, reason: input.reason },
      };
    }
    if (input.action.startsWith("enrollment."))
      return this.applyEnrollment(
        tx,
        context,
        student.id,
        input as Extract<StudentMutation, { effectiveOn: string }>,
      );
    throw new Error("Unsupported student operation");
  }

  private async applyEnrollment(
    tx: Prisma.TransactionClient,
    context: AuthenticatedContext,
    studentId: string,
    input: Extract<StudentMutation, { action: `enrollment.${string}` }>,
  ) {
    const current = await tx.studentEnrollment.findFirst({
      where: {
        trustId: context.trustId,
        studentProfileId: studentId,
        schoolId: context.schoolId,
        status: EnrollmentStatus.ACTIVE,
      },
      orderBy: { startsOn: "desc" },
    });
    const effectiveOn = dateOnly(input.effectiveOn);
    const eventMap = {
      "enrollment.enrol": EnrollmentEventType.ENROLLED,
      "enrollment.transfer-section": EnrollmentEventType.SECTION_TRANSFERRED,
      "enrollment.promote": EnrollmentEventType.PROMOTED,
      "enrollment.detain": EnrollmentEventType.DETAINED,
      "enrollment.withdraw": EnrollmentEventType.WITHDRAWN,
      "enrollment.transfer-school": EnrollmentEventType.SCHOOL_TRANSFERRED,
      "enrollment.graduate": EnrollmentEventType.GRADUATED,
      "enrollment.mark-alumni": EnrollmentEventType.MARKED_ALUMNI,
    } as const;
    if (input.action === "enrollment.mark-alumni") {
      await tx.studentProfile.update({
        where: { trustId_id: { trustId: context.trustId, id: studentId } },
        data: {
          lifecycleStatus: StudentProfileStatus.ALUMNI,
          updatedBy: context.userId,
        },
      });
      await tx.studentEnrollmentEvent.create({
        data: {
          trustId: context.trustId,
          schoolId: context.schoolId,
          studentProfileId: studentId,
          type: eventMap[input.action],
          fromEnrollmentId: current?.id,
          occurredOn: effectiveOn,
          reason: input.reason,
          actorUserId: context.userId,
        },
      });
      return { id: studentId, changes: { lifecycleStatus: "ALUMNI" } };
    }
    if (
      input.action === "enrollment.withdraw" ||
      input.action === "enrollment.graduate"
    ) {
      if (!current) throw new Error("No active enrolment exists");
      const status =
        input.action === "enrollment.withdraw"
          ? EnrollmentStatus.WITHDRAWN
          : EnrollmentStatus.COMPLETED;
      const lifecycleStatus =
        input.action === "enrollment.withdraw"
          ? StudentProfileStatus.WITHDRAWN
          : StudentProfileStatus.GRADUATED;
      await tx.studentEnrollment.update({
        where: { trustId_id: { trustId: context.trustId, id: current.id } },
        data: { status, endsOn: effectiveOn },
      });
      await tx.studentProfile.update({
        where: { trustId_id: { trustId: context.trustId, id: studentId } },
        data: { lifecycleStatus, updatedBy: context.userId },
      });
      await tx.studentAdmission.updateMany({
        where: {
          trustId: context.trustId,
          studentProfileId: studentId,
          schoolId: context.schoolId,
          status: StudentAdmissionStatus.ACTIVE,
        },
        data: {
          status:
            input.action === "enrollment.withdraw"
              ? StudentAdmissionStatus.WITHDRAWN
              : StudentAdmissionStatus.COMPLETED,
        },
      });
      await tx.studentEnrollmentEvent.create({
        data: {
          trustId: context.trustId,
          schoolId: context.schoolId,
          studentProfileId: studentId,
          type: eventMap[input.action],
          fromEnrollmentId: current.id,
          occurredOn: effectiveOn,
          reason: input.reason,
          actorUserId: context.userId,
        },
      });
      return { id: studentId, changes: { lifecycleStatus } };
    }
    if (!input.academicYearId || !input.campusId || !input.sectionId)
      throw new Error("Academic year, campus, and section are required");
    const targetSchoolId = input.schoolId ?? context.schoolId;
    if (targetSchoolId !== context.schoolId)
      requirePermission(context, "students.enrollment.manage", {
        trustId: context.trustId,
        schoolId: targetSchoolId,
        campusId: input.campusId,
      });
    await tx.section.findFirstOrThrow({
      where: {
        id: input.sectionId,
        trustId: context.trustId,
        schoolId: targetSchoolId,
        campusId: input.campusId,
        academicYearId: input.academicYearId,
        status: RecordStatus.ACTIVE,
      },
    });
    if (current)
      await tx.studentEnrollment.update({
        where: { trustId_id: { trustId: context.trustId, id: current.id } },
        data: {
          status:
            input.action === "enrollment.transfer-school" ||
            input.action === "enrollment.transfer-section"
              ? EnrollmentStatus.TRANSFERRED
              : EnrollmentStatus.COMPLETED,
          endsOn: effectiveOn,
        },
      });
    const next = await tx.studentEnrollment.create({
      data: {
        trustId: context.trustId,
        studentProfileId: studentId,
        schoolId: targetSchoolId,
        campusId: input.campusId,
        academicYearId: input.academicYearId,
        sectionId: input.sectionId,
        rollNumber: input.rollNumber,
        startsOn: effectiveOn,
      },
    });
    if (input.action === "enrollment.transfer-school") {
      await tx.studentAdmission.updateMany({
        where: {
          trustId: context.trustId,
          studentProfileId: studentId,
          schoolId: context.schoolId,
          status: StudentAdmissionStatus.ACTIVE,
        },
        data: { status: StudentAdmissionStatus.TRANSFERRED },
      });
      const admissionNumber = await this.nextAdmissionNumber(
        tx,
        { ...context, schoolId: targetSchoolId },
        { academicYearId: input.academicYearId },
      );
      await tx.studentAdmission.create({
        data: {
          trustId: context.trustId,
          studentProfileId: studentId,
          schoolId: targetSchoolId,
          campusId: input.campusId,
          academicYearId: input.academicYearId,
          admissionNumber,
          admittedOn: effectiveOn,
          source: "SCHOOL_TRANSFER",
        },
      });
    }
    await tx.studentProfile.update({
      where: { trustId_id: { trustId: context.trustId, id: studentId } },
      data: {
        lifecycleStatus: StudentProfileStatus.ACTIVE,
        updatedBy: context.userId,
      },
    });
    await tx.studentEnrollmentEvent.create({
      data: {
        trustId: context.trustId,
        schoolId: targetSchoolId,
        studentProfileId: studentId,
        type: eventMap[input.action],
        fromEnrollmentId: current?.id,
        toEnrollmentId: next.id,
        occurredOn: effectiveOn,
        reason: input.reason,
        actorUserId: context.userId,
      },
    });
    return {
      id: studentId,
      changes: { enrollmentId: next.id, event: eventMap[input.action] },
    };
  }
}
