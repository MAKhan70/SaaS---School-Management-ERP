import { describe, expect, it } from "vitest";

import {
  academicYearsOverlap,
  csvTemplate,
  institutionProfileMutationSchema,
  schoolSetupMutationSchema,
} from "@/modules/academic-structure/domain/school-setup-contracts";

describe("school setup contracts", () => {
  it("detects inclusive academic-year overlap", () => {
    const current = {
      startsOn: new Date("2026-04-01"),
      endsOn: new Date("2027-03-31"),
    };
    expect(
      academicYearsOverlap(current, {
        startsOn: new Date("2027-03-31"),
        endsOn: new Date("2028-03-30"),
      }),
    ).toBe(true);
    expect(
      academicYearsOverlap(current, {
        startsOn: new Date("2027-04-01"),
        endsOn: new Date("2028-03-31"),
      }),
    ).toBe(false);
  });

  it("validates configured names instead of supplying class or subject names", () => {
    const parsed = schoolSetupMutationSchema.parse({
      action: "catalog.create",
      kind: "subject",
      code: "SUB-LOCAL",
      name: "Tenant configured subject",
    });
    expect(parsed).toMatchObject({
      action: "catalog.create",
      kind: "subject",
      name: "Tenant configured subject",
    });
  });

  it("rejects an invalid calendar date and produces neutral CSV templates", () => {
    expect(
      schoolSetupMutationSchema.safeParse({
        action: "calendar.create",
        academicYearId: "year-a",
        date: "31/04/2027",
        type: "HOLIDAY",
        name: "Configured holiday",
      }).success,
    ).toBe(false);
    expect(csvTemplate("subjects")).toBe("code,name,departmentId\n");
  });

  it("validates bounded institution profile settings", () => {
    expect(
      institutionProfileMutationSchema.safeParse({
        action: "profile.update",
        resource: "trust",
        resourceId: "trust-a",
        name: "Fictional Learning Trust",
        defaultLocale: "en-IN",
        defaultTimezone: "Asia/Kolkata",
        defaultCurrency: "INR",
      }).success,
    ).toBe(true);
    expect(
      institutionProfileMutationSchema.safeParse({
        action: "profile.update",
        resource: "trust",
        resourceId: "trust-a",
        name: "Fictional Learning Trust",
        defaultCurrency: "rupees",
      }).success,
    ).toBe(false);
  });
});
