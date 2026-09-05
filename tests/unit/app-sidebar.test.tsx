import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-sidebar";

const navigationState = vi.hoisted(() => ({ pathname: "/students" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

describe("application sidebar", () => {
  beforeEach(() => {
    navigationState.pathname = "/students";
  });

  it("marks only the current destination as active", () => {
    render(
      <AppSidebar
        permissionKeys={["platform.dashboard.read", "students.profile.read"]}
        trustName="Fictional Learning Trust"
      />,
    );

    expect(screen.getByRole("link", { name: "Students" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("filters available features without changing authorization", async () => {
    const user = userEvent.setup();
    render(
      <AppSidebar
        permissionKeys={["platform.dashboard.read", "students.profile.read"]}
        trustName="Fictional Learning Trust"
      />,
    );

    await user.type(
      screen.getByRole("searchbox", { name: "Find a feature" }),
      "stud",
    );
    expect(screen.getByRole("link", { name: "Students" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
  });

  it("keeps the specialist workspace active instead of the operations index", () => {
    navigationState.pathname = "/operations/hr";
    render(
      <AppSidebar
        permissionKeys={["operations.portfolio.read", "hr.staff.manage"]}
        trustName="Fictional Learning Trust"
      />,
    );

    expect(screen.getByRole("link", { name: "Staff & HR" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Operations" }),
    ).not.toHaveAttribute("aria-current");
  });
});
