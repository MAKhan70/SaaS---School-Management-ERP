import { describe, expect, it } from "vitest";

import { SupabaseFunctionInviteDelivery } from "@/modules/platform-admin/application/invite-delivery";
import {
  featureForPermission,
  tenantFeatures,
} from "@/modules/platform-admin/domain/feature-catalogue";
import {
  clientProvisionSchema,
  supportAccessSchema,
} from "@/modules/platform-admin/domain/platform-admin-contracts";

const validClient = {
  trustName: "Fictional Learning Trust",
  trustSlug: "fictional-learning",
  schoolName: "Fictional Public School",
  schoolCode: "FPS",
  campusName: "Central Campus",
  campusCode: "CENTRAL",
  academicYearName: "Academic Year 2026–27",
  academicYearCode: "AY-2026-27",
  academicYearStartsOn: "2026-04-01",
  academicYearEndsOn: "2027-03-31",
  boardType: "CBSE",
  administratorFirstName: "Aarav",
  administratorLastName: "Mehta",
  administratorEmail: "admin@example.test",
  administratorPhone: "+919876543210",
  featureKeys: tenantFeatures.map((feature) => feature.key),
};

describe("platform administration contracts", () => {
  it("maps tenant permission families to stable feature keys", () => {
    expect(featureForPermission("students.profile.read")).toBe("students");
    expect(featureForPermission("finance.payments.collect")).toBe("fees");
    expect(featureForPermission("timetable.schedule.read")).toBe("operations");
  });

  it("accepts a complete synthetic client and rejects malformed phone numbers", () => {
    expect(clientProvisionSchema.safeParse(validClient).success).toBe(true);
    expect(
      clientProvisionSchema.safeParse({
        ...validClient,
        administratorPhone: "9876",
      }).success,
    ).toBe(false);
  });

  it("caps support access at sixty minutes and requires a reason", () => {
    expect(
      supportAccessSchema.safeParse({
        reason: "Verify client configuration",
        durationMinutes: 60,
      }).success,
    ).toBe(true);
    expect(
      supportAccessSchema.safeParse({ reason: "test", durationMinutes: 61 })
        .success,
    ).toBe(false);
  });

  it("does not attempt invitation delivery without server-only Supabase credentials", async () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(
      new SupabaseFunctionInviteDelivery().send({
        email: "admin@example.test",
        firstName: "Aarav",
        trustName: "Fictional Learning Trust",
        activationUrl: "https://erp.example.test/activate-account",
      }),
    ).resolves.toBe("NOT_CONFIGURED");
    if (previousUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (previousKey) process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
});
