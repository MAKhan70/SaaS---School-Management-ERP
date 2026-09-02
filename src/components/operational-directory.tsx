import Link from "next/link";
import type { Route } from "next";

import type { OperationalModuleDefinition } from "@/modules/operations/domain/operational-catalogue";

export function OperationalDirectory({
  modules,
}: {
  modules: readonly OperationalModuleDefinition[];
}) {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Campus operations</p>
          <h1>Operational modules</h1>
          <p>
            Tenant-scoped workspaces for academic, people, and campus
            operations.
          </p>
        </div>
      </header>
      {modules.length ? (
        <ul className="operational-module-grid" role="list">
          {modules.map((module) => (
            <li key={module.slug}>
              <article className="panel operational-module-card">
                <span
                  className={`sensitivity sensitivity-${module.sensitivity.toLowerCase()}`}
                >
                  {module.sensitivity.toLowerCase()}
                </span>
                <h2>{module.title}</h2>
                <p>{module.purpose}</p>
                <p>
                  {module.recordTypes.map((item) => item.label).join(" · ")}
                </p>
                <Link
                  className="button secondary"
                  href={`/operations/${module.slug}` as Route}
                >
                  Open {module.title}
                </Link>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <section className="state-card">
          <h2>No operational workspaces available</h2>
          <p>Your current permissions do not include an operational module.</p>
        </section>
      )}
    </>
  );
}
