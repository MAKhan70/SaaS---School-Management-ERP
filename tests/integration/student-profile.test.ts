import { PrismaClient } from "@/generated/prisma";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import { StudentService } from "@/modules/students/application/student-service";
import { afterAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const service = new StudentService(prisma);

const context: AuthenticatedContext = {
  sessionId: "integration-student-profile",
  userId: "user_demo_school_admin",
  displayName: "Demo School Administrator",
  email: "school-admin@demo.nasaq.test",
  trustId: "trust_saraswati_demo",
  trustName: "Saraswati Learning Trust (Demo)",
  schoolId: "school_saraswati_central_demo",
  campusId: "campus_cbse_pune_demo",
  academicYearId: "academic_year_2026_27_demo",
  academicYearName: "Academic Year 2026–27",
  permissionKeys: ["students.profile.read"],
  permissionGrants: [
    {
      trustId: "trust_saraswati_demo",
      schoolId: "school_saraswati_central_demo",
      scope: "SCHOOL",
      permissionKeys: ["students.profile.read"],
      effectiveFrom: new Date("2026-01-01"),
      active: true,
    },
  ],
  schools: [],
};

describe("student profile service", () => {
  afterAll(async () => prisma.$disconnect());

  it("returns the permitted campus profile and records the access audit", async () => {
    const profile = await service.profile(context, "student_profile_demo", {
      correlationId: `student-profile-${Date.now()}`,
    });
    expect(profile.id).toBe("student_profile_demo");
    expect(profile.sensitiveAccess).toBe(false);
    expect(
      profile.enrollments.every((item) => item.campusId === context.campusId),
    ).toBe(true);
  });
});
