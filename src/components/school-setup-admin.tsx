"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Archive, Download, LoaderCircle, Plus, RefreshCw } from "lucide-react";

type Item = {
  id: string;
  code?: string;
  name?: string;
  status?: string;
  version?: number;
  boardType?: string;
  entityType?: string;
  startsOn?: string;
  endsOn?: string;
  weekday?: number;
};

type Overview = {
  trust: {
    id: string;
    name: string;
    defaultLocale: string;
    defaultTimezone: string;
    defaultCurrency: string;
  };
  school: { id: string; code: string; name: string; campuses: Item[] };
  academicYears: Item[];
  boards: Item[];
  terms: Item[];
  grades: Item[];
  sections: Item[];
  streams: Item[];
  departments: Item[];
  subjects: Item[];
  rooms: Item[];
  periods: Item[];
  calendarDays: Item[];
  workingDayRules: Item[];
  gradingScales: Item[];
  houses: Item[];
  numberingRules: Item[];
};

type Field = {
  name: string;
  label: string;
  type?: "text" | "date" | "number" | "select" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: readonly { value: string; label: string }[];
};

type FormDefinition = {
  title: string;
  description: string;
  action: string;
  fixed?: Record<string, string>;
  fields: readonly Field[];
};

const boardOptions = [
  { value: "CBSE", label: "CBSE" },
  { value: "CISCE", label: "CISCE (ICSE / ISC)" },
  { value: "MAHARASHTRA_STATE", label: "Maharashtra State Board" },
  { value: "OTHER_STATE", label: "Configurable State Board" },
  { value: "CUSTOM", label: "Custom school configuration" },
] as const;

function options(items: readonly Item[]): { value: string; label: string }[] {
  return items.map((item) => ({
    value: item.id,
    label: item.name ?? item.code ?? item.id,
  }));
}

