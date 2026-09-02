"use client";

import { useEffect, useState } from "react";

type Detail = {
  id: string;
  applicantName: string;
  referenceNumber: string;
  stage: string;
  source: string;
  email?: string | null;
  phone?: string | null;
  feeAmountMinor: number;
  feeCurrency: string;
  feeStatus: string;
  possibleDuplicateOfId?: string | null;
  convertedStudent?: { id: string; studentNumber: string } | null;
  activities: Array<{
    id: string;
    type: string;
    note?: string | null;
    occurredAt: string;
    fromStage?: string | null;
    toStage?: string | null;
  }>;
  documents: Array<{
    id: string;
    label: string;
    status: string;
    storageKey?: string | null;
  }>;
  schedules: Array<{
    id: string;
    type: string;
    scheduledFor: string;
    status: string;
    location?: string | null;
  }>;
  followUps: Array<{
    id: string;
    title: string;
    dueAt: string;
    status: string;
  }>;
  notificationPreviews: Array<{
    id: string;
    channel: string;
    templateKey: string;
    recipientMasked: string;
  }>;
};

export function AdmissionDetail({ applicationId }: { applicationId: string }) {
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/v1/admissions/${applicationId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setDetail((await response.json()) as Detail);
      })
      .catch(() => setError("This application could not be loaded."));
  }, [applicationId]);
  if (error)
    return (
      <div className="student-state error" role="alert">
        {error}
      </div>
    );
  if (!detail)
    return (
      <div className="student-state" role="status">
        Loading application…
      </div>
    );
  return (
    <div className="admissions-workspace">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{detail.referenceNumber}</p>
          <h1>{detail.applicantName}</h1>
          <p>
            <span className="status-chip">
              {detail.stage.replaceAll("_", " ").toLowerCase()}
            </span>
            {detail.possibleDuplicateOfId ? " · Duplicate review required" : ""}
          </p>
        </div>
      </header>
      <section className="admission-panels">
        <article className="admission-panel">
          <h2>Contact and fee</h2>
          <dl className="detail-list">
            <div>
              <dt>Email</dt>
              <dd>{detail.email ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Mobile</dt>
              <dd>{detail.phone ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Application fee</dt>
              <dd>
                {new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: detail.feeCurrency,
                }).format(detail.feeAmountMinor / 100)}{" "}
                · {detail.feeStatus.toLowerCase()}
              </dd>
            </div>
          </dl>
        </article>
        <article className="admission-panel">
          <h2>Document checklist</h2>
          {detail.documents.length ? (
            detail.documents.map((document) => (
              <div className="seat-row" key={document.id}>
                <span>{document.label}</span>
                <strong>{document.status.toLowerCase()}</strong>
                {document.storageKey ? (
                  <a href={`/api/v1/admissions/documents/${document.id}`}>
                    Authorized download
                  </a>
                ) : null}
              </div>
            ))
          ) : (
            <p>No checklist items yet.</p>
          )}
        </article>
        <article className="admission-panel">
          <h2>Schedules and follow-ups</h2>
          {[...detail.schedules, ...detail.followUps].length ? (
            <>
              {detail.schedules.map((schedule) => (
                <div className="seat-row" key={schedule.id}>
                  <span>{schedule.type.toLowerCase()}</span>
                  <strong>
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Kolkata",
                    }).format(new Date(schedule.scheduledFor))}
                  </strong>
                </div>
              ))}
              {detail.followUps.map((task) => (
                <div className="seat-row" key={task.id}>
                  <span>{task.title}</span>
                  <strong>{task.status.toLowerCase()}</strong>
                </div>
              ))}
            </>
          ) : (
            <p>Nothing scheduled.</p>
          )}
        </article>
      </section>
      <section className="admission-panel">
        <h2>Activity timeline</h2>
        <ol className="activity-timeline">
          {detail.activities.map((activity) => (
            <li key={activity.id}>
              <strong>
                {activity.type.replaceAll("_", " ").toLowerCase()}
              </strong>
              <span>
                {activity.note ??
                  (activity.fromStage && activity.toStage
                    ? `${activity.fromStage} → ${activity.toStage}`
                    : "")}
              </span>
              <time>
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Kolkata",
                }).format(new Date(activity.occurredAt))}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
