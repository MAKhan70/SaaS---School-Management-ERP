import {
  AcademicYearStatus,
  AssignmentScope,
  BoardConfigurationStatus,
  BoardType,
  EnrollmentStatus,
  GuardianRelationshipType,
  Prisma,
  PrismaClient,
  RateLimitAction,
  RecordStatus,
  RoleOrigin,
} from "../src/generated/prisma";
import { hashPassword } from "../src/modules/identity/infrastructure/credential-crypto";
import { operationalModules } from "../src/modules/operations/domain/operational-catalogue";
import { tenantFeatures } from "../src/modules/platform-admin/domain/feature-catalogue";

const prisma = new PrismaClient();

const ids = {
  platform: "platform_nasaq",
  trust: "trust_saraswati_demo",
  cbseSchool: "school_saraswati_central_demo",
  stateSchool: "school_saraswati_state_demo",
  cbsePuneCampus: "campus_cbse_pune_demo",
  cbseNashikCampus: "campus_cbse_nashik_demo",
  statePuneCampus: "campus_state_pune_demo",
  stateNagpurCampus: "campus_state_nagpur_demo",
  cbseAcademicYear: "academic_year_2026_27_demo",
  stateAcademicYear: "academic_year_state_2026_27_demo",
  cbseBoard: "board_cbse_v1_demo",
  stateBoard: "board_maharashtra_v1_demo",
} as const;

const operationalPermissionEntries = [
  ["operations.portfolio.read", "Open the operational module portfolio"],
  ...operationalModules.flatMap((module) => [
    [
      module.readPermission,
      `Read ${module.title} records within granted scope`,
    ],
    [
      module.managePermission,
      `Manage ${module.title} records within granted scope`,
    ],
  ]),
] as const;

const operationalPermissionKeys = operationalPermissionEntries.map(
  ([key]) => key,
);

const permissions = [
  [
    "platform.clients.manage",
    "Provision clients and manage tenant feature entitlements",
  ],
  [
    "platform.support.access",
    "Start time-bound audited support access to a client workspace",
  ],
  ["platform.dashboard.read", "View the authenticated workspace dashboard"],
  ["dashboard.admin.read", "View school-administrator dashboard aggregates"],
  [
    "dashboard.principal.read",
    "View principal academic and operational aggregates",
  ],
  ["dashboard.teacher.read", "View assigned teacher portal information"],
  [
    "dashboard.student.read",
    "View the authenticated student's portal information",
  ],
  ["dashboard.parent.read", "View portal information for linked children"],
  ["dashboard.accountant.read", "View accountant dashboard aggregates"],
  ["tenant.onboarding.manage", "Manage the tenant onboarding checklist"],
  ["identity.staff.invite", "Invite initial and subsequent staff accounts"],
  [
    "institutions.trust.manage",
    "Manage trust-level institutional configuration",
  ],
  ["institutions.school.manage", "Manage school and campus configuration"],
  ["memberships.user.manage", "Manage school memberships and role assignments"],
  [
    "academic.structure.manage",
    "Manage academic years, boards, grades, sections, and subjects",
  ],
  ["students.profile.read", "Read student profiles within granted scope"],
  [
    "students.profile.write",
    "Create and update student profiles within granted scope",
  ],
  ["students.enrollment.manage", "Manage student enrolment lifecycle events"],
  ["students.guardian.manage", "Manage student guardian relationships"],
  ["students.sensitive.read", "Read approved sensitive student information"],
  ["students.sensitive.write", "Manage approved sensitive student information"],
  ["students.documents.read", "Download approved student documents"],
  ["students.documents.manage", "Manage student document metadata"],
  ["students.bulk.import", "Import students into an authorised school"],
  ["students.data.export", "Export the minimum permitted student dataset"],
  ["students.lifecycle.manage", "Archive and restore student profiles"],
  ["admissions.crm.read", "Read admissions applications and reporting"],
  ["admissions.crm.manage", "Manage admission workflows and follow-ups"],
  ["admissions.forms.manage", "Manage admission forms and seat plans"],
  ["admissions.application.review", "Review and decide admission applications"],
  [
    "admissions.application.convert",
    "Convert admitted applications into student profiles",
  ],
  [
    "admissions.analytics.read",
    "Read admissions funnel and productivity analytics",
  ],
  [
    "admissions.documents.read",
    "Download authorised private admission documents",
  ],
  ["attendance.session.mark", "Mark attendance for assigned learners"],
  ["attendance.session.read", "Read attendance registers and summaries"],
  ["attendance.session.manage", "Manage any attendance session in scope"],
  ["attendance.session.correct", "Correct saved or previous-day attendance"],
  ["attendance.session.lock", "Lock completed attendance sessions"],
  ["attendance.session.reopen.request", "Request attendance reopening"],
  ["attendance.session.reopen.approve", "Approve attendance reopening"],
  [
    "attendance.classes.override",
    "Access attendance outside teaching assignments",
  ],
  ["attendance.leave.request", "Request student attendance leave"],
  ["attendance.leave.manage", "Approve student attendance leave"],
  ["attendance.status.manage", "Manage custom attendance statuses"],
  ["attendance.reports.read", "Read attendance reports and alerts"],
  ["attendance.staff.mark", "Record staff check-in and check-out"],
  [
    "attendance.staff.correction.request",
    "Request staff attendance correction",
  ],
  ["attendance.staff.correct", "Approve staff attendance corrections"],
  ["attendance.staff.leave.request", "Request staff leave"],
  ["attendance.staff.leave.manage", "Approve staff leave"],
  ["attendance.shift.manage", "Manage effective-dated staff shifts"],
  ["attendance.device.ingest", "Ingest idempotent attendance device events"],
  ["assessments.workspace.read", "Read examination and gradebook workspaces"],
  ["assessments.configuration.manage", "Manage versioned examination rules"],
  ["assessments.marks.enter", "Enter marks for assigned subjects and classes"],
  ["assessments.marks.approve", "Approve submitted marks"],
  ["assessments.marks.moderate", "Request and review marks moderation"],
  ["assessments.marks.lock", "Lock approved marks registers"],
  ["assessments.marks.reopen.request", "Request marks register reopening"],
  ["assessments.marks.reopen.approve", "Approve marks register reopening"],
  ["assessments.results.calculate", "Calculate results from locked marks"],
  ["assessments.results.publish", "Publish versioned result snapshots"],
  ["assessments.results.read.published", "Read published result snapshots"],
  ["assessments.report.generate", "Preview and generate report cards"],
  ["assessments.report.template.manage", "Manage report card templates"],
  [
    "assessments.assignments.override",
    "Access gradebooks outside teaching assignments",
  ],
  ["finance.fees.read", "Read fee accounts within granted scope"],
  ["finance.fees.manage", "Manage fee categories and structures"],
  ["finance.payments.collect", "Post and reverse fee payments"],
  ["finance.adjustments.request", "Request fee concessions and waivers"],
  ["finance.adjustments.approve", "Approve fee concessions and waivers"],
  ["finance.refunds.request", "Request payment refunds"],
  ["finance.refunds.approve", "Approve and complete payment refunds"],
  ["finance.reports.read", "Read fee outstanding and collection reports"],
  ["finance.reconciliation.manage", "Reconcile payment provider events"],
  ["finance.collection.close", "Close and snapshot daily collections"],
  ["analytics.dashboard.read", "Read tenant-scoped school analytics"],
  ["analytics.data.export", "Export minimum-necessary aggregate analytics"],
  ["analytics.support.read", "Read staff-only explainable support indicators"],
  [
    "analytics.support.review",
    "Refresh, correct, dismiss, and resolve support indicators",
  ],
  ["ai.assistance.draft", "Create draft-only local AI-assisted content"],
  ["ai.assistance.review", "Review, accept, edit, or dismiss assisted drafts"],
  ["ai.audit.read", "Read responsible-assistance audit evidence"],
  ["hr.staff.manage", "Manage staff profiles and assignments"],
  ["library.circulation.manage", "Manage library circulation"],
  ["transport.operations.manage", "Manage transport operations"],
  ["hostel.operations.manage", "Manage hostel operations"],
  ["health.records.read", "Read approved minimum-necessary health records"],
  ["health.records.write", "Write approved minimum-necessary health records"],
  ["security.visitors.manage", "Manage visitors and gate operations"],
  ["profile.self.read", "Read the actor's own profile"],
  ["children.records.read", "Read records for linked children"],
  ...operationalPermissionEntries,
] as const;

