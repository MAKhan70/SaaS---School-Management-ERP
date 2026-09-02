import type {
  OperationalModuleKey,
  OperationalSensitivity,
} from "@/generated/prisma";

export const operationalModuleSlugs = [
  "timetable",
  "homework",
  "lesson-planning",
  "library",
  "transport",
  "hostel",
  "hr",
  "leave",
  "payroll",
  "health",
  "visitors",
  "reception",
  "inventory",
  "certificates",
  "alumni",
  "communications",
  "events",
  "activities",
  "discipline",
  "documents",
  "support",
] as const;

export type OperationalModuleSlug = (typeof operationalModuleSlugs)[number];

export type OperationalModuleDefinition = {
  slug: OperationalModuleSlug;
  key: OperationalModuleKey;
  title: string;
  purpose: string;
  readPermission: string;
  managePermission: string;
  sensitivity: OperationalSensitivity;
  recordTypes: readonly { key: string; label: string }[];
  reports: readonly string[];
};

const types = (...entries: readonly [string, string][]) =>
  entries.map(([key, label]) => ({ key, label }));

export const operationalModules: readonly OperationalModuleDefinition[] = [
  {
    slug: "timetable",
    key: "TIMETABLE",
    title: "Timetable and substitutions",
    purpose: "Schedule classes, rooms, teachers, and dated substitutions.",
    readPermission: "timetable.schedule.read",
    managePermission: "timetable.schedule.manage",
    sensitivity: "STANDARD",
    recordTypes: types(
      ["SCHEDULE_VERSION", "Schedule version"],
      ["SUBSTITUTION", "Substitution"],
    ),
    reports: ["Teacher workload", "Room utilisation", "Substitution coverage"],
  },
  {
    slug: "homework",
    key: "HOMEWORK",
    title: "Homework and assignments",
    purpose: "Publish class work and monitor submission and review queues.",
    readPermission: "homework.assignment.read",
    managePermission: "homework.assignment.manage",
    sensitivity: "STANDARD",
    recordTypes: types(
      ["ASSIGNMENT", "Assignment"],
      ["EXTENSION", "Extension request"],
    ),
    reports: ["Completion", "Overdue work", "Review turnaround"],
  },
  {
    slug: "lesson-planning",
    key: "LESSON_PLANNING",
    title: "Lesson planning and syllabus",
    purpose: "Plan instruction and track versioned syllabus coverage.",
    readPermission: "lesson.plan.read",
    managePermission: "lesson.plan.manage",
    sensitivity: "STANDARD",
    recordTypes: types(
      ["LESSON_PLAN", "Lesson plan"],
      ["COVERAGE", "Coverage entry"],
    ),
    reports: ["Planned versus delivered", "Coverage gaps", "Approval ageing"],
  },
  {
    slug: "library",
    key: "LIBRARY",
    title: "Library",
    purpose:
      "Manage catalogue, circulation, reservations, and accountable adjustments.",
    readPermission: "library.catalogue.read",
    managePermission: "library.circulation.manage",
    sensitivity: "SENSITIVE",
    recordTypes: types(
      ["CATALOGUE_ITEM", "Catalogue item"],
      ["CIRCULATION_CASE", "Circulation case"],
    ),
    reports: ["Overdue loans", "Circulation", "Inventory variance"],
  },
  {
    slug: "transport",
    key: "TRANSPORT",
    title: "Transport",
    purpose: "Coordinate routes, riders, vehicles, and safe trip operations.",
    readPermission: "transport.route.read",
    managePermission: "transport.operations.manage",
    sensitivity: "RESTRICTED",
    recordTypes: types(
      ["ROUTE_VERSION", "Route version"],
      ["TRIP", "Trip operation"],
    ),
    reports: ["Capacity", "Punctuality", "Ridership"],
  },
  {
    slug: "hostel",
    key: "HOSTEL",
    title: "Hostel",
    purpose:
      "Manage allocations, roll calls, leave, and residential operations.",
    readPermission: "hostel.allocation.read",
    managePermission: "hostel.operations.manage",
    sensitivity: "RESTRICTED",
    recordTypes: types(
      ["BED_ALLOCATION", "Bed allocation"],
      ["ROLL_CALL", "Roll call"],
    ),
    reports: ["Occupancy", "Absence", "Leave"],
  },
  {
    slug: "hr",
    key: "HR",
    title: "HR and staff records",
    purpose: "Maintain effective employment and compliance work queues.",
    readPermission: "hr.staff.read",
    managePermission: "hr.staff.manage",
    sensitivity: "RESTRICTED",
    recordTypes: types(
      ["EMPLOYMENT_CASE", "Employment case"],
      ["COMPLIANCE_ITEM", "Compliance item"],
    ),
    reports: ["Headcount", "Contract expiry", "Compliance gaps"],
  },
  {
    slug: "leave",
    key: "LEAVE",
    title: "Leave management",
    purpose:
      "Process requests, approvals, policy work, and balance corrections.",
    readPermission: "leave.team.read",
    managePermission: "leave.request.approve",
    sensitivity: "SENSITIVE",
    recordTypes: types(
      ["LEAVE_REQUEST", "Leave request"],
      ["POLICY_CHANGE", "Policy change"],
    ),
    reports: ["Usage", "Balances", "Approval ageing"],
  },
  {
    slug: "payroll",
    key: "PAYROLL",
    title: "Payroll integration",
    purpose: "Prepare and approve immutable payroll integration inputs.",
    readPermission: "payroll.input.read",
    managePermission: "payroll.input.manage",
    sensitivity: "RESTRICTED",
    recordTypes: types(
      ["PAY_PERIOD", "Pay period"],
      ["EXPORT_RUN", "Export run"],
    ),
    reports: ["Input variance", "Validation issues", "Period totals"],
  },
  {
    slug: "health",
    key: "HEALTH",
    title: "Health and infirmary",
    purpose:
      "Coordinate purpose-bound health work without exposing clinical details.",
    readPermission: "health.records.read",
    managePermission: "health.records.manage",
    sensitivity: "RESTRICTED",
    recordTypes: types(
      ["VISIT_CASE", "Infirmary visit"],
      ["MEDICATION_TASK", "Medication task"],
    ),
    reports: ["De-identified visits", "Follow-up due", "Medication exceptions"],
  },
  {
    slug: "visitors",
    key: "VISITORS",
    title: "Visitor management",
    purpose: "Approve, admit, badge, and check out visitors safely.",
    readPermission: "visitors.visit.read",
    managePermission: "visitors.visit.manage",
    sensitivity: "SENSITIVE",
    recordTypes: types(
      ["VISIT_REQUEST", "Visit request"],
      ["ACTIVE_VISIT", "Active visit"],
    ),
    reports: ["Visit volume", "Overstays", "Denied entry"],
  },
  {
    slug: "reception",
    key: "RECEPTION",
    title: "Front desk and reception",
    purpose:
      "Coordinate appointments, hand-offs, deliveries, and pickup checks.",
    readPermission: "reception.queue.read",
    managePermission: "reception.queue.manage",
    sensitivity: "SENSITIVE",
    recordTypes: types(
      ["RECEPTION_TICKET", "Reception ticket"],
      ["DELIVERY", "Delivery"],
    ),
    reports: ["Request volume", "Wait time", "Unresolved hand-offs"],
  },
  {
    slug: "inventory",
    key: "INVENTORY",
    title: "Inventory and assets",
    purpose:
      "Track assets, custody, stock movement, maintenance, and disposal.",
    readPermission: "inventory.item.read",
    managePermission: "inventory.item.manage",
    sensitivity: "STANDARD",
    recordTypes: types(
      ["ASSET", "Asset"],
      ["STOCK_TRANSACTION", "Stock transaction"],
    ),
    reports: ["Stock on hand", "Custody", "Maintenance due"],
  },
  {
    slug: "certificates",
    key: "CERTIFICATES",
    title: "Certificate generation",
    purpose: "Approve, issue, verify, revoke, and reissue certificates.",
    readPermission: "certificates.request.manage",
    managePermission: "certificates.issue.manage",
    sensitivity: "SENSITIVE",
    recordTypes: types(
      ["CERTIFICATE_REQUEST", "Certificate request"],
      ["ISSUANCE", "Issuance"],
    ),
    reports: ["Turnaround", "Issuance", "Revocation"],
  },
  {
    slug: "alumni",
    key: "ALUMNI",
    title: "Alumni",
    purpose: "Manage consent-based alumni engagement and service requests.",
    readPermission: "alumni.profile.read",
    managePermission: "alumni.profile.manage",
    sensitivity: "SENSITIVE",
    recordTypes: types(
      ["ALUMNI_REQUEST", "Alumni request"],
      ["ENGAGEMENT", "Engagement"],
    ),
    reports: ["Consent", "Engagement", "Cohort participation"],
  },
  {
    slug: "communications",
    key: "COMMUNICATIONS",
    title: "Announcements and communications",
    purpose: "Draft and approve targeted adapter-backed communications.",
    readPermission: "communications.message.read",
    managePermission: "communications.message.manage",
    sensitivity: "STANDARD",
    recordTypes: types(
      ["ANNOUNCEMENT", "Announcement"],
      ["CAMPAIGN", "Communication campaign"],
    ),
    reports: ["Audience", "Delivery outcomes", "Opt-outs"],
  },
  {
    slug: "events",
    key: "EVENTS",
    title: "Events and school calendar",
    purpose: "Plan, publish, register, and close school events.",
    readPermission: "events.calendar.read",
    managePermission: "events.calendar.manage",
    sensitivity: "STANDARD",
    recordTypes: types(
      ["EVENT", "Event"],
      ["RESOURCE_BOOKING", "Resource booking"],
    ),
    reports: ["Registration", "Attendance", "Resource utilisation"],
  },
  {
    slug: "activities",
    key: "ACTIVITIES",
    title: "Clubs, houses, and activities",
    purpose: "Coordinate programmes, membership, competitions, and points.",
    readPermission: "activities.program.read",
    managePermission: "activities.program.manage",
    sensitivity: "SENSITIVE",
    recordTypes: types(
      ["PROGRAMME", "Programme"],
      ["MEMBERSHIP", "Membership case"],
    ),
    reports: ["Participation", "Capacity", "House points"],
  },
  {
    slug: "discipline",
    key: "DISCIPLINE",
    title: "Discipline and incidents",
    purpose: "Operate restricted, safeguarding-aware incident workflows.",
    readPermission: "discipline.incident.read",
    managePermission: "discipline.incident.manage",
    sensitivity: "RESTRICTED",
    recordTypes: types(
      ["INCIDENT", "Incident"],
      ["ACTION_REVIEW", "Action review"],
    ),
    reports: ["De-identified trends", "Action timeliness", "Appeals"],
  },
  {
    slug: "documents",
    key: "DOCUMENTS",
    title: "Document management",
    purpose:
      "Track private document intake, scanning, classification, and retention.",
    readPermission: "documents.file.read",
    managePermission: "documents.file.manage",
    sensitivity: "RESTRICTED",
    recordTypes: types(
      ["DOCUMENT_INTAKE", "Document intake"],
      ["RETENTION_REVIEW", "Retention review"],
    ),
    reports: ["Quarantine", "Retention due", "Classification"],
  },
  {
    slug: "support",
    key: "SUPPORT",
    title: "Help desk and support",
    purpose:
      "Route, prioritize, resolve, and measure internal support requests.",
    readPermission: "support.ticket.read",
    managePermission: "support.ticket.manage",
    sensitivity: "SENSITIVE",
    recordTypes: types(
      ["SUPPORT_TICKET", "Support ticket"],
      ["SLA_REVIEW", "SLA review"],
    ),
    reports: ["Volume", "Resolution time", "SLA breaches"],
  },
];

export function operationalModule(
  slug: string,
): OperationalModuleDefinition | undefined {
  return operationalModules.find((module) => module.slug === slug);
}

export function visibleOperationalModules(permissionKeys: readonly string[]) {
  const granted = new Set(permissionKeys);
  return operationalModules.filter((module) =>
    granted.has(module.readPermission),
  );
}
