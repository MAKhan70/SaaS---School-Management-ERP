import Link from "next/link";

import { Brand } from "@/components/brand";
import { navigationForPermissions } from "@/config/navigation";

export function AppSidebar({
  permissionKeys,
  onMobile = false,
  trustName,
}: {
  permissionKeys: readonly string[];
  onMobile?: boolean;
  trustName: string;
}) {
  const items = navigationForPermissions(permissionKeys);

  return (
    <aside
      className={onMobile ? "sidebar sidebar-mobile" : "sidebar"}
      aria-label="Primary navigation"
    >
      <div className="sidebar-brand">
        <Brand />
      </div>
      <div className="tenant-card">
        <span className="tenant-avatar" aria-hidden="true">
          NT
        </span>
        <span>
          <small>Educational trust</small>
          <strong>{trustName}</strong>
        </span>
      </div>
      <nav className="sidebar-nav">
        <p className="nav-label">Workspace</p>
        <ul>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label}>
                {item.href ? (
                  <Link
                    className="nav-item active"
                    href={item.href}
                    aria-current="page"
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <span
                    className="nav-item nav-item-planned"
                    aria-disabled="true"
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                    <small>Soon</small>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="sidebar-footer">
        <span className="status-dot" aria-hidden="true" />
        <span>
          <strong>Foundation preview</strong>
          <small>Demo environment</small>
        </span>
      </div>
    </aside>
  );
}