const rolePermissions: Record<string, readonly string[]> = {
  platform_operator: ["platform.clients.manage", "platform.support.access"],
  trust_admin: permissions.map(([key]) => key),
  school_admin: [
    "platform.dashboard.read",
    "dashboard.admin.read",
    "institutions.school.manage",
    "memberships.user.manage",
    "academic.structure.manage",
    "students.profile.read",
    "students.profile.write",
    "students.enrollment.manage",
    "students.guardian.manage",
    "students.documents.read",
    "students.documents.manage",
    "students.bulk.import",
    "students.data.export",
    "students.lifecycle.manage",
    "admissions.crm.read",
    "admissions.crm.manage",
    "admissions.forms.manage",
    "admissions.application.review",
    "admissions.application.convert",
    "admissions.analytics.read",
    "admissions.documents.read",
    "attendance.session.read",
    "attendance.session.mark",
    "attendance.session.manage",
    "attendance.session.correct",
    "attendance.session.lock",
    "attendance.session.reopen.request",
    "attendance.session.reopen.approve",
    "attendance.classes.override",
    "attendance.leave.request",
    "attendance.leave.manage",
    "attendance.status.manage",
    "attendance.reports.read",
    "attendance.staff.mark",
    "attendance.staff.correction.request",
    "attendance.staff.correct",
    "attendance.staff.leave.request",
    "attendance.staff.leave.manage",
    "attendance.shift.manage",
    "attendance.device.ingest",
    "assessments.workspace.read",
    "assessments.configuration.manage",
    "assessments.marks.enter",
    "assessments.marks.approve",
    "assessments.marks.moderate",
    "assessments.marks.lock",
    "assessments.marks.reopen.request",
    "assessments.marks.reopen.approve",
    "assessments.results.calculate",
    "assessments.results.publish",
    "assessments.results.read.published",
    "assessments.report.generate",
    "assessments.report.template.manage",
    "assessments.assignments.override",
    "finance.fees.read",
    "finance.fees.manage",
    "finance.payments.collect",
    "finance.adjustments.request",
    "finance.adjustments.approve",
    "finance.refunds.request",
    "finance.refunds.approve",
    "finance.reports.read",
    "finance.reconciliation.manage",
    "finance.collection.close",
    "analytics.dashboard.read",
    "analytics.data.export",
    "analytics.support.read",
    "analytics.support.review",
    "ai.assistance.draft",
    "ai.assistance.review",
    "ai.audit.read",
    "hr.staff.manage",
    ...operationalPermissionKeys,
  ],
  principal: [
    "platform.dashboard.read",
    "dashboard.principal.read",
    "students.profile.read",
    "attendance.session.read",
    "attendance.reports.read",
    "assessments.workspace.read",
    "assessments.results.read.published",
    "finance.fees.read",
    "finance.reports.read",
    "finance.adjustments.approve",
    "finance.refunds.approve",
    "analytics.dashboard.read",
    "analytics.data.export",
    "analytics.support.read",
    "analytics.support.review",
    "ai.assistance.draft",
    "ai.assistance.review",
    "ai.audit.read",
    "profile.self.read",
    "operations.portfolio.read",
    "timetable.schedule.read",
    "lesson.plan.read",
    "events.calendar.read",
    "activities.program.read",
    "discipline.incident.read",
  ],
  teacher: [
    "platform.dashboard.read",
    "dashboard.teacher.read",
    "students.profile.read",
    "attendance.session.read",
    "attendance.session.mark",
    "attendance.session.reopen.request",
    "attendance.leave.request",
    "attendance.staff.mark",
    "attendance.staff.correction.request",
    "attendance.staff.leave.request",
    "assessments.workspace.read",
    "assessments.marks.enter",
    "assessments.marks.moderate",
    "assessments.marks.reopen.request",
    "assessments.results.read.published",
    "ai.assistance.draft",
    "profile.self.read",
    "operations.portfolio.read",
    "timetable.schedule.read",
    "homework.assignment.read",
    "homework.assignment.manage",
    "lesson.plan.read",
    "lesson.plan.manage",
    "communications.message.read",
    "events.calendar.read",
    "activities.program.read",
    "support.ticket.read",
    "support.ticket.manage",
  ],
  student: [
    "platform.dashboard.read",
    "dashboard.student.read",
    "profile.self.read",
    "assessments.results.read.published",
  ],
  parent: [
    "platform.dashboard.read",
    "dashboard.parent.read",
    "profile.self.read",
    "children.records.read",
    "assessments.results.read.published",
  ],
  accountant: [
    "platform.dashboard.read",
    "dashboard.accountant.read",
    "finance.fees.read",
    "finance.fees.manage",
    "finance.payments.collect",
    "finance.adjustments.request",
    "finance.adjustments.approve",
    "finance.refunds.request",
    "finance.refunds.approve",
    "finance.reports.read",
    "finance.reconciliation.manage",
    "finance.collection.close",
    "profile.self.read",
  ],
  hr: [
    "hr.staff.manage",
    "attendance.session.read",
    "attendance.reports.read",
    "attendance.staff.mark",
    "attendance.staff.correct",
    "attendance.staff.leave.manage",
    "attendance.shift.manage",
    "profile.self.read",
    "operations.portfolio.read",
    "hr.staff.read",
    "leave.team.read",
    "leave.request.approve",
    "payroll.input.read",
    "payroll.input.manage",
  ],
  librarian: [
    "operations.portfolio.read",
    "library.catalogue.read",
    "library.circulation.manage",
    "profile.self.read",
  ],
  transport_staff: [
    "operations.portfolio.read",
    "transport.route.read",
    "transport.operations.manage",
    "profile.self.read",
  ],
  hostel_staff: [
    "operations.portfolio.read",
    "hostel.allocation.read",
    "hostel.operations.manage",
    "profile.self.read",
  ],
  nurse: [
    "students.profile.read",
    "students.sensitive.read",
    "students.sensitive.write",
    "health.records.read",
    "health.records.write",
    "health.records.manage",
    "operations.portfolio.read",
    "profile.self.read",
  ],
  security_staff: [
    "security.visitors.manage",
    "operations.portfolio.read",
    "visitors.visit.read",
    "visitors.visit.manage",
    "reception.queue.read",
    "profile.self.read",
  ],
};

const roleNames = {
  platform_operator: "NASAQ Platform Operator",
  trust_admin: "Trust Administrator",
  school_admin: "School Administrator",
  principal: "Principal",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent or Guardian",
  accountant: "Accountant",
  hr: "Human Resources",
  librarian: "Librarian",
  transport_staff: "Transport Staff",
  hostel_staff: "Hostel Staff",
  nurse: "School Nurse",
  security_staff: "Security Staff",
} as const;

type SeedRole = keyof typeof roleNames;

interface DemoUser {
  key: string;
  role: SeedRole;
  schoolId?: string;
  campusId?: string;
  scope: AssignmentScope;
  staff: boolean;
}

const demoUsers: readonly DemoUser[] = [
  {
    key: "trust-admin",
    role: "trust_admin",
    schoolId: ids.cbseSchool,
    scope: AssignmentScope.TRUST,
    staff: true,
  },
  {
    key: "school-admin",
    role: "school_admin",
    schoolId: ids.cbseSchool,
    scope: AssignmentScope.SCHOOL,
    staff: true,
  },
  {
    key: "principal",
    role: "principal",
    schoolId: ids.cbseSchool,
    scope: AssignmentScope.SCHOOL,
    staff: true,
  },
  {
    key: "teacher",
    role: "teacher",
    schoolId: ids.cbseSchool,
    campusId: ids.cbsePuneCampus,
    scope: AssignmentScope.CAMPUS,
    staff: true,
  },
  {
    key: "student",
    role: "student",
    schoolId: ids.cbseSchool,
    campusId: ids.cbsePuneCampus,
    scope: AssignmentScope.SELF,
    staff: false,
  },
  {
    key: "parent",
    role: "parent",
    schoolId: ids.cbseSchool,
    campusId: ids.cbsePuneCampus,
    scope: AssignmentScope.LINKED_CHILDREN,
    staff: false,
  },
  {
    key: "accountant",
    role: "accountant",
    schoolId: ids.cbseSchool,
    scope: AssignmentScope.SCHOOL,
    staff: true,
  },
  {
    key: "hr",
    role: "hr",
    schoolId: ids.cbseSchool,
    scope: AssignmentScope.SCHOOL,
    staff: true,
  },
  {
    key: "librarian",
    role: "librarian",
    schoolId: ids.stateSchool,
    campusId: ids.statePuneCampus,
    scope: AssignmentScope.CAMPUS,
    staff: true,
  },
  {
    key: "transport",
    role: "transport_staff",
    schoolId: ids.cbseSchool,
    campusId: ids.cbsePuneCampus,
    scope: AssignmentScope.CAMPUS,
    staff: true,
  },
  {
    key: "hostel",
    role: "hostel_staff",
    schoolId: ids.cbseSchool,
    campusId: ids.cbseNashikCampus,
    scope: AssignmentScope.CAMPUS,
    staff: true,
  },
  {
    key: "nurse",
    role: "nurse",
    schoolId: ids.stateSchool,
    campusId: ids.statePuneCampus,
    scope: AssignmentScope.CAMPUS,
    staff: true,
  },
  {
    key: "security",
    role: "security_staff",
    schoolId: ids.stateSchool,
    campusId: ids.stateNagpurCampus,
    scope: AssignmentScope.CAMPUS,
    staff: true,
  },
];

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const userId = (key: string) => `user_demo_${key.replaceAll("-", "_")}`;
const personId = (key: string) => `person_demo_${key.replaceAll("-", "_")}`;
const membershipId = (key: string, schoolId: string) =>
  `membership_demo_${key.replaceAll("-", "_")}_${schoolId}`;
const academicYearIdForSchool = (schoolId: string) => {
  if (schoolId === ids.cbseSchool) return ids.cbseAcademicYear;
  if (schoolId === ids.stateSchool) return ids.stateAcademicYear;
  throw new Error(`No synthetic academic year is configured for ${schoolId}`);
};

