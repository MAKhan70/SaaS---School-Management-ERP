import { PrismaClient } from "@/generated/prisma";
import { ExaminationService } from "@/modules/examinations/application/examination-service";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const service = new ExaminationService(prisma);
const suffix = crypto.randomUUID().slice(0, 8);
const scope = {
  trustId: "trust_saraswati_demo",
  schoolId: "school_saraswati_central_demo",
  campusId: "campus_cbse_pune_demo",
  academicYearId: "academic_year_2026_27_demo",
};
const examinationId = `examination_integration_${suffix}`;
const mathematicsOfferingId = `examination_subject_math_${suffix}`;
const scienceOfferingId = `examination_subject_science_${suffix}`;
const mathematicsRegisterId = `gradebook_math_${suffix}`;
const scienceRegisterId = `gradebook_science_${suffix}`;
const templateId = `report_template_${suffix}`;

function context(
  userId: string,
  permissionKeys: string[],
): AuthenticatedContext {
  return {
    sessionId: `examination-session-${userId}`,
    userId,
    displayName: "Synthetic Examination User",
    email: `${userId}@example.test`,
    trustId: scope.trustId,
    trustName: "Saraswati Learning Trust (Demo)",
    schoolId: scope.schoolId,
    campusId: scope.campusId,
    academicYearId: scope.academicYearId,
    academicYearName: "Academic Year 2026–27",
    permissionKeys,
    permissionGrants: [
      {
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        scope: "SCHOOL",
        permissionKeys,
        effectiveFrom: new Date("2026-04-01"),
        active: true,
      },
    ],
    schools: [],
  };
}

const teacher = context("user_demo_teacher", [
  "assessments.workspace.read",
  "assessments.marks.enter",
  "assessments.marks.moderate",
  "assessments.marks.reopen.request",
]);
const administrator = context("user_demo_school_admin", [
  "assessments.workspace.read",
  "assessments.assignments.override",
  "assessments.marks.enter",
  "assessments.marks.approve",
  "assessments.marks.lock",
  "assessments.marks.reopen.approve",
  "assessments.results.calculate",
  "assessments.results.publish",
  "assessments.report.generate",
]);
const metadata = (operation: string) => ({
  correlationId: `examination-${operation}-${suffix}`,
  ipHash: "examination-integration",
});

const studentProfileId = "student_profile_demo";
const enrollmentId = "student_enrollment_demo_2026_27";
const mathematicsComponents = {
  internal: `component_math_internal_${suffix}`,
  theory: `component_math_theory_${suffix}`,
};
const scienceComponents = {
  project: `component_science_project_${suffix}`,
  practical: `component_science_practical_${suffix}`,
  viva: `component_science_viva_${suffix}`,
  theory: `component_science_theory_${suffix}`,
};

