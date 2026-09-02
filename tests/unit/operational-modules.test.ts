import { describe, expect, it } from "vitest";

import { canTransitionOperationalRecord } from "@/modules/operations/application/operational-service";
import {
  operationalModules,
  visibleOperationalModules,
} from "@/modules/operations/domain/operational-catalogue";
import { operationalMutationSchema } from "@/modules/operations/domain/operational-contracts";

describe("operational module portfolio", () => {
  it("registers every requested business module with unique keys and permissions", () => {
    expect(operationalModules).toHaveLength(21);
    expect(new Set(operationalModules.map((item) => item.slug)).size).toBe(21);
    expect(new Set(operationalModules.map((item) => item.key)).size).toBe(21);
    expect(
      new Set(operationalModules.map((item) => item.readPermission)).size,
    ).toBe(21);
    for (const definition of operationalModules) {
      expect(definition.recordTypes.length).toBeGreaterThan(0);
      expect(definition.reports.length).toBeGreaterThan(0);
      expect(definition.readPermission).toMatch(/^[a-z]+\.[a-z]+\.[a-z]+$/);
      expect(definition.managePermission).toMatch(/^[a-z]+\.[a-z]+\.[a-z]+$/);
    }
  });

  it("shows only modules with an explicit read grant", () => {
    const visible = visibleOperationalModules([
      "library.catalogue.read",
      "support.ticket.read",
      "library.circulation.manage",
    ]);
    expect(visible.map((item) => item.slug)).toEqual(["library", "support"]);
  });

  it("enforces forward-only reviewed transitions and terminal archival", () => {
    expect(canTransitionOperationalRecord("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransitionOperationalRecord("PENDING_APPROVAL", "APPROVED")).toBe(
      true,
    );
    expect(canTransitionOperationalRecord("COMPLETED", "DRAFT")).toBe(false);
    expect(canTransitionOperationalRecord("ARCHIVED", "ACTIVE")).toBe(false);
  });

  it("validates dates, stable references, and transition reasons", () => {
    expect(() =>
      operationalMutationSchema.parse({
        action: "create",
        recordType: "EVENT",
        referenceNumber: "bad reference",
        title: "Synthetic event",
      }),
    ).toThrow();
    expect(() =>
      operationalMutationSchema.parse({
        action: "create",
        recordType: "EVENT",
        referenceNumber: "EVT-001",
        title: "Synthetic event",
        effectiveFrom: "2026-09-10",
        effectiveTo: "2026-09-01",
      }),
    ).toThrow();
    expect(() =>
      operationalMutationSchema.parse({
        action: "transition",
        recordId: "record-a",
        expectedVersion: 1,
        toState: "ACTIVE",
        reason: "no",
      }),
    ).toThrow();
  });
});