async function seedGlobalData() {
  if (process.env.RESET_STARTER_SECURITY_STATE === "true") {
    const clearedRateLimits = await prisma.authRateLimit.deleteMany({
      where: { action: RateLimitAction.SIGN_IN },
    });
    await prisma.securityEvent.create({
      data: {
        action: "auth.starter_sign_in_throttles_reset",
        outcome: "SUCCEEDED",
        correlationId: crypto.randomUUID(),
        metadata: { clearedCount: clearedRateLimits.count },
      },
    });
  }

  await prisma.platform.upsert({
    where: { key: "nasaq" },
    update: { name: "NASAQ Academic Systems" },
    create: { id: ids.platform, key: "nasaq", name: "NASAQ Academic Systems" },
  });

  for (const [key, description] of permissions) {
    await prisma.permission.upsert({
      where: { key },
      update: { description, status: RecordStatus.ACTIVE },
      create: {
        id: `permission_${key.replaceAll(".", "_")}`,
        platformId: ids.platform,
        key,
        description,
      },
    });
  }

  await prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
      const permissionRecords = await transaction.permission.findMany({
        where: { key: { in: permissions.map(([key]) => key) } },
        select: { id: true, key: true },
      });
      const permissionIds = new Map(
        permissionRecords.map((permission) => [permission.key, permission.id]),
      );

      for (const [key, name] of Object.entries(roleNames)) {
        await transaction.role.upsert({
          where: { id: `role_system_${key}` },
          update: { name, key, status: RecordStatus.ACTIVE },
          create: {
            id: `role_system_${key}`,
            platformId: ids.platform,
            key,
            name,
            description: `NASAQ system role template: ${name}`,
            origin: RoleOrigin.SYSTEM,
          },
        });

        const rolePermissionRows = (rolePermissions[key] ?? []).map(
          (permissionKey) => {
            const permissionId = permissionIds.get(permissionKey);
            if (!permissionId) {
              throw new Error(`Seed permission is missing: ${permissionKey}`);
            }
            return {
              id: `role_permission_${key}_${permissionKey.replaceAll(".", "_")}`,
              roleId: `role_system_${key}`,
              permissionId,
            };
          },
        );
        if (rolePermissionRows.length > 0) {
          await transaction.rolePermission.createMany({
            data: rolePermissionRows,
            skipDuplicates: true,
          });
        }
      }
    },
    { maxWait: 30_000, timeout: 5 * 60_000 },
  );

  const demoPassword = process.env.DEMO_USER_PASSWORD;
  const demoPasswordHash = demoPassword
    ? await hashPassword(demoPassword)
    : undefined;
  for (const demoUser of demoUsers) {
    const id = userId(demoUser.key);
    const platformOperator = demoUser.key === "trust-admin";
    const email =
      platformOperator && process.env.PLATFORM_ADMIN_EMAIL
        ? process.env.PLATFORM_ADMIN_EMAIL.trim().toLowerCase()
        : `${demoUser.key}@demo.nasaq.test`;
    const passwordHash =
      platformOperator && process.env.PLATFORM_ADMIN_PASSWORD
        ? await hashPassword(process.env.PLATFORM_ADMIN_PASSWORD)
        : demoPasswordHash;
    await prisma.user.upsert({
      where: { id },
      update: {
        email,
        status: "ACTIVE",
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(passwordHash
          ? { passwordHash, credentialsUpdatedAt: new Date() }
          : {}),
      },
      create: {
        id,
        email,
        passwordHash,
      },
    });
    await prisma.userProfile.upsert({
      where: { userId: id },
      update: {
        displayName:
          platformOperator && process.env.PLATFORM_ADMIN_NAME
            ? process.env.PLATFORM_ADMIN_NAME
            : `Demo ${roleNames[demoUser.role]}`,
      },
      create: {
        id: `profile_${id}`,
        userId: id,
        displayName:
          platformOperator && process.env.PLATFORM_ADMIN_NAME
            ? process.env.PLATFORM_ADMIN_NAME
            : `Demo ${roleNames[demoUser.role]}`,
      },
    });
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.platform_admin', 'true', true)`;
    await transaction.platformRoleAssignment.upsert({
      where: {
        userId_roleId: {
          userId: userId("trust-admin"),
          roleId: "role_system_platform_operator",
        },
      },
      update: { status: RecordStatus.ACTIVE },
      create: {
        id: "platform_role_assignment_demo_operator",
        userId: userId("trust-admin"),
        roleId: "role_system_platform_operator",
      },
    });
  });
}