describe("examination to published report-card workflow", () => {
  beforeAll(async () => {
    const [ruleSet, term, boardConfiguration] = await Promise.all([
      prisma.examinationRuleSet.findFirstOrThrow({
        where: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          status: "ACTIVE",
        },
      }),
      prisma.academicTerm.findFirstOrThrow({
        where: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          academicYearId: scope.academicYearId,
        },
      }),
      prisma.boardConfiguration.findFirstOrThrow({
        where: {
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          status: "ACTIVE",
        },
      }),
    ]);
    await prisma.examination.create({
      data: {
        id: examinationId,
        ...scope,
        academicTermId: term.id,
        ruleSetId: ruleSet.id,
        code: `INT-${suffix}`,
        name: "Synthetic Integration Assessment",
        examinationType: "PERIODIC_TEST",
        assessmentGroup: "SCHOLASTIC",
        startsOn: new Date("2026-09-01"),
        endsOn: new Date("2026-09-05"),
        createdBy: administrator.userId,
      },
    });
    await prisma.examinationSubject.createMany({
      data: [
        {
          id: mathematicsOfferingId,
          ...scope,
          examinationId,
          sectionId: "section_cbse_pune_8a_demo",
          subjectId: "subject_cbse_mathematics_demo",
          assignedTeacherUserId: teacher.userId,
          displayOrder: 1,
        },
        {
          id: scienceOfferingId,
          ...scope,
          examinationId,
          sectionId: "section_cbse_pune_8a_demo",
          subjectId: "subject_cbse_science_demo",
          displayOrder: 2,
        },
      ],
    });
    await prisma.assessmentComponent.createMany({
      data: [
        {
          id: mathematicsComponents.internal,
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          examinationSubjectId: mathematicsOfferingId,
          code: "INTERNAL",
          name: "Internal assessment",
          kind: "INTERNAL_ASSESSMENT",
          maximumMarks: "20",
          passingMarks: "7",
          weightagePercent: "20",
          displayOrder: 1,
        },
        {
          id: mathematicsComponents.theory,
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          examinationSubjectId: mathematicsOfferingId,
          code: "THEORY",
          name: "Theory",
          kind: "THEORY",
          maximumMarks: "80",
          passingMarks: "26",
          weightagePercent: "80",
          displayOrder: 2,
        },
        {
          id: scienceComponents.project,
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          examinationSubjectId: scienceOfferingId,
          code: "PROJECT",
          name: "Project",
          kind: "PROJECT",
          maximumMarks: "10",
          passingMarks: "3",
          weightagePercent: "10",
          displayOrder: 1,
        },
        {
          id: scienceComponents.practical,
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          examinationSubjectId: scienceOfferingId,
          code: "PRACTICAL",
          name: "Practical",
          kind: "PRACTICAL",
          maximumMarks: "10",
          passingMarks: "3",
          weightagePercent: "10",
          displayOrder: 2,
        },
        {
          id: scienceComponents.viva,
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          examinationSubjectId: scienceOfferingId,
          code: "VIVA",
          name: "Viva",
          kind: "VIVA",
          maximumMarks: "10",
          passingMarks: "3",
          weightagePercent: "10",
          displayOrder: 3,
        },
        {
          id: scienceComponents.theory,
          trustId: scope.trustId,
          schoolId: scope.schoolId,
          examinationSubjectId: scienceOfferingId,
          code: "THEORY",
          name: "Theory",
          kind: "THEORY",
          maximumMarks: "70",
          passingMarks: "23",
          weightagePercent: "70",
          displayOrder: 4,
        },
      ],
    });
    await prisma.gradebookRegister.createMany({
      data: [
        {
          id: mathematicsRegisterId,
          ...scope,
          examinationSubjectId: mathematicsOfferingId,
        },
        {
          id: scienceRegisterId,
          ...scope,
          examinationSubjectId: scienceOfferingId,
        },
      ],
    });
    await prisma.reportCardTemplate.create({
      data: {
        id: templateId,
        trustId: scope.trustId,
        schoolId: scope.schoolId,
        academicYearId: scope.academicYearId,
        boardConfigurationId: boardConfiguration.id,
        code: `INT-${suffix}`,
        name: "Synthetic report card",
        version: 1,
        configuration: {
          sections: ["SCHOLASTIC", "CO_SCHOLASTIC", "ATTENDANCE", "REMARKS"],
          gradeLegend: true,
        },
        branding: { useSchoolBranding: true },
        createdBy: administrator.userId,
      },
    });
  });

  afterAll(async () => prisma.$disconnect());

  it("restricts a teacher to an assigned subject", async () => {
    await expect(
      service.workspace(teacher, {
        examinationId,
        examinationSubjectId: scienceOfferingId,
      }),
    ).rejects.toThrow("not assigned");
  });

  it("enters, moderates, approves, locks, publishes, generates, and audits post-lock changes", async () => {
    await service.mutate(
      teacher,
      {
        action: "marks.bulk.save",
        examinationSubjectId: mathematicsOfferingId,
        records: [
          {
            enrollmentId,
            studentProfileId,
            componentId: mathematicsComponents.internal,
            status: "MARKED",
            marks: "18",
          },
          {
            enrollmentId,
            studentProfileId,
            componentId: mathematicsComponents.theory,
            status: "MARKED",
            marks: "60",
          },
        ],
      },
      metadata("math-entry"),
    );
    const theoryEntry = await prisma.markEntry.findFirstOrThrow({
      where: {
        examinationSubjectId: mathematicsOfferingId,
        componentId: mathematicsComponents.theory,
        studentProfileId,
      },
    });
    const moderation = await service.mutate(
      teacher,
      {
        action: "moderation.request",
        markEntryId: theoryEntry.id,
        proposed: { status: "MARKED", marks: "62" },
        reason: "Verified moderation sample adjustment.",
      },
      metadata("moderation-request"),
    );
    if (!("id" in moderation)) throw new Error("Expected moderation request");
    await service.mutate(
      administrator,
      {
        action: "moderation.decide",
        requestId: moderation.id,
        approve: true,
        note: "Moderation evidence verified.",
      },
      metadata("moderation-approve"),
    );

    await service.mutate(
      administrator,
      {
        action: "marks.bulk.save",
        examinationSubjectId: scienceOfferingId,
        records: [
          {
            enrollmentId,
            studentProfileId,
            componentId: scienceComponents.project,
            status: "MARKED",
            marks: "8",
          },
          {
            enrollmentId,
            studentProfileId,
            componentId: scienceComponents.practical,
            status: "MARKED",
            marks: "9",
          },
          {
            enrollmentId,
            studentProfileId,
            componentId: scienceComponents.viva,
            status: "EXEMPT",
            marks: null,
          },
          {
            enrollmentId,
            studentProfileId,
            componentId: scienceComponents.theory,
            status: "MARKED",
            marks: "55",
          },
        ],
      },
      metadata("science-entry"),
    );
    await expect(
      service.mutate(
        administrator,
        {
          action: "marks.bulk.save",
          examinationSubjectId: scienceOfferingId,
          records: [
            {
              enrollmentId,
              studentProfileId,
              componentId: scienceComponents.project,
              status: "MARKED",
              marks: "10.01",
            },
          ],
        },
        metadata("over-maximum"),
      ),
    ).rejects.toThrow("maximum");

    for (const registerId of [mathematicsRegisterId, scienceRegisterId]) {
      await service.mutate(
        administrator,
        { action: "register.approve", registerId },
        metadata(`approve-${registerId}`),
      );
      await service.mutate(
        administrator,
        { action: "register.lock", registerId },
        metadata(`lock-${registerId}`),
      );
    }
    const calculated = await service.mutate(
      administrator,
      {
        action: "results.calculate",
        examinationId,
        studentProfileId,
        teacherRemark: "Consistent progress in the assessed areas.",
        principalRemark: "Continue the demonstrated effort.",
        promotionRecommendation: "PROMOTE",
      },
      metadata("calculate"),
    );
    if (!("percentage" in calculated))
      throw new Error("Expected calculated result");
    expect(calculated.state).toBe("CALCULATED");

    const preview = await service.mutate(
      administrator,
      { action: "report.preview", examinationId, templateId, studentProfileId },
      metadata("preview"),
    );
    if (!("snapshot" in preview))
      throw new Error("Expected preview generation");
    expect(preview.kind).toBe("PREVIEW");
    expect(
      await prisma.resultPublication.count({ where: { examinationId } }),
    ).toBe(0);

    await service.mutate(
      administrator,
      { action: "results.publish", examinationId },
      metadata("publish"),
    );
    const publication = await prisma.resultPublication.findFirstOrThrow({
      where: { examinationId, studentProfileId },
    });
    expect(publication.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
    const generated = await service.mutate(
      administrator,
      {
        action: "report.generate",
        examinationId,
        templateId,
        studentProfileId,
        kind: "INDIVIDUAL",
      },
      metadata("generate"),
    );
    if (!("snapshot" in generated))
      throw new Error("Expected report generation");
    expect(generated).toMatchObject({ kind: "INDIVIDUAL", state: "QUEUED" });
    expect(generated.snapshot).toMatchObject({
      qrVerification: { kind: "PLACEHOLDER", value: null },
    });

    const reopening = await service.mutate(
      teacher,
      {
        action: "register.reopen.request",
        registerId: mathematicsRegisterId,
        reason: "Verified transcription correction required.",
      },
      metadata("reopen-request"),
    );
    if (!("id" in reopening)) throw new Error("Expected reopening request");
    await service.mutate(
      administrator,
      {
        action: "register.reopen.decide",
        requestId: reopening.id,
        approve: true,
        note: "Source document was verified.",
      },
      metadata("reopen-approve"),
    );
    await service.mutate(
      teacher,
      {
        action: "marks.bulk.save",
        examinationSubjectId: mathematicsOfferingId,
        reason: "Corrected against the approved source document.",
        records: [
          {
            enrollmentId,
            studentProfileId,
            componentId: mathematicsComponents.internal,
            status: "MARKED",
            marks: "18",
          },
          {
            enrollmentId,
            studentProfileId,
            componentId: mathematicsComponents.theory,
            status: "MARKED",
            marks: "63",
          },
        ],
      },
      metadata("post-lock-change"),
    );
    expect(
      await prisma.markEntryChange.count({
        where: { markEntryId: theoryEntry.id, postLockChange: true },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.studentResult.findFirstOrThrow({
          where: { examinationId, studentProfileId },
        })
      ).state,
    ).toBe("SUPERSEDED");
    expect(
      (
        await prisma.resultPublication.findUniqueOrThrow({
          where: { id: publication.id },
        })
      ).snapshotHash,
    ).toBe(publication.snapshotHash);
  });
});
