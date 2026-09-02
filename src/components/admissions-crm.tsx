"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Dashboard = {
  applications: Array<{
    id: string;
    referenceNumber: string;
    applicantName: string;
    stage: string;
    source: string;
    updatedAt: string;
    possibleDuplicateOfId?: string | null;
    targetGradeClass?: { name: string } | null;
    counselor?: { profile?: { displayName: string } | null } | null;
    followUps: Array<{ dueAt: string }>;
  }>;
  funnel: Array<{ stage: string; count: number }>;
  conversion: { total: number; admitted: number };
  seats: Array<{
    id: string;
    capacity: number;
    used: number;
    available: number;
    gradeClass: { name: string };
  }>;
  counselorProductivity: Array<{
    counselorUserId?: string | null;
    counselorName: string;
    assigned: number;
  }>;
  forms: Array<{
    id: string;
    kind: "ENQUIRY" | "APPLICATION";
    name: string;
    version: number;
    status: string;
    publicEntries: Array<{ publicKey: string }>;
  }>;
};

const stageLabels: Record<string, string> = {
  ENQUIRY: "Enquiry",
  CONTACTED: "Contacted",
  FOLLOW_UP_SCHEDULED: "Follow-up scheduled",
  APPLICATION_STARTED: "Application started",
  APPLICATION_SUBMITTED: "Application submitted",
  DOCUMENTS_PENDING: "Documents pending",
  UNDER_REVIEW: "Under review",
  ASSESSMENT_SCHEDULED: "Assessment scheduled",
  INTERVIEW_SCHEDULED: "Interview scheduled",
  OFFERED: "Offered",
  WAITLISTED: "Waitlisted",
  ADMITTED: "Admitted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export function AdmissionsCrm() {
  const [data, setData] = useState<Dashboard>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      ...(search ? { search } : {}),
      ...(stage ? { stage } : {}),
    });
    try {
      const response = await fetch(`/api/v1/admissions?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setData((await response.json()) as Dashboard);
    } catch {
      setError("Admissions data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [search, stage]);

  useEffect(() => {
    void load();
  }, [load]);

  const conversionRate = data?.conversion.total
    ? Math.round((data.conversion.admitted / data.conversion.total) * 100)
    : 0;
  return (
    <div className="admissions-workspace">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Admissions CRM</p>
          <h1>Admissions pipeline</h1>
          <p>
            Manage enquiries, applications, decisions, and student conversion in
            the selected school and academic year.
          </p>
        </div>
      </header>
      <section className="admission-metrics" aria-label="Admission summary">
        <article>
          <span>Total pipeline</span>
          <strong>{data?.conversion.total ?? "—"}</strong>
        </article>
        <article>
          <span>Admitted</span>
          <strong>{data?.conversion.admitted ?? "—"}</strong>
        </article>
        <article>
          <span>Conversion</span>
          <strong>{data ? `${conversionRate}%` : "—"}</strong>
        </article>
        <article>
          <span>Open follow-ups</span>
          <strong>
            {data?.applications.filter((item) => item.followUps.length)
              .length ?? "—"}
          </strong>
        </article>
      </section>
      <section className="admission-panels">
        <article className="admission-panel">
          <h2>Funnel</h2>
          <div className="funnel-list">
            {data?.funnel.map((item) => (
              <div key={item.stage}>
                <span>{stageLabels[item.stage] ?? item.stage}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="admission-panel">
          <h2>Seat availability</h2>
          {data?.seats.length ? (
            data.seats.map((seat) => (
              <div className="seat-row" key={seat.id}>
                <span>{seat.gradeClass.name}</span>
                <strong>{seat.available} available</strong>
                <small>
                  {seat.used} of {seat.capacity} held or admitted
                </small>
              </div>
            ))
          ) : (
            <p>No seat plans configured.</p>
          )}
        </article>
        <article className="admission-panel">
          <h2>Counselor productivity</h2>
          {data?.counselorProductivity.length ? (
            data.counselorProductivity.map((item, index) => (
              <div
                className="seat-row"
                key={item.counselorUserId ?? `unassigned-${index}`}
              >
                <span>{item.counselorName}</span>
                <strong>{item.assigned} applications</strong>
              </div>
            ))
          ) : (
            <p>No assignments yet.</p>
          )}
        </article>
      </section>
      <section className="admission-panel">
        <h2>Published admission forms</h2>
        {data?.forms.length ? (
          <div className="funnel-list">
            {data.forms.map((form) => {
              const publicKey = form.publicEntries[0]?.publicKey;
              const path = form.kind === "ENQUIRY" ? "enquire" : "apply";
              return (
                <div key={form.id}>
                  <span>
                    {form.name} · version {form.version}
                  </span>
                  {publicKey ? (
                    <Link
                      href={`/admissions/${path}/${publicKey}` as Route}
                      target="_blank"
                    >
                      Open public {form.kind.toLowerCase()} form
                    </Link>
                  ) : (
                    <strong>{form.status.toLowerCase()}</strong>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p>No admission forms configured for this academic year.</p>
        )}
      </section>
      <form
        className="student-filters admission-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="wide-field">
          Search
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Applicant or reference"
          />
        </label>
        <label>
          Stage
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
          >
            <option value="">All stages</option>
            {Object.entries(stageLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary" type="submit" disabled={loading}>
          Apply
        </button>
      </form>
      {loading ? (
        <div className="student-state" role="status">
          Loading admissions…
        </div>
      ) : error ? (
        <div className="student-state error" role="alert">
          {error}
          <button className="button secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : !data?.applications.length ? (
        <div className="student-state">
          <h2>No applications found</h2>
          <p>Public enquiries and applications will appear here.</p>
        </div>
      ) : (
        <div className="student-table-wrap">
          <table className="student-table">
            <caption>
              {data.applications.length} applications in the selected scope
            </caption>
            <thead>
              <tr>
                <th scope="col">Applicant</th>
                <th scope="col">Stage</th>
                <th scope="col">Class</th>
                <th scope="col">Counselor</th>
                <th scope="col">Source</th>
                <th scope="col">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {data.applications.map((application) => (
                <tr key={application.id}>
                  <td>
                    <Link href={`/admissions/${application.id}` as Route}>
                      <strong>{application.applicantName}</strong>
                    </Link>
                    <small>
                      {application.referenceNumber}
                      {application.possibleDuplicateOfId
                        ? " · Possible duplicate"
                        : ""}
                    </small>
                  </td>
                  <td>
                    <span className="status-chip">
                      {stageLabels[application.stage] ?? application.stage}
                    </span>
                  </td>
                  <td>
                    {application.targetGradeClass?.name ?? "Not selected"}
                  </td>
                  <td>
                    {application.counselor?.profile?.displayName ??
                      "Unassigned"}
                  </td>
                  <td>
                    {application.source.replaceAll("_", " ").toLowerCase()}
                  </td>
                  <td>
                    {application.followUps[0]
                      ? new Intl.DateTimeFormat("en-IN", {
                          dateStyle: "medium",
                          timeZone: "Asia/Kolkata",
                        }).format(new Date(application.followUps[0].dueAt))
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
