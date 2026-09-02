import { Bell, ChevronDown, Menu } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AuthenticatedContext } from "@/modules/identity/application/auth-service";
import { SchoolContextSelector } from "@/components/school-context-selector";
import Link from "next/link";
import type { Route } from "next";

export function AppHeader({ context }: { context: AuthenticatedContext }) {
  return (
    <header className="app-header">
      <details className="mobile-menu">
        <summary className="icon-button" aria-label="Open navigation">
          <Menu size={20} />
        </summary>
        <div className="mobile-drawer">
          <AppSidebar
            permissionKeys={context.permissionKeys}
            onMobile
            trustName={context.trustName}
          />
        </div>
      </details>
      <div className="mobile-brand">
        <Brand compact />
      </div>
      <SchoolContextSelector
        trustId={context.trustId}
        schoolId={context.schoolId}
        campusId={context.campusId}
        academicYearId={context.academicYearId}
        academicYearName={context.academicYearName}
        schools={context.schools}
      />
      <div className="header-actions">
        {context.isPlatformOperator && (
          <Link
            className="button secondary"
            href={"/platform/clients" as Route}
          >
            NASAQ Admin
          </Link>
        )}
        <ThemeToggle />
        <button
          className="icon-button notification-button"
          type="button"
          aria-label="Notifications, 3 unread"
        >
          <Bell size={18} />
          <span aria-hidden="true">3</span>
        </button>
        <details className="user-menu">
          <summary aria-label="Open user menu">
            <span className="user-avatar" aria-hidden="true">
              {context.displayName.slice(0, 2).toUpperCase()}
            </span>
            <span className="user-copy">
              <strong>{context.displayName}</strong>
              <small>{context.trustName}</small>
            </span>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="user-popover">
            <strong>{context.displayName}</strong>
            <small>{context.email}</small>
            <hr />
            <form action="/api/auth/sign-out" method="post">
              <button type="submit" className="menu-action">
                Sign out
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