function setupForms(data: Overview): FormDefinition[] {
  const years = options(data.academicYears);
  const campuses = options(data.school.campuses);
  const boards = options(data.boards);
  const grades = options(data.grades);
  const departments = options(data.departments);
  return [
    {
      title: "Academic year",
      description:
        "Prepare a planned or active school year without overwriting history.",
      action: "academicYear.create",
      fields: [
        { name: "code", label: "Code", required: true, placeholder: "2027-28" },
        { name: "name", label: "Display name", required: true },
        { name: "startsOn", label: "Starts on", type: "date", required: true },
        { name: "endsOn", label: "Ends on", type: "date", required: true },
        {
          name: "status",
          label: "Initial status",
          type: "select",
          required: true,
          options: [
            { value: "PLANNED", label: "Planned" },
            { value: "ACTIVE", label: "Active" },
          ],
        },
      ],
    },
    {
      title: "Copy year configuration",
      description:
        "Copy terms, working-day rules and periods into a future year.",
      action: "academicYear.copy",
      fields: [
        {
          name: "sourceAcademicYearId",
          label: "Source year",
          type: "select",
          required: true,
          options: years,
        },
        { name: "code", label: "New code", required: true },
        { name: "name", label: "New display name", required: true },
        { name: "startsOn", label: "Starts on", type: "date", required: true },
        { name: "endsOn", label: "Ends on", type: "date", required: true },
      ],
    },
    {
      title: "Board configuration version",
      description:
        "Create a versioned CBSE, CISCE, State Board or custom ruleset.",
      action: "board.createVersion",
      fields: [
        {
          name: "boardType",
          label: "Board",
          type: "select",
          required: true,
          options: boardOptions,
        },
        { name: "stateCode", label: "State code", placeholder: "MH" },
        { name: "name", label: "Configuration name", required: true },
        {
          name: "effectiveFrom",
          label: "Effective from",
          type: "date",
          required: true,
        },
        {
          name: "rules",
          label: "Rules (JSON object)",
          type: "textarea",
          required: true,
          placeholder: "{}",
        },
      ],
    },
    {
      title: "Term",
      description: "Define a dated term inside an academic year.",
      action: "term.create",
      fields: [
        {
          name: "academicYearId",
          label: "Academic year",
          type: "select",
          required: true,
          options: years,
        },
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        { name: "sequence", label: "Order", type: "number", required: true },
        { name: "startsOn", label: "Starts on", type: "date", required: true },
        { name: "endsOn", label: "Ends on", type: "date", required: true },
      ],
    },
    ...(["grade", "stream", "department", "subject", "house"] as const).map(
      (kind) => ({
        title:
          kind === "grade"
            ? "Grade or class"
            : kind[0]!.toUpperCase() + kind.slice(1),
        description: `Add a school-defined ${kind}; names are never built into application rules.`,
        action: "catalog.create",
        fixed: { kind },
        fields: [
          { name: "code", label: "Code", required: true },
          { name: "name", label: "Name", required: true },
          ...(kind === "grade"
            ? [
                {
                  name: "boardConfigurationId",
                  label: "Board configuration",
                  type: "select" as const,
                  required: true,
                  options: boards,
                },
                {
                  name: "level",
                  label: "Level",
                  type: "number" as const,
                  required: true,
                },
              ]
            : []),
          ...(kind === "subject"
            ? [
                {
                  name: "departmentId",
                  label: "Department",
                  type: "select" as const,
                  options: departments,
                },
              ]
            : []),
          ...(kind === "house"
            ? [{ name: "colour", label: "Colour", placeholder: "#176B5B" }]
            : []),
        ],
      }),
    ),
    {
      title: "Section",
      description:
        "Assign a named section to a campus, class and academic year.",
      action: "section.create",
      fields: [
        {
          name: "campusId",
          label: "Campus",
          type: "select",
          required: true,
          options: campuses,
        },
        {
          name: "academicYearId",
          label: "Academic year",
          type: "select",
          required: true,
          options: years,
        },
        {
          name: "gradeClassId",
          label: "Grade or class",
          type: "select",
          required: true,
          options: grades,
        },
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        { name: "capacity", label: "Capacity", type: "number" },
      ],
    },
    {
      title: "Room",
      description: "Create a campus room with configurable type and capacity.",
      action: "room.create",
      fields: [
        {
          name: "campusId",
          label: "Campus",
          type: "select",
          required: true,
          options: campuses,
        },
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        { name: "roomType", label: "Room type", required: true },
        { name: "capacity", label: "Capacity", type: "number" },
      ],
    },
    {
      title: "Period",
      description:
        "Configure an instructional or break period using local clock minutes.",
      action: "period.create",
      fixed: { isInstruction: "true" },
      fields: [
        {
          name: "academicYearId",
          label: "Academic year",
          type: "select",
          required: true,
          options: years,
        },
        {
          name: "campusId",
          label: "Campus (optional)",
          type: "select",
          options: campuses,
        },
        { name: "code", label: "Code", required: true },
        { name: "name", label: "Name", required: true },
        { name: "sequence", label: "Order", type: "number", required: true },
        {
          name: "startsMinute",
          label: "Start minute after midnight",
          type: "number",
          required: true,
        },
        {
          name: "endsMinute",
          label: "End minute after midnight",
          type: "number",
          required: true,
        },
      ],
    },
    {
      title: "Holiday or calendar day",
      description:
        "Record holidays, overrides, non-working days and school events.",
      action: "calendar.create",
      fields: [
        {
          name: "academicYearId",
          label: "Academic year",
          type: "select",
          required: true,
          options: years,
        },
        {
          name: "campusId",
          label: "Campus (optional)",
          type: "select",
          options: campuses,
        },
        { name: "date", label: "Date", type: "date", required: true },
        {
          name: "type",
          label: "Day type",
          type: "select",
          required: true,
          options: [
            { value: "HOLIDAY", label: "Holiday" },
            { value: "WORKING_DAY", label: "Working-day override" },
            { value: "NON_WORKING_DAY", label: "Non-working day" },
            { value: "SCHOOL_EVENT", label: "School event" },
          ],
        },
        { name: "name", label: "Name", required: true },
        { name: "description", label: "Description", type: "textarea" },
      ],
    },
    {
      title: "Working days",
      description:
        "Set ISO weekdays 1 (Monday) through 7 (Sunday) for the selected year.",
      action: "workingDays.replace",
      fields: [
        {
          name: "academicYearId",
          label: "Academic year",
          type: "select",
          required: true,
          options: years,
        },
        {
          name: "weekdays",
          label: "Working weekdays (JSON array)",
          type: "textarea",
          required: true,
          placeholder: "[1,2,3,4,5,6]",
        },
      ],
    },
    {
      title: "Grading scale version",
      description:
        "Keep grading policy history by creating a new version with explicit bands.",
      action: "gradingScale.createVersion",
      fields: [
        {
          name: "academicYearId",
          label: "Academic year (optional)",
          type: "select",
          options: years,
        },
        { name: "code", label: "Scale code", required: true },
        { name: "name", label: "Scale name", required: true },
        {
          name: "effectiveFrom",
          label: "Effective from",
          type: "date",
          required: true,
        },
        {
          name: "bands",
          label: "Bands (JSON array)",
          type: "textarea",
          required: true,
          placeholder:
            '[{"code":"A","name":"A","minimumValue":80,"maximumValue":100}]',
        },
      ],
    },
    ...(["STUDENT", "EMPLOYEE"] as const).map((entityType) => ({
      title: `${entityType === "STUDENT" ? "Student" : "Employee"} numbering rule`,
      description:
        "Create a traceable rule version; allocation counters are transaction-safe.",
      action: "numbering.createVersion",
      fixed: { entityType },
      fields: [
        {
          name: "academicYearId",
          label: "Academic year (optional)",
          type: "select" as const,
          options: years,
        },
        {
          name: "prefixTemplate",
          label: "Prefix template",
          placeholder: "{SCHOOL}-{YEAR}-",
        },
        { name: "suffixTemplate", label: "Suffix template" },
        {
          name: "padding",
          label: "Number padding",
          type: "number" as const,
          required: true,
        },
        {
          name: "resetPolicy",
          label: "Reset policy",
          type: "select" as const,
          required: true,
          options: [
            { value: "NEVER", label: "Never" },
            { value: "ACADEMIC_YEAR", label: "Each academic year" },
            { value: "CALENDAR_YEAR", label: "Each calendar year" },
          ],
        },
        {
          name: "effectiveFrom",
          label: "Effective from",
          type: "date" as const,
          required: true,
        },
      ],
    })),
    {
      title: "Archive configuration",
      description:
        "Retain history while removing an unsafe configuration from active use.",
      action: "configuration.archive",
      fields: [
        {
          name: "kind",
          label: "Configuration type",
          type: "select",
          required: true,
          options: [
            "academicYear",
            "term",
            "board",
            "grade",
            "section",
            "stream",
            "department",
            "subject",
            "room",
            "period",
            "calendar",
            "gradingScale",
            "house",
            "numberingRule",
          ].map((value) => ({
            value,
            label: value.replace(/([A-Z])/g, " $1"),
          })),
        },
        { name: "resourceId", label: "Record ID", required: true },
        {
          name: "reason",
          label: "Archival reason",
          type: "textarea",
          required: true,
        },
      ],
    },
  ];
}

