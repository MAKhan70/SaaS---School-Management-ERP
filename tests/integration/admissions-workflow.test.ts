import { PrismaClient } from "@/generated/prisma";
import {
  AdmissionService,
  PublicAdmissionService,
} from "@/modules/admissions/application/admission-service";
import { createPublicFormToken } from "@/modules/admissions/domain/admission-contracts";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import { afterAll, describe, expect, it } from "vitest";

const prisma = new PrismaClient();
const internal = new AdmissionService(prisma);
const publicService = new PublicAdmissionService(prisma);

const permissionKeys = [
  "admissions.crm.read",
  "admissions.crm.manage",
  "admissions.forms.manage",
  "admissions.application.review",
  "admissions.application.convert",
  "admissions.analytics.read",
  "admissions.documents.read",
];
const context: AuthenticatedContext = {
  sessionId: "admissions-full-workflow",
  userId: "user_demo_school_admin",
  displayName: "Demo School Administrator",
  email: "school-admin@demo.nasaq.test",
  trustId: "trust_saraswati_demo",
  trustName: "Saraswati Learning Trust (Demo)",
  schoolId: "school_saraswati_central_demo",
  campusId: "campus_cbse_pune_demo",
  academicYearId: "academic_year_2026_27_demo",
  academicYearName: "Academic Year 2026–27",
  permissionKeys,
  permissionGrants: [
    {
      trustId: "trust_saraswati_demo",
      schoolId: "school_saraswati_central_demo",
      scope: "SCHOOL",
      permissionKeys,
      effectiveFrom: new Date("2026-01-01"),
      active: true,
    },
  ],
  schools: [],
};

const metadata = (suffix: string) => ({
  correlationId: `admissions-${suffix}-${Date.now()}`,
  ipHash: `integration-${suffix}`,
});

