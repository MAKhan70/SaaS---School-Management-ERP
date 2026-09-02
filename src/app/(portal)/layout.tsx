import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { requireSession } from "@/server/auth/session";

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await requireSession();
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <AppSidebar
        permissionKeys={context.permissionKeys}
        trustName={context.trustName}
      />
      <div className="app-main">
        <AppHeader context={context} />
        {context.supportAccessExpiresAt && (
          <aside className="support-access-banner" role="status">
            NASAQ support access is active for testing until{" "}
            {new Intl.DateTimeFormat("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Kolkata",
            }).format(new Date(context.supportAccessExpiresAt))}
            .
          </aside>
        )}
        <main className="page-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
