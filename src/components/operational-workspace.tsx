"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import type { OperationalModuleDefinition } from "@/modules/operations/domain/operational-catalogue";

type RecordState =
  | "DRAFT"
  | "ACTIVE"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "COMPLETED"
  | "ARCHIVED";

type WorkspaceRecord = {
  id: string;
  referenceNumber: string;
  recordType: string;
  title: string;
  summary?: string;
  state: RecordState;
  sensitivity: "STANDARD" | "SENSITIVE" | "RESTRICTED";
  effectiveFrom?: string;
  effectiveTo?: string;
  version: number;
  updatedAt: string;
  assigneeName?: string;
  events: Array<{
    id: string;
    action: string;
    fromState?: RecordState;
    toState: RecordState;
    reason?: string;
    occurredAt: string;
  }>;
};

type Workspace = {
  module: OperationalModuleDefinition;
  canManage: boolean;
  stateCounts: Partial<Record<RecordState, number>>;
  records: WorkspaceRecord[];
};

const stateLabels: Record<RecordState, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const allowedTransitions: Record<RecordState, readonly RecordState[]> = {
  DRAFT: ["ACTIVE", "PENDING_APPROVAL", "ARCHIVED"],
  ACTIVE: ["PENDING_APPROVAL", "COMPLETED", "ARCHIVED"],
  PENDING_APPROVAL: ["APPROVED", "ACTIVE", "ARCHIVED"],
  APPROVED: ["ACTIVE", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

async function responseMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? "The operational request could not be completed";
}

export function OperationalWorkspace({ module }: { module: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [filters, setFilters] = useState({ state: "", search: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    const params = new URLSearchParams();
    if (filters.state) params.set("state", filters.state);
    if (filters.search) params.set("search", filters.search);
    const response = await fetch(`/api/v1/operations/${module}?${params}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (response.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    if (!response.ok) {
      setError(await responseMessage(response));
      setLoading(false);
      return;
    }
    setWorkspace((await response.json()) as Workspace);
    setLoading(false);
  }, [filters.search, filters.state, module]);

  useEffect(() => void load(), [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setNotice(undefined);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/operations/${module}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "create",
        recordType: form.get("recordType"),
        referenceNumber: form.get("referenceNumber"),
        title: form.get("title"),
        summary: form.get("summary") || undefined,
        effectiveFrom: form.get("effectiveFrom") || undefined,
        effectiveTo: form.get("effectiveTo") || undefined,
      }),
    });
    if (!response.ok) {
      setError(await responseMessage(response));
      return;
    }
    event.currentTarget.reset();
    setNotice("Operational record created.");
    await load();
  }

  async function transition(
    event: FormEvent<HTMLFormElement>,
    record: WorkspaceRecord,
  ) {
    event.preventDefault();
    setError(undefined);
    setNotice(undefined);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/operations/${module}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "transition",
        recordId: record.id,
        expectedVersion: record.version,
        toState: form.get("toState"),
        reason: form.get("reason"),
      }),
    });
    if (!response.ok) {
      setError(await responseMessage(response));
      return;
    }
    setNotice("Record state updated and audited.");
    await load();
  }

  if (forbidden)
    return (
      <section className="state-card state-denied">
        <h1>Permission required</h1>
        <p>Your active role cannot access this operational workspace.</p>
      </section>
    );
  if (loading && !workspace)
    return (
      <section className="state-card" role="status">
        <h1>Loading operational workspace</h1>
        <p>Applying your tenant and resource permissions.</p>
      </section>
    );
  if (!workspace)
    return (
      <section className="state-card state-error" role="alert">
        <h1>Workspace unavailable</h1>
        <p>{error ?? "Try again later."}</p>
        <button className="button secondary" onClick={() => void load()}>
          Try again
        </button>
      </section>
    );

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Operational workspace</p>
          <h1>{workspace.module.title}</h1>
          <p>{workspace.module.purpose}</p>
        </div>
        <span
          className={`sensitivity sensitivity-${workspace.module.sensitivity.toLowerCase()}`}
        >
          {workspace.module.sensitivity.toLowerCase()}
        </span>
      </header>

      {workspace.module.sensitivity !== "STANDARD" ? (
        <aside className="operational-privacy-note">
          This shared workspace stores minimum-necessary operational metadata
          only. Confidential details require the module’s dedicated encrypted
          workflow.
        </aside>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="form-success" role="status">
          {notice}
        </p>
      ) : null}

      <section
        className="operational-summary"
        aria-label="Record status summary"
      >
        {(Object.keys(stateLabels) as RecordState[]).map((state) => (
          <article className="metric-card" key={state}>
            <span>{stateLabels[state]}</span>
            <strong>{workspace.stateCounts[state] ?? 0}</strong>
          </article>
        ))}
      </section>

      <form
        className="operational-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label htmlFor="operational-search">
          Search
          <input
            id="operational-search"
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
            minLength={2}
          />
        </label>
        <label htmlFor="operational-state">
          State
          <select
            id="operational-state"
            value={filters.state}
            onChange={(event) =>
              setFilters({ ...filters, state: event.target.value })
            }
          >
            <option value="">All states</option>
            {(Object.keys(stateLabels) as RecordState[]).map((state) => (
              <option key={state} value={state}>
                {stateLabels[state]}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary" disabled={loading}>
          Apply filters
        </button>
      </form>

      {workspace.canManage ? (
        <section
          className="panel operational-create"
          aria-labelledby="create-operational-record"
        >
          <h2 id="create-operational-record">Create work record</h2>
          <form onSubmit={(event) => void create(event)}>
            <label htmlFor="record-type">
              Record type
              <select id="record-type" name="recordType" required>
                {workspace.module.recordTypes.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="reference-number">
              Reference number
              <input
                id="reference-number"
                name="referenceNumber"
                pattern="[A-Z0-9][A-Z0-9_-]{2,39}"
                required
              />
            </label>
            <label htmlFor="record-title">
              Title
              <input
                id="record-title"
                name="title"
                minLength={3}
                maxLength={160}
                required
              />
            </label>
            <label htmlFor="record-summary">
              Summary
              <input
                id="record-summary"
                name="summary"
                minLength={3}
                maxLength={500}
              />
            </label>
            <label htmlFor="effective-from">
              Effective from
              <input id="effective-from" name="effectiveFrom" type="date" />
            </label>
            <label htmlFor="effective-to">
              Effective to
              <input id="effective-to" name="effectiveTo" type="date" />
            </label>
            <button className="button primary" type="submit">
              Create record
            </button>
          </form>
        </section>
      ) : (
        <p className="permission-note">
          You have read-only access to this module.
        </p>
      )}

      <section aria-labelledby="operational-records">
        <h2 id="operational-records">Work records</h2>
        {workspace.records.length ? (
          <ul className="operational-record-list" role="list">
            {workspace.records.map((record) => (
              <li className="panel" key={record.id}>
                <header>
                  <div>
                    <small>
                      {record.referenceNumber} ·{" "}
                      {record.recordType.replaceAll("_", " ").toLowerCase()}
                    </small>
                    <h3>{record.title}</h3>
                  </div>
                  <span className="status-badge">
                    {stateLabels[record.state]}
                  </span>
                </header>
                {record.summary ? <p>{record.summary}</p> : null}
                <dl className="operational-record-meta">
                  <div>
                    <dt>Version</dt>
                    <dd>{record.version}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>
                      {new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kolkata",
                      }).format(new Date(record.updatedAt))}
                    </dd>
                  </div>
                  {record.assigneeName ? (
                    <div>
                      <dt>Assigned to</dt>
                      <dd>{record.assigneeName}</dd>
                    </div>
                  ) : null}
                </dl>
                {record.events.length ? (
                  <details>
                    <summary>Recent audit trail</summary>
                    <ol>
                      {record.events.map((item) => (
                        <li key={item.id}>
                          {stateLabels[item.toState]} ·{" "}
                          {new Intl.DateTimeFormat("en-IN", {
                            dateStyle: "medium",
                            timeZone: "Asia/Kolkata",
                          }).format(new Date(item.occurredAt))}
                          {item.reason ? ` · ${item.reason}` : ""}
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
                {workspace.canManage &&
                allowedTransitions[record.state].length ? (
                  <form
                    className="operational-transition"
                    onSubmit={(event) => void transition(event, record)}
                  >
                    <label htmlFor={`state-${record.id}`}>
                      Next state
                      <select id={`state-${record.id}`} name="toState" required>
                        {allowedTransitions[record.state].map((state) => (
                          <option key={state} value={state}>
                            {stateLabels[state]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label htmlFor={`reason-${record.id}`}>
                      Reason
                      <input
                        id={`reason-${record.id}`}
                        name="reason"
                        minLength={5}
                        maxLength={500}
                        required
                      />
                    </label>
                    <button className="button secondary" type="submit">
                      Update state
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="state-card">
            <h3>No work records</h3>
            <p>Create the first record or change the filters.</p>
          </div>
        )}
      </section>

      <section className="panel operational-reports">
        <h2>Reports</h2>
        <ul>
          {workspace.module.reports.map((report) => (
            <li key={report}>
              {report}
              <span>Planned domain projection</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
