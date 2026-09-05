import { describe, expect, it } from "vitest";

import { navigationForPermissions } from "@/config/navigation";

describe("permission-aware navigation", () => {
  it("shows only entries backed by effective permission keys", () => {
    const labels = navigationForPermissions([
      "platform.dashboard.read",
      "attendance.session.read",
    ]).map((item) => item.label);

    expect(labels).toContain("Overview");
    expect(labels).toContain("Attendance");
    expect(labels).not.toContain("Fees");
    expect(labels).not.toContain("Staff & HR");
  });

  it("links the implemented Institutions workflow without a roadmap marker", () => {
    const item = navigationForPermissions(["institutions.school.manage"]).find(
      ({ label }) => label === "Institutions",
    );

    expect(item).toMatchObject({ href: "/institutions" });
    expect(item?.status).toBeUndefined();
  });

  it("links existing specialist workspaces instead of showing placeholders", () => {
    const items = navigationForPermissions([
      "hr.staff.manage",
      "library.circulation.manage",
      "transport.operations.manage",
      "health.records.read",
    ]);

    expect(items.map(({ href }) => href)).toEqual([
      "/operations/hr",
      "/operations/library",
      "/operations/transport",
      "/operations/health",
    ]);
    expect(items.every(({ status }) => status === undefined)).toBe(true);
  });
});
