"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import React, { useId, useState } from "react";

import { Brand } from "@/components/brand";
import { navigationForPermissions } from "@/config/navigation";

export function AppSidebar({
  permissionKeys,
  onMobile = false,
  onNavigate,
  trustName,
}: {
  permissionKeys: readonly string[];
  onMobile?: boolean;
  onNavigate?: () => void;
  trustName: string;
}) {
  const pathname = usePathname();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const items = navigationForPermissions(permissionKeys);
  const visibleItems = items.filter((item) =>
    item.label
      .toLocaleLowerCase("en-IN")
      .includes(query.toLocaleLowerCase("en-IN")),
  );
  const trustInitials = trustName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <aside className={onMobile ? "sidebar sidebar-mobile" : "sidebar"}>
      <div className="sidebar-brand">
        <Brand />
      </div>
      <div className="tenant-card">
        <span className="tenant-avatar" aria-hidden="true">
          {trustInitials}
        </span>
        <span>
          <small>Educational trust</small>
          <strong>{trustName}</strong>
        </span>
      </div>
      <nav className="sidebar-nav" aria-label="Primary">
        <div className="nav-heading">
          <p className="nav-label">Workspace</p>
          <small>{items.length} tools</small>
        </div>
        <div className="nav-search">
          <Search size={15} aria-hidden="true" />
          <label className="visually-hidden" htmlFor={searchId}>
            Find a feature
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a feature"
            autoComplete="off"
          />
        </div>
        <ul>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = item.href
              ? pathname === item.href ||
                (item.href !== "/dashboard" &&
                  item.href !== "/operations" &&
                  pathname.startsWith(`${item.href}/`))
              : false;
            return (
              <li key={item.label}>
                {item.href ? (
                  <Link
                    className={`nav-item${active ? "active" : ""}`}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
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
        {visibleItems.length === 0 ? (
          <p className="nav-empty">No matching feature</p>
        ) : null}
      </nav>
      <div className="sidebar-footer">
        <span className="status-dot" aria-hidden="true" />
        <span>
          <strong>Secure workspace</strong>
          <small>Tenant-scoped access</small>
        </span>
      </div>
    </aside>
  );
}