function SetupForm({
  definition,
  onSaved,
}: {
  definition: FormDefinition;
  onSaved: () => void;
}) {
  const formId = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      action: definition.action,
      ...definition.fixed,
    };
    for (const [key, value] of form.entries())
      if (typeof value === "string" && value.trim()) body[key] = value.trim();
    try {
      for (const key of ["rules", "bands", "weekdays"])
        if (typeof body[key] === "string") body[key] = JSON.parse(body[key]);
      if (body.isInstruction === "true") body.isInstruction = true;
      const response = await fetch("/api/v1/school-setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "The change could not be saved");
      event.currentTarget.reset();
      setMessage("Saved successfully.");
      onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The change could not be saved",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="setup-editor">
      <summary>
        <span>
          <strong>{definition.title}</strong>
          <small>{definition.description}</small>
        </span>
        <Plus size={17} aria-hidden="true" />
      </summary>
      <form onSubmit={submit} className="setup-form">
        <div className="setup-form-grid">
          {definition.fields.map((field) => {
            const id = `${formId}-${field.name}`;
            return (
              <label key={field.name} htmlFor={id}>
                <span>
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                {field.type === "select" ? (
                  <select
                    id={id}
                    name={field.name}
                    required={field.required}
                    defaultValue=""
                  >
                    <option value="">Select</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    id={id}
                    name={field.name}
                    required={field.required}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <input
                    id={id}
                    name={field.name}
                    type={field.type ?? "text"}
                    required={field.required}
                    placeholder={field.placeholder}
                  />
                )}
              </label>
            );
          })}
        </div>
        {message ? (
          <p
            className={
              message === "Saved successfully." ? "form-success" : "form-error"
            }
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        ) : null}
        <button className="button primary" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={16} aria-hidden="true" />
          ) : null}
          {busy ? "Saving" : `Add ${definition.title.toLowerCase()}`}
        </button>
      </form>
    </details>
  );
}

