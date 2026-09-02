import Link from "next/link";
import type { Route } from "next";

import type { DashboardViewModel } from "@/modules/dashboards/domain/dashboard-contracts";

const portalLabels = {
  SCHOOL_ADMIN: "Administrator",
  PRINCIPAL: "Principal",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
  ACCOUNTANT: "Accountant",
} as const;

function SelectFilter({
  id,
  label,
  name,
  value,
  options,
  allowAll = false,
}: {
  id: string;
  label: string;
  name: string;
  value?: string;
  options: readonly { id: string; name: string }[];
  allowAll?: boolean;
}) {
  return (
    <label htmlFor={id}>
      {label}
      <select id={id} name={name} defaultValue={value ?? ""}>
        {allowAll ? <option value="">All</option> : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

const indiaDateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export function Dashboard({ model }: { model: DashboardViewModel }) {
  const filters = model.filters;
  return (
    <>
      <header className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">{portalLabels[model.portal]} experience</p>
          <h1>{model.heading}</h1>
          <p>{model.introduction}</p>
        </div>
        <span className="demo-badge">
          <span aria-hidden="true" /> Seeded demonstration data
        </span>
      </header>

      {model.stale ? (
        <aside className="dashboard-stale" role="status">
          This view may be stale. Its newest source update was{" "}
          {indiaDateTime.format(new Date(model.sourceUpdatedAt))}.
        </aside>
      ) : null}

      <form
        className="dashboard-filters"
        method="get"
        aria-label="Dashboard filters"
      >
        <label htmlFor="dashboard-date">
          Date
          <input
            id="dashboard-date"
            name="date"
            type="date"
            defaultValue={model.selectedDate}
          />
        </label>
        <SelectFilter
          id="dashboard-school"
          label="School"
          name="schoolId"
          value={filters.selectedSchoolId}
          options={filters.schools}
        />
        <SelectFilter
          id="dashboard-campus"
          label="Campus"
          name="campusId"
          value={filters.selectedCampusId}
          options={filters.campuses}
          allowAll
        />
        <SelectFilter
          id="dashboard-year"
          label="Academic year"
          name="academicYearId"
          value={filters.selectedAcademicYearId}
          options={filters.academicYears}
        />
        <SelectFilter
          id="dashboard-grade"
          label="Class"
          name="gradeClassId"
          value={filters.selectedGradeClassId}
          options={filters.grades}
          allowAll
        />
        <SelectFilter
          id="dashboard-section"
          label="Section"
          name="sectionId"
          value={filters.selectedSectionId}
          options={filters.sections}
          allowAll
        />
        {filters.children.length ? (
          <SelectFilter
            id="dashboard-child"
            label="Child"
            name="studentProfileId"
            value={model.selectedStudentProfileId}
            options={filters.children}
          />
        ) : null}
        <button className="button primary" type="submit">
          Apply filters
        </button>
      </form>

      <section
        className="metrics-grid dashboard-metrics"
        aria-label="Dashboard summary"
      >
        {model.metrics.map((metric) => (
          <article
            className={`metric-card metric-${metric.tone ?? "default"}`}
            key={metric.key}
          >
            <div className="metric-top">
              <span>{metric.label}</span>
            </div>
            <strong>{metric.value}</strong>
            <p>{metric.note}</p>
          </article>
        ))}
      </section>

      <div className="role-dashboard-grid">
        {model.sections.map((dashboardSection) => (
          <section
            className="panel dashboard-section"
            key={dashboardSection.key}
            aria-labelledby={`section-${dashboardSection.key}`}
          >
            <div className="panel-heading">
              <div>
                <h2 id={`section-${dashboardSection.key}`}>
                  {dashboardSection.title}
                </h2>
                <p>{dashboardSection.description}</p>
              </div>
            </div>
            {dashboardSection.items.length ? (
              <ul className="dashboard-list">
                {dashboardSection.items.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      {item.detail ? <p>{item.detail}</p> : null}
                      {item.meta ? <small>{item.meta}</small> : null}
                    </div>
                    <div className="dashboard-item-aside">
                      {item.value ? <strong>{item.value}</strong> : null}
                      {typeof item.progressPercent === "number" ? (
                        <progress
                          max="100"
                          value={item.progressPercent}
                          aria-label={`${item.title}: ${item.progressPercent}%`}
                        />
                      ) : null}
                      {item.status ? (
                        <span className="status-badge">{item.status}</span>
                      ) : null}
                      {item.href ? (
                        <Link className="text-button" href={item.href as Route}>
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dashboard-empty">{dashboardSection.emptyMessage}</p>
            )}
          </section>
        ))}
      </div>

      <p className="dashboard-freshness">
        Generated {indiaDateTime.format(new Date(model.generatedAt))}. Metrics
        are calculated by tenant-scoped server services.
      </p>
    </>
  );
}
