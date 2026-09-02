import { PrismaClient } from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import { StudentService } from "@/modules/students/application/student-service";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const service = new StudentService(prisma);
const runId = Date.now().toString(36);
const ids = {
  platform: `sis-platform-${runId}`,
  trustA: `sis-trust-a-${runId}`,
  trustB: `sis-trust-b-${runId}`,
  schoolA: `sis-school-a-${runId}`,
  schoolB: `sis-school-b-${runId}`,
  studentA: `sis-student-a-${runId}`,
  studentB: `sis-student-b-${runId}`,
};

async function seedStudent(
  trustId: string,
  schoolId: string,
  studentId: string,
  suffix: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_trust_id', ${trustId}, true)`;
    const person = await tx.person.create({
      data: { trustId, firstName: `Synthetic${suffix}`, lastName: "Learner" },
    });
    await tx.studentProfile.create({
      data: {
        id: studentId,
        trustId,
        personId: person.id,
        studentNumber: `SIS-${suffix}`,
      },
    });
    await tx.studentAdmission.create({
      data: {
        trustId,
        schoolId,
        studentProfileId: studentId,
        admissionNumber: `ADM-${suffix}`,
        admittedOn: new Date("2026-04-01"),
      },
    });
  });
}

describe("student tenant isolation", () => {
  beforeAll(async () => {
    await prisma.platform.create({
      data: {
        id: ids.platform,
        key: `sis-test-${runId}`,
        name: "Synthetic SIS Platform",
      },
    });
    for (const [trustId, schoolId, suffix] of [
      [ids.trustA, ids.schoolA, "A"],
      [ids.trustB, ids.schoolB, "B"],
    ] as const) {
      await prisma.trust.create({
        data: {
          id: trustId,
          platformId: ids.platform,
          slug: `sis-${suffix.toLowerCase()}-${runId}`,
          name: `Synthetic Trust ${suffix}`,
        },
      });
      await prisma.school.create({
        data: {
          id: schoolId,
          trustId,
          code: suffix,
          name: `Synthetic School ${suffix}`,
        },
      });
    }
    await seedStudent(ids.trustA, ids.schoolA, ids.studentA, "A");
    await seedStudent(ids.trustB, ids.schoolB, ids.studentB, "B");
  });
  afterAll(async () => prisma.$disconnect());

  it("prevents one trust from seeing another trust's student and admission through RLS", async () => {
    const visible = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE nasaq_app");
      await tx.$executeRaw`SELECT set_config('app.current_trust_id', ${ids.trustA}, true)`;
      return tx.studentProfile.findMany({ include: { admissions: true } });
    });
    expect(visible.some((student) => student.id === ids.studentA)).toBe(true);
    expect(visible.some((student) => student.id === ids.studentB)).toBe(false);
    expect(
      visible
        .flatMap((student) => student.admissions)
        .some((admission) => admission.schoolId === ids.schoolB),
    ).toBe(false);
  });

  it("applies the verified school scope in the student directory service", async () => {
    const context: AuthenticatedContext = {
      sessionId: "sis-session",
      userId: "sis-user",
      displayName: "Synthetic SIS Administrator",
      email: "sis-admin@example.test",
      trustId: ids.trustA,
      trustName: "Synthetic Trust A",
      schoolId: ids.schoolA,
      academicYearId: "sis-year-a",
      academicYearName: "Academic Year 2026–27",
      permissionKeys: ["students.profile.read"],
      permissionGrants: [
        {
          trustId: ids.trustA,
          schoolId: ids.schoolA,
          scope: "SCHOOL",
          permissionKeys: ["students.profile.read"],
          effectiveFrom: new Date("2026-01-01"),
          active: true,
        },
      ],
      schools: [],
    };
    const directory = await service.directory(context, {
      search: "",
      page: 1,
      pageSize: 25,
    });
    expect(directory.students.map((student) => student.id)).toContain(
      ids.studentA,
    );
    expect(directory.students.map((student) => student.id)).not.toContain(
      ids.studentB,
    );
    await expect(
      service.directory(
        { ...context, permissionKeys: [], permissionGrants: [] },
        { search: "", page: 1, pageSize: 25 },
      ),
    ).rejects.toThrow("Access denied");
  });
});