const collectionGroups = [
  ["Academic cycles", ["academicYears", "terms", "boards"]],
  [
    "Academic structure",
    ["grades", "sections", "streams", "departments", "subjects"],
  ],
  [
    "Facilities and calendar",
    ["rooms", "periods", "calendarDays", "workingDayRules"],
  ],
  ["School policies", ["gradingScales", "houses", "numberingRules"]],
] as const;

export function SchoolSetupAdmin() {
  const [data, setData] = useState<Overview>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/v1/school-setup", {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json()) as Overview & { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "Configuration could not be loaded");
      setData(payload);
      setError(undefined);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Configuration could not be loaded",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (error && !data)
    return (
      <section className="state-card state-error">
        <p className="eyebrow">School setup</p>
        <h1>Configuration unavailable</h1>
        <p>{error}</p>
        <button className="button secondary" onClick={() => void load()}>
          Try again
        </button>
      </section>
    );
  if (!data)
    return (
      <section className="state-card" aria-live="polite">
        <LoaderCircle className="spin" aria-hidden="true" />
        <h1>Loading school setup</h1>
        <p>Reading tenant-scoped configuration for your active school.</p>
      </section>
    );

  const inventoryRows = collectionGroups.flatMap(([, keys]) =>
    keys.flatMap((key) => data[key].map((item) => ({ category: key, item }))),
  );

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>Administration</li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">School setup</li>
        </ol>
      </nav>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>School setup and academic structure</h1>
          <p>
            {data.school.name} · {data.trust.name}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => void load()}
          disabled={refreshing}
        >
          <RefreshCw
            className={refreshing ? "spin" : ""}
            size={16}
            aria-hidden="true"
          />
          Refresh
        </button>
      </header>
      <section
        className="setup-profile-grid"
        aria-label="Organisation profiles"
      >
        {[
          { resource: "trust", item: data.trust, label: "Trust profile" },
          { resource: "school", item: data.school, label: "School profile" },
          ...data.school.campuses.map((campus) => ({
            resource: "campus",
            item: campus,
            label: "Campus profile",
          })),
        ].map(({ resource, item, label }) => (
          <article className="panel" key={`${resource}-${item.id}`}>
            <p className="eyebrow">{label}</p>
            <h2>{item.name}</h2>
            <SetupForm
              onSaved={() => void load()}
              definition={{
                title: `Edit ${label.toLowerCase()}`,
                description: "Update validated organisation settings.",
                action: "profile.update",
                fixed: { resource, resourceId: item.id },
                fields: [
                  { name: "name", label: "Display name", required: true },
                  ...(resource === "trust"
                    ? [
                        {
                          name: "defaultLocale",
                          label: "Default locale",
                          placeholder: "en-IN",
                        },
                        {
                          name: "defaultTimezone",
                          label: "Default timezone",
                          placeholder: "Asia/Kolkata",
                        },
                        {
                          name: "defaultCurrency",
                          label: "ISO currency",
                          placeholder: "INR",
                        },
                      ]
                    : [
                        { name: "code", label: "Code" },
                        ...(resource === "campus"
                          ? [
                              {
                                name: "timezone",
                                label: "Timezone",
                                placeholder: "Asia/Kolkata",
                              },
                            ]
                          : []),
                      ]),
                ],
              }}
            />
          </article>
        ))}
      </section>
      <section
        className="setup-summary"
        aria-labelledby="configuration-summary"
      >
        <div className="panel-heading">
          <div>
            <h2 id="configuration-summary">Configuration inventory</h2>
            <p>
              Active and historical records remain visible. Use archival instead
              of destructive deletion.
            </p>
          </div>
        </div>
        <div className="setup-count-grid">
          {collectionGroups.map(([group, keys]) => (
            <article key={group}>
              <h3>{group}</h3>
              <dl>
                {keys.map((key) => (
                  <div key={key}>
                    <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                    <dd>{data[key].length}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Scrollable configuration inventory"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Configuration</th>
                <th scope="col">Code or version</th>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {inventoryRows.length ? (
                inventoryRows.map(({ category, item }) => (
                  <tr key={`${category}-${item.id}`}>
                    <td>{category.replace(/([A-Z])/g, " $1")}</td>
                    <td>
                      {item.code ??
                        (item.version
                          ? `Version ${item.version}`
                          : item.weekday
                            ? `Weekday ${item.weekday}`
                            : "—")}
                    </td>
                    <td>
                      {item.name ??
                        item.boardType ??
                        item.entityType ??
                        "Configured rule"}
                    </td>
                    <td>
                      <span className="status-badge">
                        {item.status ?? "Configured"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
                    No configuration records yet. Use an action below to begin
                    setup.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="setup-workspace" aria-labelledby="setup-actions">
        <div className="panel-heading">
          <div>
            <h2 id="setup-actions">Configuration actions</h2>
            <p>
              All changes are validated, permission-checked and audited on the
              server.
            </p>
          </div>
        </div>
        {setupForms(data).map((definition) => (
          <SetupForm
            key={`${definition.action}-${definition.title}`}
            definition={definition}
            onSaved={() => void load()}
          />
        ))}
      </section>
      <section className="panel setup-imports">
        <div className="panel-heading">
          <div>
            <h2>Import and export templates</h2>
            <p>
              Download tenant-neutral CSV headers. Exported operational data is
              intentionally excluded from templates.
            </p>
          </div>
        </div>
        <div className="template-links">
          {["grades", "subjects", "rooms", "holidays"].map((kind) => (
            <a
              className="button secondary"
              href={`/api/v1/school-setup/templates/${kind}`}
              key={kind}
            >
              <Download size={15} aria-hidden="true" />
              {kind[0]!.toUpperCase() + kind.slice(1)} template
            </a>
          ))}
        </div>
      </section>
      <section className="panel setup-archive">
        <div>
          <Archive size={20} aria-hidden="true" />
          <h2>Safe archival</h2>
          <p>
            Configuration deletion is disabled. Historical references are
            protected by foreign keys; authorised archival is available through
            the API with a required reason.
          </p>
        </div>
      </section>
    </>
  );
}