describe("admissions enquiry-to-admission workflow", () => {
  afterAll(async () => prisma.$disconnect());

  it("runs a public enquiry through review, decision, audit, and idempotent student conversion", async () => {
    const now = new Date();
    const submitted = await publicService.submit(
      "demo-enquiry-2026",
      {
        formToken: createPublicFormToken(
          "demo-enquiry-2026",
          new Date(now.getTime() - 2_000),
        ),
        website: "",
        applicantName: `Vihaan Workflow ${now.getTime()}`,
        dateOfBirth: "2014-03-17",
        email: `guardian.workflow.${now.getTime()}@example.test`,
        phone: `+9177${String(now.getTime()).slice(-8)}`,
        source: "INTEGRATION_TEST",
        targetGradeClassId: "grade_cbse_8_demo",
        siblingStudentProfileId: "student_profile_demo",
        answers: {
          parentName: "Synthetic Workflow Guardian",
          preferredContact: "Email",
        },
      },
      metadata("public"),
    );
    expect("referenceNumber" in submitted).toBe(true);
    if (!("referenceNumber" in submitted))
      throw new Error("Expected an application reference");
    expect(submitted.referenceNumber).toMatch(/^ADM-/);
    const application = await prisma.admissionApplication.findFirstOrThrow({
      where: {
        trustId: context.trustId,
        schoolId: context.schoolId,
        referenceNumber: submitted.referenceNumber,
      },
    });
    await internal.mutate(
      context,
      {
        action: "counselor.assign",
        applicationId: application.id,
        counselorUserId: context.userId,
      },
      metadata("counselor"),
    );
    const task = await internal.mutate(
      context,
      {
        action: "follow-up.create",
        applicationId: application.id,
        title: "Confirm document checklist",
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
      metadata("follow-up"),
    );
    await internal.mutate(
      context,
      {
        action: "follow-up.complete",
        applicationId: application.id,
        followUpId: task.id,
      },
      metadata("follow-up-complete"),
    );
    await internal.mutate(
      context,
      {
        action: "stage.transition",
        applicationId: application.id,
        to: "CONTACTED",
        reason: "Counselor made the first contact",
      },
      metadata("contacted"),
    );
    await internal.mutate(
      context,
      {
        action: "stage.transition",
        applicationId: application.id,
        to: "FOLLOW_UP_SCHEDULED",
        reason: "Guardian requested a follow-up",
      },
      metadata("follow-up-scheduled"),
    );
    await internal.mutate(
      context,
      {
        action: "stage.transition",
        applicationId: application.id,
        to: "APPLICATION_STARTED",
        reason: "Guardian began the application",
      },
      metadata("application-started"),
    );
    await internal.mutate(
      context,
      {
        action: "stage.transition",
        applicationId: application.id,
        to: "APPLICATION_SUBMITTED",
        reason: "Application details were confirmed",
      },
      metadata("application-submitted"),
    );
    await internal.mutate(
      context,
      {
        action: "document.upsert",
        applicationId: application.id,
        code: "BIRTH_CERTIFICATE",
        label: "Birth certificate",
        required: true,
        status: "VERIFIED",
        storageKey: `private/admissions/${application.id}/birth.pdf`,
        displayName: "birth-certificate.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      },
      metadata("document"),
    );
    await internal.mutate(
      context,
      {
        action: "fee.update",
        applicationId: application.id,
        amountMinor: 150000,
        currency: "INR",
        status: "PAID",
        reference: "LOCAL-PREVIEW-ONLY",
      },
      metadata("fee"),
    );
    await internal.mutate(
      context,
      {
        action: "stage.transition",
        applicationId: application.id,
        to: "DOCUMENTS_PENDING",
        reason: "Checklist opened",
      },
      metadata("documents-pending"),
    );
    await internal.mutate(
      context,
      {
        action: "stage.transition",
        applicationId: application.id,
        to: "UNDER_REVIEW",
        reason: "Required document verified",
      },
      metadata("review"),
    );
    await internal.mutate(
      context,
      {
        action: "schedule.create",
        applicationId: application.id,
        type: "ASSESSMENT",
        scheduledFor: new Date(Date.now() + 172_800_000).toISOString(),
        durationMinutes: 45,
        location: "Room R101",
        assigneeUserId: context.userId,
      },
      metadata("assessment"),
    );
    await internal.mutate(
      context,
      {
        action: "stage.transition",
        applicationId: application.id,
        to: "ASSESSMENT_SCHEDULED",
        reason: "Assessment slot confirmed",
      },
      metadata("assessment-stage"),
    );
    await internal.mutate(
      context,
      {
        action: "stage.transition",
        applicationId: application.id,
        to: "INTERVIEW_SCHEDULED",
        reason: "Assessment completed successfully",
      },
      metadata("interview-stage"),
    );
    await internal.mutate(
      context,
      {
        action: "schedule.create",
        applicationId: application.id,
        type: "INTERVIEW",
        scheduledFor: new Date(Date.now() + 259_200_000).toISOString(),
        durationMinutes: 30,
        location: "Admissions office",
      },
      metadata("interview"),
    );
    await internal.mutate(
      context,
      {
        action: "stage.transition",
        applicationId: application.id,
        to: "OFFERED",
        reason: "Admission committee approved the offer",
      },
      metadata("offer"),
    );
    await internal.mutate(
      context,
      {
        action: "stage.transition",
        applicationId: application.id,
        to: "ADMITTED",
        reason: "Guardian accepted the offer",
      },
      metadata("admitted"),
    );
    const converted = await internal.mutate(
      context,
      {
        action: "application.convert",
        applicationId: application.id,
        campusId: context.campusId ?? "",
        sectionId: "section_cbse_pune_8a_demo",
        admissionDate: "2026-09-01",
      },
      metadata("convert"),
    );
    const repeated = await internal.mutate(
      context,
      {
        action: "application.convert",
        applicationId: application.id,
        campusId: context.campusId ?? "",
        sectionId: "section_cbse_pune_8a_demo",
        admissionDate: "2026-09-01",
      },
      metadata("convert-repeat"),
    );
    if (!("idempotent" in converted) || !("idempotent" in repeated))
      throw new Error("Expected conversion results");
    expect(converted.idempotent).toBe(false);
    expect(repeated).toMatchObject({
      idempotent: true,
      studentProfileId: converted.studentProfileId,
    });
    const completed = await prisma.admissionApplication.findUniqueOrThrow({
      where: { id: application.id },
      include: {
        activities: true,
        notificationPreviews: true,
        documents: true,
      },
    });
    expect(completed.stage).toBe("ADMITTED");
    expect(completed.convertedStudentProfileId).toBe(
      converted.studentProfileId,
    );
    expect(
      completed.activities.some((item) => item.type === "CONVERTED_TO_STUDENT"),
    ).toBe(true);
    expect(completed.notificationPreviews).toHaveLength(1);
    expect(completed.notificationPreviews[0]?.recipientMasked).not.toContain(
      "guardian.workflow",
    );
    expect(completed.documents[0]?.storageKey).toContain("private/admissions/");
    expect(
      await prisma.auditEvent.count({
        where: {
          resourceId: application.id,
          action: "admissions.stage.transition",
        },
      }),
    ).toBeGreaterThanOrEqual(5);
  });
});
