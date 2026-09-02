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
});