async function seedTenantData() {
  await prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_trust_id', ${ids.trust}, true)`;

      await transaction.trust.upsert({
        where: { slug: "saraswati-learning-trust-demo" },
        update: {
          name: "Saraswati Learning Trust (Demo)",
          status: RecordStatus.ACTIVE,
        },
        create: {
          id: ids.trust,
          platformId: ids.platform,
          slug: "saraswati-learning-trust-demo",
          name: "Saraswati Learning Trust (Demo)",
        },
      });

      for (const feature of tenantFeatures) {
        await transaction.tenantFeatureGrant.upsert({
          where: {
            trustId_featureKey: { trustId: ids.trust, featureKey: feature.key },
          },
          update: { enabled: true, updatedBy: userId("trust-admin") },
          create: {
            id: `feature_grant_demo_${feature.key}`,
            platformId: ids.platform,
            trustId: ids.trust,
            featureKey: feature.key,
            enabled: true,
            updatedBy: userId("trust-admin"),
          },
        });
      }

      const schools = [
        {
          id: ids.cbseSchool,
          code: "SCS",
          name: "Saraswati Central School (Demo)",
        },
        {
          id: ids.stateSchool,
          code: "SSS",
          name: "Saraswati State School (Demo)",
        },
      ] as const;

      for (const school of schools) {
        await transaction.school.upsert({
          where: { trustId_code: { trustId: ids.trust, code: school.code } },
          update: { name: school.name, status: RecordStatus.ACTIVE },
          create: { ...school, trustId: ids.trust },
        });
      }

      const campuses = [
        {
          id: ids.cbsePuneCampus,
          schoolId: ids.cbseSchool,
          code: "PUNE",
          name: "Pune Central Campus (Demo)",
        },
        {
          id: ids.cbseNashikCampus,
          schoolId: ids.cbseSchool,
          code: "NSK",
          name: "Nashik Campus (Demo)",
        },
        {
          id: ids.statePuneCampus,
          schoolId: ids.stateSchool,
          code: "PUNE",
          name: "Pune State Campus (Demo)",
        },
        {
          id: ids.stateNagpurCampus,
          schoolId: ids.stateSchool,
          code: "NGP",
          name: "Nagpur Campus (Demo)",
        },
      ] as const;

      for (const campus of campuses) {
        await transaction.campus.upsert({
          where: {
            trustId_schoolId_code: {
              trustId: ids.trust,
              schoolId: campus.schoolId,
              code: campus.code,
            },
          },
          update: { name: campus.name, status: RecordStatus.ACTIVE },
          create: { ...campus, trustId: ids.trust },
        });
      }

      for (const academicYear of [
        {
          id: ids.cbseAcademicYear,
          schoolId: ids.cbseSchool,
          code: "CBSE-2026-27",
        },
        {
          id: ids.stateAcademicYear,
          schoolId: ids.stateSchool,
          code: "MH-2026-27",
        },
      ] as const) {
        await transaction.academicYear.upsert({
          where: {
            trustId_code: { trustId: ids.trust, code: academicYear.code },
          },
          update: { status: AcademicYearStatus.ACTIVE },
          create: {
            ...academicYear,
            trustId: ids.trust,
            name: "Academic Year 2026–27",
            startsOn: date("2026-04-01"),
            endsOn: date("2027-03-31"),
            status: AcademicYearStatus.ACTIVE,
          },
        });
      }

      const boards: readonly {
        id: string;
        schoolId: string;
        boardType: BoardType;
        stateCode?: string;
        name: string;
        rules: Prisma.InputJsonObject;
      }[] = [
        {
          id: ids.cbseBoard,
          schoolId: ids.cbseSchool,
          boardType: BoardType.CBSE,
          name: "CBSE 2026 Foundation Rules (Demo)",
          rules: {
            languages: ["en", "hi"],
            gradingScaleVersion: "2026.1",
            continuousAssessment: true,
          },
        },
        {
          id: ids.stateBoard,
          schoolId: ids.stateSchool,
          boardType: BoardType.MAHARASHTRA_STATE,
          stateCode: "MH",
          name: "Maharashtra State Board 2026 Rules (Demo)",
          rules: {
            languages: ["en", "mr"],
            gradingScaleVersion: "2026.1",
            stateCode: "MH",
          },
        },
      ];

      for (const board of boards) {
        await transaction.boardConfiguration.upsert({
          where: {
            trustId_schoolId_boardType_version: {
              trustId: ids.trust,
              schoolId: board.schoolId,
              boardType: board.boardType,
              version: 1,
            },
          },
          update: {
            name: board.name,
            rules: board.rules,
            status: BoardConfigurationStatus.ACTIVE,
          },
          create: {
            ...board,
            trustId: ids.trust,
            version: 1,
            effectiveFrom: date("2026-04-01"),
            status: BoardConfigurationStatus.ACTIVE,
          },
        });
      }

      const grades = [
        {
          id: "grade_cbse_8_demo",
          schoolId: ids.cbseSchool,
          boardConfigurationId: ids.cbseBoard,
          code: "G8",
          name: "Grade 8",
          level: 8,
        },
        {
          id: "grade_cbse_11_demo",
          schoolId: ids.cbseSchool,
          boardConfigurationId: ids.cbseBoard,
          code: "G11",
          name: "Grade 11",
          level: 11,
        },
        {
          id: "grade_state_8_demo",
          schoolId: ids.stateSchool,
          boardConfigurationId: ids.stateBoard,
          code: "STD8",
          name: "Standard 8",
          level: 8,
        },
      ] as const;

      for (const grade of grades) {
        await transaction.gradeClass.upsert({
          where: {
            trustId_schoolId_boardConfigurationId_code: {
              trustId: ids.trust,
              schoolId: grade.schoolId,
              boardConfigurationId: grade.boardConfigurationId,
              code: grade.code,
            },
          },
          update: { name: grade.name, level: grade.level },
          create: { ...grade, trustId: ids.trust },
        });
      }

      const streams = [
        {
          id: "stream_cbse_science_demo",
          schoolId: ids.cbseSchool,
          code: "SCI",
          name: "Science",
        },
        {
          id: "stream_cbse_commerce_demo",
          schoolId: ids.cbseSchool,
          code: "COM",
          name: "Commerce",
        },
        {
          id: "stream_state_general_demo",
          schoolId: ids.stateSchool,
          code: "GEN",
          name: "General",
        },
      ] as const;
      const departments = [
        {
          id: "department_cbse_science_demo",
          schoolId: ids.cbseSchool,
          code: "SCI",
          name: "Science Department",
        },
        {
          id: "department_state_languages_demo",
          schoolId: ids.stateSchool,
          code: "LANG",
          name: "Languages Department",
        },
      ] as const;

      for (const stream of streams) {
        await transaction.stream.upsert({
          where: {
            trustId_schoolId_code: {
              trustId: ids.trust,
              schoolId: stream.schoolId,
              code: stream.code,
            },
          },
          update: { name: stream.name },
          create: { ...stream, trustId: ids.trust },
        });
      }
      for (const department of departments) {
        await transaction.department.upsert({
          where: {
            trustId_schoolId_code: {
              trustId: ids.trust,
              schoolId: department.schoolId,
              code: department.code,
            },
          },
          update: { name: department.name },
          create: { ...department, trustId: ids.trust },
        });
      }

      const subjects = [
        {
          id: "subject_cbse_mathematics_demo",
          schoolId: ids.cbseSchool,
          departmentId: "department_cbse_science_demo",
          code: "MATH",
          name: "Mathematics",
        },
        {
          id: "subject_cbse_science_demo",
          schoolId: ids.cbseSchool,
          departmentId: "department_cbse_science_demo",
          code: "SCI",
          name: "Science",
        },
        {
          id: "subject_state_marathi_demo",
          schoolId: ids.stateSchool,
          departmentId: "department_state_languages_demo",
          code: "MAR",
          name: "Marathi",
        },
      ] as const;
      for (const subject of subjects) {
        await transaction.subject.upsert({
          where: {
            trustId_schoolId_code: {
              trustId: ids.trust,
              schoolId: subject.schoolId,
              code: subject.code,
            },
          },
          update: { name: subject.name },
          create: { ...subject, trustId: ids.trust },
        });
      }

      const sections = [
        {
          id: "section_cbse_pune_8a_demo",
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          gradeClassId: "grade_cbse_8_demo",
          code: "A",
          name: "Grade 8 A",
        },
        {
          id: "section_cbse_nashik_8a_demo",
          schoolId: ids.cbseSchool,
          campusId: ids.cbseNashikCampus,
          gradeClassId: "grade_cbse_8_demo",
          code: "A",
          name: "Grade 8 A",
        },
        {
          id: "section_cbse_pune_8b_demo",
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          gradeClassId: "grade_cbse_8_demo",
          code: "B",
          name: "Grade 8 B",
        },
        {
          id: "section_state_pune_8a_demo",
          schoolId: ids.stateSchool,
          campusId: ids.statePuneCampus,
          gradeClassId: "grade_state_8_demo",
          streamId: "stream_state_general_demo",
          code: "A",
          name: "Standard 8 A",
        },
        {
          id: "section_state_nagpur_8a_demo",
          schoolId: ids.stateSchool,
          campusId: ids.stateNagpurCampus,
          gradeClassId: "grade_state_8_demo",
          streamId: "stream_state_general_demo",
          code: "A",
          name: "Standard 8 A",
        },
      ] as const;
      for (const section of sections) {
        await transaction.section.upsert({
          where: {
            trustId_campusId_academicYearId_gradeClassId_code: {
              trustId: ids.trust,
              campusId: section.campusId,
              academicYearId: academicYearIdForSchool(section.schoolId),
              gradeClassId: section.gradeClassId,
              code: section.code,
            },
          },
          update: { name: section.name },
          create: {
            ...section,
            trustId: ids.trust,
            academicYearId: academicYearIdForSchool(section.schoolId),
            capacity: 40,
          },
        });
      }

      for (const schoolId of [ids.cbseSchool, ids.stateSchool]) {
        const academicYearId = academicYearIdForSchool(schoolId);
        await transaction.academicTerm.upsert({
          where: {
            trustId_schoolId_academicYearId_code: {
              trustId: ids.trust,
              schoolId,
              academicYearId,
              code: "T1",
            },
          },
          update: { name: "Term 1", status: RecordStatus.ACTIVE },
          create: {
            trustId: ids.trust,
            schoolId,
            academicYearId,
            code: "T1",
            name: "Term 1",
            sequence: 1,
            startsOn: date("2026-04-01"),
            endsOn: date("2026-09-30"),
          },
        });
        for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
          await transaction.workingDayRule.upsert({
            where: {
              trustId_schoolId_academicYearId_weekday: {
                trustId: ids.trust,
                schoolId,
                academicYearId,
                weekday,
              },
            },
            update: { isWorking: weekday <= 6 },
            create: {
              trustId: ids.trust,
              schoolId,
              academicYearId,
              weekday,
              isWorking: weekday <= 6,
            },
          });
        }
      }

      const rooms = [
        {
          campusId: ids.cbsePuneCampus,
          schoolId: ids.cbseSchool,
          code: "R101",
          name: "Learning Room 101",
          roomType: "Classroom",
        },
        {
          campusId: ids.statePuneCampus,
          schoolId: ids.stateSchool,
          code: "LAB1",
          name: "Science Laboratory 1",
          roomType: "Laboratory",
        },
      ] as const;
      for (const room of rooms) {
        await transaction.room.upsert({
          where: {
            trustId_schoolId_campusId_code: {
              trustId: ids.trust,
              schoolId: room.schoolId,
              campusId: room.campusId,
              code: room.code,
            },
          },
          update: { name: room.name, roomType: room.roomType },
          create: { ...room, trustId: ids.trust, capacity: 40 },
        });
      }

      for (const [schoolId, campusId] of [
        [ids.cbseSchool, ids.cbsePuneCampus],
        [ids.stateSchool, ids.statePuneCampus],
      ] as const) {
        const academicYearId = academicYearIdForSchool(schoolId);
        await transaction.period.upsert({
          where: {
            trustId_schoolId_academicYearId_campusId_code: {
              trustId: ids.trust,
              schoolId,
              academicYearId,
              campusId,
              code: "P1",
            },
          },
          update: { name: "Period 1", startsMinute: 540, endsMinute: 585 },
          create: {
            trustId: ids.trust,
            schoolId,
            campusId,
            academicYearId,
            code: "P1",
            name: "Period 1",
            sequence: 1,
            startsMinute: 540,
            endsMinute: 585,
          },
        });
        await transaction.schoolCalendarDay.upsert({
          where: {
            trustId_schoolId_academicYearId_campusId_date: {
              trustId: ids.trust,
              schoolId,
              academicYearId,
              campusId,
              date: date("2026-08-15"),
            },
          },
          update: { name: "Independence Day", type: "HOLIDAY" },
          create: {
            trustId: ids.trust,
            schoolId,
            campusId,
            academicYearId,
            date: date("2026-08-15"),
            type: "HOLIDAY",
            name: "Independence Day",
          },
        });
        await transaction.house.upsert({
          where: {
            trustId_schoolId_code: {
              trustId: ids.trust,
              schoolId,
              code: "HOUSE-A",
            },
          },
          update: { name: "House A", colour: "#176B5B" },
          create: {
            trustId: ids.trust,
            schoolId,
            code: "HOUSE-A",
            name: "House A",
            colour: "#176B5B",
          },
        });
        for (const entityType of ["STUDENT", "EMPLOYEE"] as const) {
          await transaction.numberingRule.upsert({
            where: {
              trustId_schoolId_entityType_version: {
                trustId: ids.trust,
                schoolId,
                entityType,
                version: 1,
              },
            },
            update: { status: RecordStatus.ACTIVE },
            create: {
              trustId: ids.trust,
              schoolId,
              academicYearId,
              entityType,
              prefixTemplate:
                entityType === "STUDENT" ? "{SCHOOL}-{YEAR}-S-" : "{SCHOOL}-E-",
              padding: 5,
              resetPolicy: entityType === "STUDENT" ? "ACADEMIC_YEAR" : "NEVER",
              version: 1,
              effectiveFrom: date("2026-04-01"),
            },
          });
        }
      }

      for (const schoolId of [ids.cbseSchool, ids.stateSchool]) {
        const academicYearId = academicYearIdForSchool(schoolId);
        const scale = await transaction.gradingScale.upsert({
          where: {
            trustId_schoolId_code_version: {
              trustId: ids.trust,
              schoolId,
              code: "PERCENT",
              version: 1,
            },
          },
          update: { name: "Percentage scale", status: "ACTIVE" },
          create: {
            trustId: ids.trust,
            schoolId,
            academicYearId,
            code: "PERCENT",
            name: "Percentage scale",
            version: 1,
            status: "ACTIVE",
            effectiveFrom: date("2026-04-01"),
          },
        });
        const bands = [
          ["A", "A", 80, 100, 4, 1],
          ["B", "B", 60, 79.9999, 3, 2],
          ["C", "C", 40, 59.9999, 2, 3],
          ["D", "D", 33, 39.9999, 1, 4],
          ["E", "E", 0, 32.9999, 0, 5],
        ] as const;
        for (const [
          code,
          name,
          minimumValue,
          maximumValue,
          gradePoint,
          sequence,
        ] of bands)
          await transaction.gradeBand.upsert({
            where: {
              trustId_schoolId_gradingScaleId_code: {
                trustId: ids.trust,
                schoolId,
                gradingScaleId: scale.id,
                code,
              },
            },
            update: { minimumValue, maximumValue, sequence },
            create: {
              trustId: ids.trust,
              schoolId,
              gradingScaleId: scale.id,
              code,
              name,
              minimumValue,
              maximumValue,
              gradePoint,
              sequence,
            },
          });
      }

      for (const demoUser of demoUsers) {
        const id = userId(demoUser.key);
        const person = personId(demoUser.key);
        await transaction.userTrustAccess.upsert({
          where: { userId_trustId: { userId: id, trustId: ids.trust } },
          update: { status: "ACTIVE", effectiveTo: null },
          create: {
            userId: id,
            trustId: ids.trust,
            effectiveFrom: date("2026-04-01"),
          },
        });
        await transaction.person.upsert({
          where: { trustId_userId: { trustId: ids.trust, userId: id } },
          update: { status: RecordStatus.ACTIVE },
          create: {
            id: person,
            trustId: ids.trust,
            userId: id,
            firstName: "Demo",
            lastName: roleNames[demoUser.role],
          },
        });

        let primaryMembership: string | undefined;
        if (demoUser.schoolId) {
          primaryMembership = membershipId(demoUser.key, demoUser.schoolId);
          await transaction.schoolMembership.upsert({
            where: { id: primaryMembership },
            update: { status: "ACTIVE", effectiveTo: null },
            create: {
              id: primaryMembership,
              trustId: ids.trust,
              userId: id,
              schoolId: demoUser.schoolId,
              campusId: demoUser.campusId,
              effectiveFrom: date("2026-04-01"),
            },
          });
        }

        await transaction.userRoleAssignment.upsert({
          where: { id: `role_assignment_demo_${demoUser.key}` },
          update: {
            status: RecordStatus.ACTIVE,
            schoolMembershipId: primaryMembership ?? null,
            schoolId: demoUser.schoolId ?? null,
            campusId: demoUser.campusId ?? null,
            scope: demoUser.scope,
            effectiveTo: null,
          },
          create: {
            id: `role_assignment_demo_${demoUser.key}`,
            trustId: ids.trust,
            userId: id,
            roleId: `role_system_${demoUser.role}`,
            schoolMembershipId: primaryMembership,
            schoolId: demoUser.schoolId,
            campusId: demoUser.campusId,
            scope: demoUser.scope,
            effectiveFrom: date("2026-04-01"),
            createdBy: userId("trust-admin"),
          },
        });

        if (demoUser.staff) {
          await transaction.staffProfile.upsert({
            where: {
              trustId_personId: { trustId: ids.trust, personId: person },
            },
            update: { status: RecordStatus.ACTIVE },
            create: {
              id: `staff_profile_demo_${demoUser.key}`,
              trustId: ids.trust,
              personId: person,
              employeeCode: `DEM-${demoUser.key.toUpperCase()}`,
            },
          });

          if (demoUser.schoolId) {
            await transaction.staffAssignment.upsert({
              where: { id: `staff_assignment_demo_${demoUser.key}` },
              update: { status: RecordStatus.ACTIVE, effectiveTo: null },
              create: {
                id: `staff_assignment_demo_${demoUser.key}`,
                trustId: ids.trust,
                staffProfileId: `staff_profile_demo_${demoUser.key}`,
                schoolId: demoUser.schoolId,
                campusId: demoUser.campusId,
                title: roleNames[demoUser.role],
                effectiveFrom: date("2026-04-01"),
              },
            });
          }
        }
      }

      const crossSchoolTeacherMembership = membershipId(
        "teacher",
        ids.stateSchool,
      );
      await transaction.schoolMembership.upsert({
        where: { id: crossSchoolTeacherMembership },
        update: { status: "ACTIVE", effectiveTo: null },
        create: {
          id: crossSchoolTeacherMembership,
          trustId: ids.trust,
          userId: userId("teacher"),
          schoolId: ids.stateSchool,
          campusId: ids.statePuneCampus,
          effectiveFrom: date("2026-06-01"),
        },
      });
      await transaction.userRoleAssignment.upsert({
        where: { id: "role_assignment_demo_teacher_state_librarian" },
        update: { status: RecordStatus.ACTIVE, effectiveTo: null },
        create: {
          id: "role_assignment_demo_teacher_state_librarian",
          trustId: ids.trust,
          userId: userId("teacher"),
          roleId: "role_system_librarian",
          schoolMembershipId: crossSchoolTeacherMembership,
          schoolId: ids.stateSchool,
          campusId: ids.statePuneCampus,
          scope: AssignmentScope.CAMPUS,
          effectiveFrom: date("2026-06-01"),
          createdBy: userId("trust-admin"),
        },
      });
      await transaction.staffAssignment.upsert({
        where: { id: "staff_assignment_demo_teacher_state" },
        update: { status: RecordStatus.ACTIVE, effectiveTo: null },
        create: {
          id: "staff_assignment_demo_teacher_state",
          trustId: ids.trust,
          staffProfileId: "staff_profile_demo_teacher",
          schoolId: ids.stateSchool,
          campusId: ids.statePuneCampus,
          title: "Visiting Library Coordinator",
          effectiveFrom: date("2026-06-01"),
        },
      });

      await transaction.studentProfile.upsert({
        where: {
          trustId_personId: {
            trustId: ids.trust,
            personId: personId("student"),
          },
        },
        update: { status: RecordStatus.ACTIVE },
        create: {
          id: "student_profile_demo",
          trustId: ids.trust,
          personId: personId("student"),
          studentNumber: "DEM-STU-001",
        },
      });
      await transaction.studentAdmission.upsert({
        where: {
          trustId_schoolId_admissionNumber: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            admissionNumber: "SCB-2026-27-S-00001",
          },
        },
        update: { status: "ACTIVE" },
        create: {
          id: "student_admission_demo",
          trustId: ids.trust,
          studentProfileId: "student_profile_demo",
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          academicYearId: ids.cbseAcademicYear,
          admissionNumber: "SCB-2026-27-S-00001",
          admittedOn: date("2026-04-01"),
          source: "SYNTHETIC_SEED",
        },
      });
      await transaction.guardianRelationship.upsert({
        where: {
          trustId_studentProfileId_guardianPersonId: {
            trustId: ids.trust,
            studentProfileId: "student_profile_demo",
            guardianPersonId: personId("parent"),
          },
        },
        update: { effectiveTo: null, isPrimary: true },
        create: {
          id: "guardian_relationship_demo",
          trustId: ids.trust,
          studentProfileId: "student_profile_demo",
          guardianPersonId: personId("parent"),
          relationshipType: GuardianRelationshipType.LEGAL_GUARDIAN,
          isPrimary: true,
          canPickUp: true,
          effectiveFrom: date("2026-04-01"),
        },
      });
      await transaction.studentEnrollment.upsert({
        where: {
          trustId_studentProfileId_academicYearId_startsOn: {
            trustId: ids.trust,
            studentProfileId: "student_profile_demo",
            academicYearId: ids.cbseAcademicYear,
            startsOn: date("2026-04-01"),
          },
        },
        update: { status: EnrollmentStatus.ACTIVE, endsOn: null },
        create: {
          id: "student_enrollment_demo_2026_27",
          trustId: ids.trust,
          studentProfileId: "student_profile_demo",
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          academicYearId: ids.cbseAcademicYear,
          sectionId: "section_cbse_pune_8a_demo",
          rollNumber: "08A-001",
          startsOn: date("2026-04-01"),
        },
      });
      const existingEnrollmentEvent =
        await transaction.studentEnrollmentEvent.findUnique({
          where: { id: "student_enrollment_event_demo" },
        });
      if (!existingEnrollmentEvent) {
        await transaction.studentEnrollmentEvent.create({
          data: {
            id: "student_enrollment_event_demo",
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            studentProfileId: "student_profile_demo",
            type: "ENROLLED",
            toEnrollmentId: "student_enrollment_demo_2026_27",
            occurredOn: date("2026-04-01"),
            actorUserId: userId("school-admin"),
            details: { source: "synthetic-seed" },
          },
        });
      }
      await transaction.studentIdentityCard.upsert({
        where: {
          trustId_schoolId_cardNumber: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            cardNumber: "CARD-DEMO-001",
          },
        },
        update: { status: "DRAFT" },
        create: {
          id: "student_identity_card_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          studentProfileId: "student_profile_demo",
          cardNumber: "CARD-DEMO-001",
          status: "DRAFT",
        },
      });

      await transaction.personContact.upsert({
        where: {
          trustId_personId_type_value: {
            trustId: ids.trust,
            personId: personId("parent"),
            type: "EMAIL",
            value: "guardian.demo@example.test",
          },
        },
        update: { status: RecordStatus.ACTIVE, isPrimary: true },
        create: {
          id: "person_contact_demo_parent_email",
          trustId: ids.trust,
          personId: personId("parent"),
          type: "EMAIL",
          value: "guardian.demo@example.test",
          normalizedHash:
            "2be67fb662b2b15c5525a402433bd54c76524f5c448c0ea202e882beb0fa9572",
          label: "Synthetic guardian email",
          isPrimary: true,
        },
      });

      const attendanceStatuses = [
        ["PRESENT", "Present", "PRESENT", true, 100],
        ["ABSENT", "Absent", "ABSENT", false, 0],
        ["LATE", "Late", "LATE", true, 100],
        ["EXCUSED", "Excused", "EXCUSED", false, 0],
        ["HALF_DAY", "Half day", "HALF_DAY", true, 50],
        ["MEDICAL_LEAVE", "Medical leave", "MEDICAL_LEAVE", false, 0],
        ["SCHOOL_ACTIVITY", "School activity", "SCHOOL_ACTIVITY", true, 100],
      ] as const;
      for (const [
        code,
        name,
        category,
        countsAsPresent,
        presentFraction,
      ] of attendanceStatuses) {
        await transaction.attendanceStatusDefinition.upsert({
          where: {
            trustId_schoolId_academicYearId_code: {
              trustId: ids.trust,
              schoolId: ids.cbseSchool,
              academicYearId: ids.cbseAcademicYear,
              code,
            },
          },
          update: { name, category, countsAsPresent, presentFraction },
          create: {
            id: `attendance_status_${code.toLowerCase()}_demo`,
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            academicYearId: ids.cbseAcademicYear,
            code,
            name,
            category,
            countsAsPresent,
            presentFraction,
            isSystem: true,
          },
        });
      }
      await transaction.attendanceTeachingAssignment.upsert({
        where: { id: "attendance_teaching_assignment_demo" },
        update: { status: RecordStatus.ACTIVE, effectiveTo: null },
        create: {
          id: "attendance_teaching_assignment_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          academicYearId: ids.cbseAcademicYear,
          sectionId: "section_cbse_pune_8a_demo",
          subjectId: "subject_cbse_mathematics_demo",
          teacherUserId: userId("teacher"),
          effectiveFrom: date("2026-04-01"),
        },
      });
      const staffShift = await transaction.staffShift.upsert({
        where: {
          trustId_schoolId_campusId_code: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            campusId: ids.cbsePuneCampus,
            code: "REGULAR",
          },
        },
        update: { status: RecordStatus.ACTIVE },
        create: {
          id: "staff_shift_regular_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          code: "REGULAR",
          name: "Regular day shift",
          startsMinute: 480,
          endsMinute: 960,
          graceMinutes: 10,
        },
      });
      await transaction.staffShiftAssignment.upsert({
        where: {
          trustId_schoolId_campusId_academicYearId_staffProfileId_effectiveFrom:
            {
              trustId: ids.trust,
              schoolId: ids.cbseSchool,
              campusId: ids.cbsePuneCampus,
              academicYearId: ids.cbseAcademicYear,
              staffProfileId: "staff_profile_demo_teacher",
              effectiveFrom: date("2026-04-01"),
            },
        },
        update: { status: RecordStatus.ACTIVE, effectiveTo: null },
        create: {
          id: "staff_shift_assignment_teacher_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          academicYearId: ids.cbseAcademicYear,
          staffProfileId: "staff_profile_demo_teacher",
          shiftId: staffShift.id,
          effectiveFrom: date("2026-04-01"),
          assignedBy: userId("school-admin"),
        },
      });
      await transaction.attendanceDevice.upsert({
        where: {
          trustId_schoolId_campusId_code: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            campusId: ids.cbsePuneCampus,
            code: "RFID-GATE-DEMO",
          },
        },
        update: { status: RecordStatus.ACTIVE },
        create: {
          id: "attendance_device_rfid_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          code: "RFID-GATE-DEMO",
          name: "Synthetic RFID gate",
          type: "RFID",
        },
      });

      const cbseScale = await transaction.gradingScale.findUniqueOrThrow({
        where: {
          trustId_schoolId_code_version: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            code: "PERCENT",
            version: 1,
          },
        },
      });
      const stateScale = await transaction.gradingScale.findUniqueOrThrow({
        where: {
          trustId_schoolId_code_version: {
            trustId: ids.trust,
            schoolId: ids.stateSchool,
            code: "PERCENT",
            version: 1,
          },
        },
      });
      const cbseTerm = await transaction.academicTerm.findUniqueOrThrow({
        where: {
          trustId_schoolId_academicYearId_code: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            academicYearId: ids.cbseAcademicYear,
            code: "T1",
          },
        },
      });
      const cbseRules = await transaction.examinationRuleSet.upsert({
        where: {
          trustId_schoolId_code_version: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            code: "CBSE-FRIENDLY",
            version: 1,
          },
        },
        update: { status: RecordStatus.ACTIVE },
        create: {
          id: "examination_rules_cbse_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          boardConfigurationId: ids.cbseBoard,
          gradingScaleId: cbseScale.id,
          code: "CBSE-FRIENDLY",
          name: "CBSE-friendly assessment rules",
          version: 1,
          rules: {
            calculation: {
              exemptHandling: "EXCLUDE",
              includeCoScholasticInPercentage: false,
              subjectAggregation: "EQUAL_SUBJECTS",
              requireComponentPass: true,
              percentageScale: 2,
            },
            publication: { requireAllRegistersLocked: true },
          },
          effectiveFrom: date("2026-04-01"),
          createdBy: userId("school-admin"),
        },
      });
      await transaction.examinationRuleSet.upsert({
        where: {
          trustId_schoolId_code_version: {
            trustId: ids.trust,
            schoolId: ids.stateSchool,
            code: "MAHARASHTRA-STATE",
            version: 1,
          },
        },
        update: { status: RecordStatus.ACTIVE },
        create: {
          id: "examination_rules_maharashtra_demo",
          trustId: ids.trust,
          schoolId: ids.stateSchool,
          boardConfigurationId: ids.stateBoard,
          gradingScaleId: stateScale.id,
          code: "MAHARASHTRA-STATE",
          name: "Maharashtra State Board assessment rules",
          version: 1,
          rules: {
            calculation: {
              exemptHandling: "EXCLUDE",
              includeCoScholasticInPercentage: false,
              subjectAggregation: "TOTAL_MARKS",
              requireComponentPass: true,
              percentageScale: 2,
            },
            publication: { requireAllRegistersLocked: true },
          },
          effectiveFrom: date("2026-04-01"),
          createdBy: userId("school-admin"),
        },
      });
      const examination = await transaction.examination.upsert({
        where: {
          trustId_schoolId_academicYearId_campusId_code: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            academicYearId: ids.cbseAcademicYear,
            campusId: ids.cbsePuneCampus,
            code: "PT1",
          },
        },
        update: { state: "MARKS_ENTRY" },
        create: {
          id: "examination_cbse_pt1_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          academicYearId: ids.cbseAcademicYear,
          academicTermId: cbseTerm.id,
          ruleSetId: cbseRules.id,
          code: "PT1",
          name: "Periodic Test 1",
          examinationType: "Periodic Test",
          assessmentGroup: "Term 1 Scholastic",
          state: "MARKS_ENTRY",
          startsOn: date("2026-08-03"),
          endsOn: date("2026-08-14"),
          createdBy: userId("school-admin"),
        },
      });
      const examinationSubjects = [
        {
          id: "examination_subject_math_demo",
          subjectId: "subject_cbse_mathematics_demo",
          teacherUserId: userId("teacher"),
          order: 1,
          components: [
            ["IA", "Internal assessment", "INTERNAL_ASSESSMENT", 20, 7, 20],
            ["THEORY", "Theory examination", "THEORY", 80, 26, 80],
          ],
        },
        {
          id: "examination_subject_science_demo",
          subjectId: "subject_cbse_science_demo",
          teacherUserId: null,
          order: 2,
          components: [
            ["PROJECT", "Project", "PROJECT", 20, 7, 20],
            ["PRACTICAL", "Practical examination", "PRACTICAL", 20, 7, 20],
            ["VIVA", "Viva", "VIVA", 10, 3, 10],
            ["THEORY", "Theory examination", "THEORY", 50, 17, 50],
          ],
        },
      ] as const;
      for (const offering of examinationSubjects) {
        const subject = await transaction.examinationSubject.upsert({
          where: {
            trustId_schoolId_examinationId_sectionId_subjectId: {
              trustId: ids.trust,
              schoolId: ids.cbseSchool,
              examinationId: examination.id,
              sectionId: "section_cbse_pune_8a_demo",
              subjectId: offering.subjectId,
            },
          },
          update: {
            status: RecordStatus.ACTIVE,
            assignedTeacherUserId: offering.teacherUserId,
          },
          create: {
            id: offering.id,
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            campusId: ids.cbsePuneCampus,
            academicYearId: ids.cbseAcademicYear,
            examinationId: examination.id,
            sectionId: "section_cbse_pune_8a_demo",
            subjectId: offering.subjectId,
            assignedTeacherUserId: offering.teacherUserId,
            displayOrder: offering.order,
          },
        });
        for (const [
          code,
          name,
          kind,
          maximumMarks,
          passingMarks,
          weightage,
        ] of offering.components)
          await transaction.assessmentComponent.upsert({
            where: {
              trustId_schoolId_examinationSubjectId_code: {
                trustId: ids.trust,
                schoolId: ids.cbseSchool,
                examinationSubjectId: subject.id,
                code,
              },
            },
            update: { maximumMarks, passingMarks, weightagePercent: weightage },
            create: {
              id: `assessment_component_${offering.id}_${code.toLowerCase()}_demo`,
              trustId: ids.trust,
              schoolId: ids.cbseSchool,
              examinationSubjectId: subject.id,
              code,
              name,
              kind,
              maximumMarks,
              passingMarks,
              weightagePercent: weightage,
              displayOrder:
                offering.components.findIndex((item) => item[0] === code) + 1,
            },
          });
        await transaction.gradebookRegister.upsert({
          where: {
            trustId_schoolId_examinationSubjectId: {
              trustId: ids.trust,
              schoolId: ids.cbseSchool,
              examinationSubjectId: subject.id,
            },
          },
          update: {},
          create: {
            id: `gradebook_register_${offering.id}_demo`,
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            campusId: ids.cbsePuneCampus,
            academicYearId: ids.cbseAcademicYear,
            examinationSubjectId: subject.id,
          },
        });
      }
      await transaction.reportCardTemplate.upsert({
        where: {
          trustId_schoolId_code_version: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            code: "STANDARD",
            version: 1,
          },
        },
        update: { status: RecordStatus.ACTIVE },
        create: {
          id: "report_card_template_standard_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          academicYearId: ids.cbseAcademicYear,
          boardConfigurationId: ids.cbseBoard,
          code: "STANDARD",
          name: "Standard report card",
          version: 1,
          configuration: {
            sections: [
              "SCHOLASTIC",
              "CO_SCHOLASTIC",
              "ATTENDANCE",
              "REMARKS",
              "PROMOTION",
            ],
            showGradeLegend: true,
            showQrVerification: true,
          },
          branding: {
            schoolNameSource: "tenant",
            logoStorageKey: null,
            primaryColour: "#176B5B",
          },
          createdBy: userId("school-admin"),
        },
      });

      const enquiryForm = await transaction.admissionForm.upsert({
        where: {
          trustId_schoolId_academicYearId_kind_code_version: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            academicYearId: ids.cbseAcademicYear,
            kind: "ENQUIRY",
            code: "PUBLIC-ENQUIRY",
            version: 1,
          },
        },
        update: { status: "PUBLISHED", publishedAt: new Date() },
        create: {
          id: "admission_form_enquiry_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          academicYearId: ids.cbseAcademicYear,
          kind: "ENQUIRY",
          code: "PUBLIC-ENQUIRY",
          name: "Admission enquiry",
          version: 1,
          status: "PUBLISHED",
          publishedAt: new Date(),
          fields: {
            fields: [
              {
                key: "parentName",
                label: "Parent or guardian name",
                type: "text",
                required: true,
              },
              {
                key: "preferredContact",
                label: "Preferred contact method",
                type: "select",
                required: true,
                options: ["Email", "Mobile"],
              },
            ],
          },
        },
      });
      const applicationForm = await transaction.admissionForm.upsert({
        where: {
          trustId_schoolId_academicYearId_kind_code_version: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            academicYearId: ids.cbseAcademicYear,
            kind: "APPLICATION",
            code: "PUBLIC-APPLICATION",
            version: 1,
          },
        },
        update: { status: "PUBLISHED", publishedAt: new Date() },
        create: {
          id: "admission_form_application_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          academicYearId: ids.cbseAcademicYear,
          kind: "APPLICATION",
          code: "PUBLIC-APPLICATION",
          name: "Admission application",
          version: 1,
          status: "PUBLISHED",
          publishedAt: new Date(),
          fields: {
            fields: [
              {
                key: "parentName",
                label: "Parent or guardian name",
                type: "text",
                required: true,
              },
              {
                key: "currentSchool",
                label: "Current school",
                type: "text",
                required: false,
                helpText:
                  "Leave blank if the learner has not attended a school.",
              },
            ],
          },
        },
      });
      for (const entry of [
        {
          publicKey: "demo-enquiry-2026",
          formId: enquiryForm.id,
          kind: "ENQUIRY" as const,
        },
        {
          publicKey: "demo-application-2026",
          formId: applicationForm.id,
          kind: "APPLICATION" as const,
        },
      ]) {
        await transaction.admissionPublicFormDirectory.upsert({
          where: { publicKey: entry.publicKey },
          update: { formId: entry.formId, active: true },
          create: {
            ...entry,
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            academicYearId: ids.cbseAcademicYear,
          },
        });
      }
      await transaction.admissionSeatPlan.upsert({
        where: {
          trustId_schoolId_academicYearId_gradeClassId: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            academicYearId: ids.cbseAcademicYear,
            gradeClassId: "grade_cbse_8_demo",
          },
        },
        update: { capacity: 80, status: RecordStatus.ACTIVE },
        create: {
          id: "admission_seat_plan_grade_8_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          academicYearId: ids.cbseAcademicYear,
          gradeClassId: "grade_cbse_8_demo",
          capacity: 80,
        },
      });
      const seededApplication = await transaction.admissionApplication.upsert({
        where: {
          trustId_schoolId_referenceNumber: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            referenceNumber: "ADM-DEMO-0001",
          },
        },
        update: { stage: "UNDER_REVIEW" },
        create: {
          id: "admission_application_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          academicYearId: ids.cbseAcademicYear,
          formId: applicationForm.id,
          targetGradeClassId: "grade_cbse_8_demo",
          counselorUserId: userId("school-admin"),
          referenceNumber: "ADM-DEMO-0001",
          applicationNumber: "APP-DEMO-0001",
          stage: "UNDER_REVIEW",
          source: "SCHOOL_WEBSITE",
          applicantName: "Aarav Sample",
          dateOfBirth: date("2013-08-12"),
          email: "guardian.admission@example.test",
          emailHash:
            "855d664bd09838e84b21d7f146b2f13b3a970df5c122e5a623f19a3bd7c4a23b",
          feeAmountMinor: 150000,
          feeStatus: "PENDING",
          answers: {
            parentName: "Sample Guardian",
            currentSchool: "Fictional Learning Centre",
          },
        },
      });
      await transaction.admissionDocument.upsert({
        where: {
          trustId_schoolId_applicationId_code: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            applicationId: seededApplication.id,
            code: "BIRTH_CERTIFICATE",
          },
        },
        update: { label: "Birth certificate", status: "PENDING" },
        create: {
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          applicationId: seededApplication.id,
          code: "BIRTH_CERTIFICATE",
          label: "Birth certificate",
        },
      });
      const seededActivity = await transaction.admissionActivity.findFirst({
        where: {
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          applicationId: seededApplication.id,
          type: "APPLICATION_SEEDED",
        },
      });
      if (!seededActivity)
        await transaction.admissionActivity.create({
          data: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            applicationId: seededApplication.id,
            actorUserId: userId("school-admin"),
            type: "APPLICATION_SEEDED",
            toStage: "UNDER_REVIEW",
            metadata: { containsRealPersonalData: false },
          },
        });

      const tuitionCategory = await transaction.feeCategory.upsert({
        where: {
          trustId_schoolId_code: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            code: "ACADEMIC",
          },
        },
        update: { name: "Academic fees" },
        create: {
          id: "fee_category_academic_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          code: "ACADEMIC",
          name: "Academic fees",
        },
      });
      const tuitionHead = await transaction.feeHead.upsert({
        where: {
          trustId_schoolId_code: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            code: "TUITION",
          },
        },
        update: { name: "Tuition fee" },
        create: {
          id: "fee_head_tuition_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          categoryId: tuitionCategory.id,
          code: "TUITION",
          name: "Tuition fee",
          kind: "REGULAR",
        },
      });
      const transportHead = await transaction.feeHead.upsert({
        where: {
          trustId_schoolId_code: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            code: "TRANSPORT",
          },
        },
        update: { name: "Transport fee" },
        create: {
          id: "fee_head_transport_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          categoryId: tuitionCategory.id,
          code: "TRANSPORT",
          name: "Transport fee",
          kind: "TRANSPORT",
        },
      });
      const feeStructure = await transaction.feeStructure.upsert({
        where: {
          trustId_schoolId_academicYearId_gradeClassId_code_version: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            academicYearId: ids.cbseAcademicYear,
            gradeClassId: "grade_cbse_8_demo",
            code: "GRADE8_STANDARD",
            version: 1,
          },
        },
        update: { name: "Grade 8 standard fees" },
        create: {
          id: "fee_structure_grade8_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          academicYearId: ids.cbseAcademicYear,
          gradeClassId: "grade_cbse_8_demo",
          code: "GRADE8_STANDARD",
          name: "Grade 8 standard fees",
          version: 1,
          currency: "INR",
          createdBy: userId("accountant"),
        },
      });
      const firstInstallment = await transaction.feeInstallment.upsert({
        where: {
          trustId_schoolId_feeStructureId_code: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            feeStructureId: feeStructure.id,
            code: "TERM1",
          },
        },
        update: { name: "Term 1 installment", dueOn: date("2026-06-15") },
        create: {
          id: "fee_installment_term1_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          feeStructureId: feeStructure.id,
          code: "TERM1",
          name: "Term 1 installment",
          sequence: 1,
          dueOn: date("2026-06-15"),
        },
      });
      const tuitionLine = await transaction.feeStructureLine.upsert({
        where: {
          trustId_schoolId_feeStructureId_installmentId_feeHeadId: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            feeStructureId: feeStructure.id,
            installmentId: firstInstallment.id,
            feeHeadId: tuitionHead.id,
          },
        },
        update: { amountMinor: 2500000 },
        create: {
          id: "fee_line_tuition_term1_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          feeStructureId: feeStructure.id,
          installmentId: firstInstallment.id,
          feeHeadId: tuitionHead.id,
          amountMinor: 2500000,
        },
      });
      await transaction.feeStructureLine.upsert({
        where: {
          trustId_schoolId_feeStructureId_installmentId_feeHeadId: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            feeStructureId: feeStructure.id,
            installmentId: firstInstallment.id,
            feeHeadId: transportHead.id,
          },
        },
        update: { amountMinor: 600000, optional: true },
        create: {
          id: "fee_line_transport_term1_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          feeStructureId: feeStructure.id,
          installmentId: firstInstallment.id,
          feeHeadId: transportHead.id,
          amountMinor: 600000,
          optional: true,
        },
      });
      const seededAssignment = await transaction.studentFeeAssignment.upsert({
        where: {
          trustId_schoolId_academicYearId_studentProfileId_structureLineId: {
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            academicYearId: ids.cbseAcademicYear,
            studentProfileId: "student_profile_demo",
            structureLineId: tuitionLine.id,
          },
        },
        update: {
          amountMinor: tuitionLine.amountMinor,
          dueOn: firstInstallment.dueOn,
        },
        create: {
          id: "student_fee_assignment_tuition_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          academicYearId: ids.cbseAcademicYear,
          studentProfileId: "student_profile_demo",
          enrollmentId: "student_enrollment_demo_2026_27",
          sectionId: "section_cbse_pune_8a_demo",
          feeStructureId: feeStructure.id,
          structureLineId: tuitionLine.id,
          installmentId: firstInstallment.id,
          feeHeadId: tuitionHead.id,
          source: "CLASS",
          description: "Grade 8 Term 1 tuition",
          amountMinor: tuitionLine.amountMinor,
          dueOn: firstInstallment.dueOn,
          createdBy: userId("accountant"),
        },
      });
      const seededFeeAudit = await transaction.financialAuditEntry.findUnique({
        where: { id: "financial_audit_seed_fee_demo" },
      });
      if (!seededFeeAudit)
        await transaction.financialAuditEntry.create({
          data: {
            id: "financial_audit_seed_fee_demo",
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            campusId: ids.cbsePuneCampus,
            academicYearId: ids.cbseAcademicYear,
            studentProfileId: "student_profile_demo",
            direction: "DEBIT",
            amountMinor: seededAssignment.amountMinor,
            currency: "INR",
            action: "fee.assigned",
            resourceType: "StudentFeeAssignment",
            resourceId: seededAssignment.id,
            correlationId: "seed-demo-fees",
            actorUserId: userId("accountant"),
            metadata: { containsRealPersonalData: false },
          },
        });

      const dashboardItems = [
        {
          id: "dashboard_admin_alert_demo",
          audience: "SCHOOL_ADMIN",
          kind: "OPERATIONAL_ALERT",
          title: "Two attendance registers await locking",
          description: "Review the open registers before the daily cutoff.",
          dueAt: new Date("2026-09-02T16:00:00+05:30"),
          linkHref: "/attendance",
        },
        {
          id: "dashboard_principal_approval_demo",
          audience: "PRINCIPAL",
          kind: "TASK",
          title: "Review pending academic approvals",
          description:
            "Moderation and concession queues contain items requiring independent review.",
          dueAt: new Date("2026-09-03T12:00:00+05:30"),
          linkHref: "/examinations",
        },
        {
          id: "dashboard_teacher_timetable_demo",
          audience: "TEACHER",
          kind: "TIMETABLE",
          title: "Mathematics · Grade 8 A",
          description: "Room 8A · Period 2",
          startsAt: new Date("2026-09-03T09:30:00+05:30"),
          endsAt: new Date("2026-09-03T10:15:00+05:30"),
          teacherUserId: userId("teacher"),
          sectionId: "section_cbse_pune_8a_demo",
          linkHref: "/attendance",
        },
        {
          id: "dashboard_teacher_lesson_demo",
          audience: "TEACHER",
          kind: "LESSON_PLAN",
          title: "Prepare linear equations lesson plan",
          description:
            "Attach objectives and the formative assessment activity.",
          dueAt: new Date("2026-09-04T17:00:00+05:30"),
          teacherUserId: userId("teacher"),
          sectionId: "section_cbse_pune_8a_demo",
        },
        {
          id: "dashboard_teacher_marks_demo",
          audience: "TEACHER",
          kind: "TASK",
          title: "Complete periodic assessment marks",
          description:
            "Marks entry remains open for the assigned Mathematics register.",
          dueAt: new Date("2026-09-05T15:00:00+05:30"),
          teacherUserId: userId("teacher"),
          sectionId: "section_cbse_pune_8a_demo",
          linkHref: "/examinations",
        },
        {
          id: "dashboard_student_homework_demo",
          audience: "STUDENT",
          kind: "HOMEWORK",
          title: "Mathematics practice set 4",
          description: "Complete questions 1–12 in the assigned notebook.",
          dueAt: new Date("2026-09-05T08:30:00+05:30"),
          studentProfileId: "student_profile_demo",
          sectionId: "section_cbse_pune_8a_demo",
        },
        {
          id: "dashboard_parent_homework_demo",
          audience: "PARENT",
          kind: "HOMEWORK",
          title: "Mathematics practice set 4",
          description: "Due before the first period on 5 September.",
          dueAt: new Date("2026-09-05T08:30:00+05:30"),
          studentProfileId: "student_profile_demo",
          sectionId: "section_cbse_pune_8a_demo",
        },
        {
          id: "dashboard_student_resource_demo",
          audience: "STUDENT",
          kind: "LEARNING_RESOURCE",
          title: "Linear equations revision guide",
          description:
            "Teacher-curated revision notes for the next assessment.",
          studentProfileId: "student_profile_demo",
          sectionId: "section_cbse_pune_8a_demo",
        },
        {
          id: "dashboard_student_timetable_demo",
          audience: "STUDENT",
          kind: "TIMETABLE",
          title: "Mathematics · Period 2",
          description: "Room 8A",
          startsAt: new Date("2026-09-03T09:30:00+05:30"),
          endsAt: new Date("2026-09-03T10:15:00+05:30"),
          studentProfileId: "student_profile_demo",
          sectionId: "section_cbse_pune_8a_demo",
        },
        {
          id: "dashboard_parent_meeting_demo",
          audience: "PARENT",
          kind: "TEACHER_MEETING",
          title: "Class teacher meeting request",
          description: "Requested slot: 7 September, 3:30 pm.",
          startsAt: new Date("2026-09-07T15:30:00+05:30"),
          studentProfileId: "student_profile_demo",
          teacherUserId: userId("teacher"),
          sectionId: "section_cbse_pune_8a_demo",
        },
        {
          id: "dashboard_student_announcement_demo",
          audience: "STUDENT",
          kind: "ANNOUNCEMENT",
          title: "Library orientation this Friday",
          description:
            "Grade 8 learners should report to the library after lunch.",
          startsAt: new Date("2026-09-04T13:30:00+05:30"),
          studentProfileId: "student_profile_demo",
          sectionId: "section_cbse_pune_8a_demo",
        },
        {
          id: "dashboard_parent_announcement_demo",
          audience: "PARENT",
          kind: "ANNOUNCEMENT",
          title: "Parent orientation circular",
          description:
            "The synthetic campus orientation is scheduled for 12 September.",
          startsAt: new Date("2026-09-12T10:00:00+05:30"),
          studentProfileId: "student_profile_demo",
          sectionId: "section_cbse_pune_8a_demo",
        },
        {
          id: "dashboard_accountant_reconcile_demo",
          audience: "ACCOUNTANT",
          kind: "TASK",
          title: "Review unmatched simulated gateway event",
          description:
            "One local-provider event is ready for reconciliation review.",
          dueAt: new Date("2026-09-02T15:00:00+05:30"),
          linkHref: "/fees",
        },
      ] as const;
      for (const item of dashboardItems) {
        await transaction.dashboardFeedItem.upsert({
          where: { id: item.id },
          update: {
            title: item.title,
            description: item.description,
            startsAt: "startsAt" in item ? item.startsAt : null,
            endsAt: "endsAt" in item ? item.endsAt : null,
            dueAt: "dueAt" in item ? item.dueAt : null,
            linkHref: "linkHref" in item ? item.linkHref : null,
            status: RecordStatus.ACTIVE,
            archivedAt: null,
          },
          create: {
            ...item,
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            campusId: ids.cbsePuneCampus,
            academicYearId: ids.cbseAcademicYear,
            createdBy: userId("school-admin"),
          },
        });
      }

      for (const [index, module] of operationalModules.entries()) {
        const sequence = String(index + 1).padStart(2, "0");
        const recordId = `operational_${module.slug.replaceAll("-", "_")}_demo`;
        const referenceNumber = `OPS-${sequence}`;
        const record = await transaction.operationalRecord.upsert({
          where: { id: recordId },
          update: {
            title: `Synthetic ${module.title} work item`,
            recordType: module.recordTypes[0]!.key,
            sensitivity: module.sensitivity,
            state: "ACTIVE",
            archivedAt: null,
            updatedBy: userId("school-admin"),
          },
          create: {
            id: recordId,
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            campusId: ids.cbsePuneCampus,
            academicYearId: ids.cbseAcademicYear,
            module: module.key,
            recordType: module.recordTypes[0]!.key,
            referenceNumber,
            title: `Synthetic ${module.title} work item`,
            summary:
              module.sensitivity === "STANDARD"
                ? "Fictional demonstration metadata with no personal information."
                : undefined,
            state: "ACTIVE",
            sensitivity: module.sensitivity,
            details:
              module.sensitivity === "STANDARD"
                ? { synthetic: "true" }
                : undefined,
            createdBy: userId("school-admin"),
            updatedBy: userId("school-admin"),
          },
        });
        await transaction.operationalRecordEvent.upsert({
          where: { id: `${recordId}_created_event` },
          update: {},
          create: {
            id: `${recordId}_created_event`,
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            recordId: record.id,
            module: module.key,
            action: "seed.created",
            toState: record.state,
            changes: { containsRealPersonalData: false },
            actorUserId: userId("school-admin"),
          },
        });
      }

      const assistanceRecord = await transaction.aiAssistanceRecord.upsert({
        where: { id: "ai_assistance_lesson_plan_demo" },
        update: {
          draftOutput:
            "Draft for teacher review: check prior knowledge, model the objective, guide practice, and close with an exit check. Generated locally and not published.",
          fallbackOutput:
            "Non-AI template: objective, prior-knowledge check, guided practice, independent practice, and exit check.",
          status: "DRAFT",
          reviewedBy: null,
          reviewerNote: null,
          reviewedAt: null,
        },
        create: {
          id: "ai_assistance_lesson_plan_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          campusId: ids.cbsePuneCampus,
          academicYearId: ids.cbseAcademicYear,
          feature: "LESSON_PLAN_OUTLINE",
          provider: "LOCAL_MOCK",
          providerVersion: "local-mock-2026-09-01",
          inputSnapshot: {
            feature: "LESSON_PLAN_OUTLINE",
            context: {
              topic: "Linear equations",
              objective: "Solve one-step equations",
            },
          },
          inputHash: "0".repeat(64),
          draftOutput:
            "Draft for teacher review: check prior knowledge, model the objective, guide practice, and close with an exit check. Generated locally and not published.",
          fallbackOutput:
            "Non-AI template: objective, prior-knowledge check, guided practice, independent practice, and exit check.",
          createdBy: userId("teacher"),
        },
      });
      await transaction.aiAssistanceAuditEvent.upsert({
        where: { id: "ai_assistance_lesson_plan_created_demo" },
        update: {},
        create: {
          id: "ai_assistance_lesson_plan_created_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          assistanceRecordId: assistanceRecord.id,
          action: "DRAFT_CREATED",
          providerVersion: assistanceRecord.providerVersion,
          inputHash: assistanceRecord.inputHash,
          outputHash: "1".repeat(64),
          actorUserId: userId("teacher"),
        },
      });

      const supportIndicator = await transaction.studentSupportIndicator.upsert(
        {
          where: { id: "support_indicator_attendance_demo" },
          update: {
            factors: [
              {
                key: "recorded_attendance_rate",
                label: "Recorded attendance",
                value: 72.5,
                explanation:
                  "Eight synthetic attendance records were included; authorised staff must verify approved leave and source data.",
              },
            ],
            status: "OPEN",
            reviewedBy: null,
            reviewerNote: null,
            reviewedAt: null,
          },
          create: {
            id: "support_indicator_attendance_demo",
            trustId: ids.trust,
            schoolId: ids.cbseSchool,
            campusId: ids.cbsePuneCampus,
            academicYearId: ids.cbseAcademicYear,
            studentProfileId: "student_profile_demo",
            ruleKey: "attendance.human_review",
            ruleVersion: "2026-09-01.1",
            observedOn: new Date("2026-09-01T00:00:00.000Z"),
            inputSnapshot: {
              totalRecords: 8,
              presentFractionTotal: 58000,
              thresholdBasisPoints: 7500,
            },
            factors: [
              {
                key: "recorded_attendance_rate",
                label: "Recorded attendance",
                value: 72.5,
                explanation:
                  "Eight synthetic attendance records were included; authorised staff must verify approved leave and source data.",
              },
            ],
            reasonSummary:
              "Recorded attendance is below the staff-configured review threshold. This is not a prediction or decision.",
          },
        },
      );
      await transaction.studentSupportIndicatorEvent.upsert({
        where: { id: "support_indicator_attendance_created_demo" },
        update: {},
        create: {
          id: "support_indicator_attendance_created_demo",
          trustId: ids.trust,
          schoolId: ids.cbseSchool,
          indicatorId: supportIndicator.id,
          action: "INDICATOR_CREATED",
          toStatus: "OPEN",
          note: "Synthetic transparent-rule example requiring human verification.",
          factors: supportIndicator.factors as Prisma.InputJsonValue,
          actorUserId: userId("school-admin"),
        },
      });

      const existingSeedAudit = await transaction.auditEvent.findUnique({
        where: { id: "audit_seed_completed_demo" },
      });
      if (!existingSeedAudit) {
        await transaction.auditEvent.create({
          data: {
            id: "audit_seed_completed_demo",
            trustId: ids.trust,
            actorUserId: userId("trust-admin"),
            action: "platform.seed.complete",
            resourceType: "Trust",
            resourceId: ids.trust,
            outcome: "SUCCEEDED",
            correlationId: "seed-demo-foundation",
            metadata: {
              source: "prisma-seed",
              containsRealPersonalData: false,
            },
          },
        });
      }
    },
    { maxWait: 30_000, timeout: 5 * 60_000 },
  );
}

async function main() {
  await seedGlobalData();
  await seedTenantData();
  console.info(
    "Seeded fictional NASAQ demo organizations and role representatives.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Seed failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
