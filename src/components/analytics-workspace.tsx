"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AnalyticsViewModel } from "@/modules/analytics/domain/analytics-contracts";
import type { AiWorkspaceViewModel } from "@/modules/ai-assistance/application/ai-assistance-service";

const indiaDateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

const featureLabels = {
  REPORT_CARD_REMARK: "Report-card remark",
  HOMEWORK_QUESTIONS: "Homework questions",
  LESSON_PLAN_OUTLINE: "Lesson-plan outline",
  NATURAL_LANGUAGE_FILTER: "Natural-language report filter",
  ADMIN_REPORT_SUMMARY: "Administrative report summary",
} as const;

async function mutation(body: Record<string, unknown>) {
  const response = await fetch("/api/v1/ai-assistance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "The request failed");
  return result;
}

function AnalyticsChart({
  series,
}: {
  series: AnalyticsViewModel["series"][number];
}) {
  return (
    <article className="panel analytics-card">
      <div className="panel-heading">
        <div>
          <h2>{series.title}</h2>
          <p>{series.description}</p>
        </div>
        <span className="status-badge">{series.valueLabel}</span>
      </div>
      {series.points.length ? (
        <figure>
          <div className="analytics-chart" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.points} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  name={series.valueLabel}
                  fill="var(--brand)"
                  radius={[5, 5, 0, 0]}
                />
                {series.points.some(
                  (point) => point.secondaryValue !== undefined,
                ) ? (
                  <Bar
                    dataKey="secondaryValue"
                    name="Attendance percent"
                    fill="var(--brand-strong)"
                    radius={[5, 5, 0, 0]}
                  />
                ) : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <figcaption>{series.description}</figcaption>
          <details>
            <summary>View chart data table</summary>
            <div className="table-scroll">
              <table>
                <caption>{series.title}</caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">{series.valueLabel}</th>
                    {series.points.some(
                      (point) => point.secondaryValue !== undefined,
                    ) ? (
                      <th scope="col">Attendance percent</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {series.points.map((point) => (
                    <tr key={point.key}>
                      <th scope="row">{point.label}</th>
                      <td>{point.value.toLocaleString("en-IN")}</td>
                      {series.points.some(
                        (item) => item.secondaryValue !== undefined,
                      ) ? (
                        <td>
                          {point.secondaryValue?.toLocaleString("en-IN") ?? "—"}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </figure>
      ) : (
        <p className="dashboard-empty">
          No authoritative records match this scope.
        </p>
      )}
    </article>
  );
}

export function AnalyticsWorkspace({
  model,
  assistance,
}: {
  model: AnalyticsViewModel;
  assistance: AiWorkspaceViewModel;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const exportParams = new URLSearchParams({
    format: "csv",
    schoolId: model.scope.schoolId,
    academicYearId: model.scope.academicYearId,
  });
  if (model.scope.campusId) exportParams.set("campusId", model.scope.campusId);

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await mutation({
        action: "CREATE_DRAFT",
        feature: data.get("feature"),
        schoolId: model.scope.schoolId,
        campusId: model.scope.campusId,
        academicYearId: model.scope.academicYearId,
        context: {
          topic: data.get("topic"),
          objective: data.get("objective"),
        },
      });
      setMessage("Draft created locally and queued for human review.");
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Draft creation failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function reviewDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      await mutation({
        action: "REVIEW_DRAFT",
        draftId: data.get("draftId"),
        decision: data.get("decision"),
        reviewerNote: data.get("reviewerNote"),
        finalOutput: data.get("finalOutput"),
      });
      setMessage("Draft review recorded.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  async function reviewIndicator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const decision = String(data.get("decision"));
    const correctedValue = Number(data.get("correctedValue"));
    try {
      await mutation({
        action: "REVIEW_INDICATOR",
        indicatorId: data.get("indicatorId"),
        decision,
        reviewerNote: data.get("reviewerNote"),
        ...(decision === "CORRECT"
          ? {
              correctedFactors: [
                {
                  key: "recorded_attendance_rate",
                  label: "Corrected recorded attendance",
                  value: correctedValue,
                  explanation:
                    "Corrected by an authorised reviewer after checking source records.",
                },
              ],
            }
          : {}),
      });
      setMessage("Indicator review recorded.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Indicator review failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function refreshIndicators() {
    setBusy(true);
    try {
      await mutation({
        action: "REFRESH_INDICATORS",
        schoolId: model.scope.schoolId,
        campusId: model.scope.campusId,
        academicYearId: model.scope.academicYearId,
      });
      setMessage("Transparent review rules were refreshed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-heading analytics-heading">
        <div>
          <p className="eyebrow">Authorised staff workspace</p>
          <h1>Analytics and assisted drafting</h1>
          <p>
            Tenant-scoped operational trends with transparent, reviewable
            drafting support.
          </p>
        </div>
        <a
          className="button secondary"
          href={`/api/v1/analytics?${exportParams.toString()}`}
        >
          Export permitted analytics
        </a>
      </header>

      <aside
        className={`analytics-freshness freshness-${model.freshness}`}
        role="status"
      >
        <strong>Data freshness: {model.freshness}</strong>
        <span>
          {model.freshnessDescription} Generated{" "}
          {indiaDateTime.format(new Date(model.generatedAt))}.
        </span>
      </aside>

      <form
        className="dashboard-filters"
        method="get"
        aria-label="Analytics filters"
      >
        <label htmlFor="analytics-school">
          School
          <select
            id="analytics-school"
            name="schoolId"
            defaultValue={model.scope.schoolId}
          >
            {model.filters.schools.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="analytics-campus">
          Campus
          <select
            id="analytics-campus"
            name="campusId"
            defaultValue={model.scope.campusId ?? ""}
          >
            <option value="">All campuses</option>
            {model.filters.campuses.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="analytics-year">
          Academic year
          <select
            id="analytics-year"
            name="academicYearId"
            defaultValue={model.scope.academicYearId}
          >
            {model.filters.academicYears.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="analytics-from">
          From
          <input id="analytics-from" name="from" type="date" />
        </label>
        <label htmlFor="analytics-to">
          To
          <input id="analytics-to" name="to" type="date" />
        </label>
        <button className="button primary" type="submit">
          Apply filters
        </button>
      </form>

      <section className="analytics-grid" aria-label="Analytics charts">
        {model.series.map((series) => (
          <AnalyticsChart key={series.metric} series={series} />
        ))}
      </section>

      <section
        className="panel responsible-ai-notice"
        aria-labelledby="responsible-ai-heading"
      >
        <h2 id="responsible-ai-heading">Responsible-use boundary</h2>
        <p>
          All generated content is a draft. It cannot make admission,
          disciplinary, scholarship, promotion, or financial decisions.
          Development uses only a local mock provider and accepts no personal or
          sensitive student attributes.
        </p>
        <p>
          <strong>Non-AI fallback:</strong> Every draft stores a deterministic
          template that remains available if assistance is disabled or
          unavailable.
        </p>
      </section>

      {message ? (
        <p className="form-message" aria-live="polite">
          {message}
        </p>
      ) : null}

      {assistance.permissions.canCreateDraft ? (
        <section className="panel" aria-labelledby="draft-create-heading">
          <div className="panel-heading">
            <div>
              <h2 id="draft-create-heading">Create an assisted draft</h2>
              <p>
                Use generic instructional context only. Do not enter names,
                contact details, health details, caste, religion, disability, or
                identifiers.
              </p>
            </div>
          </div>
          <form className="ai-draft-form" onSubmit={createDraft}>
            <label htmlFor="draft-feature">
              Draft type
              <select id="draft-feature" name="feature" required>
                {Object.entries(featureLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="draft-topic">
              Topic or report scope
              <input
                id="draft-topic"
                name="topic"
                required
                minLength={3}
                maxLength={500}
                aria-describedby="draft-privacy-help"
              />
            </label>
            <label htmlFor="draft-objective">
              Objective
              <textarea
                id="draft-objective"
                name="objective"
                required
                minLength={3}
                maxLength={500}
                rows={3}
              />
            </label>
            <p id="draft-privacy-help" className="field-hint">
              Only non-identifying curriculum or aggregate report context is
              accepted.
            </p>
            <button className="button primary" type="submit" disabled={busy}>
              Create local draft
            </button>
          </form>
        </section>
      ) : null}

      {assistance.permissions.canReviewDraft ? (
        <section className="panel" aria-labelledby="draft-review-heading">
          <div className="panel-heading">
            <div>
              <h2 id="draft-review-heading">Draft review queue</h2>
              <p>
                Accept, edit through the source workflow, or dismiss. Draft text
                is never published automatically.
              </p>
            </div>
          </div>
          {assistance.drafts.length ? (
            <ul className="review-list">
              {assistance.drafts.map((draft) => (
                <li key={draft.id}>
                  <div>
                    <strong>{featureLabels[draft.feature]}</strong>
                    <span className="status-badge">
                      {draft.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="draft-output">{draft.draftOutput}</p>
                  <details>
                    <summary>View deterministic fallback</summary>
                    <p>{draft.fallbackOutput}</p>
                  </details>
                  {draft.status === "DRAFT" ? (
                    <form className="review-form" onSubmit={reviewDraft}>
                      <input type="hidden" name="draftId" value={draft.id} />
                      <label htmlFor={`draft-note-${draft.id}`}>
                        Reviewer note
                        <input
                          id={`draft-note-${draft.id}`}
                          name="reviewerNote"
                          required
                          minLength={3}
                          maxLength={2000}
                        />
                      </label>
                      <label htmlFor={`draft-output-${draft.id}`}>
                        Reviewed draft text
                        <textarea
                          id={`draft-output-${draft.id}`}
                          name="finalOutput"
                          defaultValue={draft.draftOutput}
                          minLength={3}
                          maxLength={8000}
                          rows={6}
                        />
                      </label>
                      <div className="button-row">
                        <button
                          className="button primary"
                          type="submit"
                          name="decision"
                          value="ACCEPT"
                          disabled={busy}
                        >
                          Accept draft
                        </button>
                        <button
                          className="button secondary"
                          type="submit"
                          name="decision"
                          value="EDIT"
                          disabled={busy}
                        >
                          Accept edits
                        </button>
                        <button
                          className="button secondary"
                          type="submit"
                          name="decision"
                          value="DISMISS"
                          disabled={busy}
                        >
                          Dismiss draft
                        </button>
                      </div>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">
              No assistance drafts are awaiting review.
            </p>
          )}
        </section>
      ) : null}

      {assistance.permissions.canReadIndicators ? (
        <section className="panel" aria-labelledby="support-review-heading">
          <div className="panel-heading">
            <div>
              <h2 id="support-review-heading">
                Students who may need human review
              </h2>
              <p>
                Staff-only, explainable indicators. They are not predictions,
                labels, or decisions and are never shown in student or parent
                portals.
              </p>
            </div>
            {assistance.permissions.canReviewIndicators ? (
              <button
                className="button secondary"
                type="button"
                onClick={refreshIndicators}
                disabled={busy || !model.scope.campusId}
              >
                Refresh transparent rules
              </button>
            ) : null}
          </div>
          {assistance.indicators.length ? (
            <ul className="review-list">
              {assistance.indicators.map((indicator) => (
                <li key={indicator.id}>
                  <div>
                    <strong>{indicator.studentReference}</strong>
                    <span className="status-badge">
                      {indicator.status.toLowerCase()}
                    </span>
                  </div>
                  <p>{indicator.reasonSummary}</p>
                  <ul>
                    {indicator.factors.map((factor) => (
                      <li key={factor.key}>
                        <strong>
                          {factor.label}: {factor.value.toLocaleString("en-IN")}
                        </strong>{" "}
                        — {factor.explanation}
                      </li>
                    ))}
                  </ul>
                  <small>
                    Rule {indicator.ruleKey}, version {indicator.ruleVersion},
                    observed {indicator.observedOn}
                  </small>
                  {assistance.permissions.canReviewIndicators ? (
                    <form className="review-form" onSubmit={reviewIndicator}>
                      <input
                        type="hidden"
                        name="indicatorId"
                        value={indicator.id}
                      />
                      <label htmlFor={`indicator-note-${indicator.id}`}>
                        Reviewer note
                        <input
                          id={`indicator-note-${indicator.id}`}
                          name="reviewerNote"
                          required
                          minLength={3}
                          maxLength={2000}
                        />
                      </label>
                      <label htmlFor={`indicator-value-${indicator.id}`}>
                        Corrected percentage, when correcting
                        <input
                          id={`indicator-value-${indicator.id}`}
                          name="correctedValue"
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          defaultValue={indicator.factors[0]?.value ?? 0}
                        />
                      </label>
                      <div className="button-row">
                        <button
                          className="button secondary"
                          type="submit"
                          name="decision"
                          value="CORRECT"
                          disabled={busy}
                        >
                          Correct
                        </button>
                        <button
                          className="button secondary"
                          type="submit"
                          name="decision"
                          value="DISMISS"
                          disabled={busy}
                        >
                          Dismiss
                        </button>
                        <button
                          className="button primary"
                          type="submit"
                          name="decision"
                          value="RESOLVE"
                          disabled={busy}
                        >
                          Resolve
                        </button>
                      </div>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">
              No staff-review indicators are available for this scope.
            </p>
          )}
        </section>
      ) : null}

      {assistance.permissions.canReadAudit ? (
        <section className="panel" aria-labelledby="ai-audit-heading">
          <div className="panel-heading">
            <div>
              <h2 id="ai-audit-heading">Assistance audit evidence</h2>
              <p>
                Append-only generation and review events with provider versions.
                Inputs and outputs are represented by hashes in persistence.
              </p>
            </div>
          </div>
          {assistance.auditEvents.length ? (
            <div className="table-scroll">
              <table>
                <caption>Recent assistance audit events</caption>
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">Provider version</th>
                    <th scope="col">Reviewer action</th>
                    <th scope="col">Occurred</th>
                  </tr>
                </thead>
                <tbody>
                  {assistance.auditEvents.map((event) => (
                    <tr key={event.id}>
                      <th scope="row">
                        {event.action.replaceAll("_", " ").toLowerCase()}
                      </th>
                      <td>{event.providerVersion}</td>
                      <td>{event.reviewerAction?.toLowerCase() ?? "—"}</td>
                      <td>
                        {indiaDateTime.format(new Date(event.occurredAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dashboard-empty">
              No assistance audit events are available.
            </p>
          )}
        </section>
      ) : null}
    </>
  );
}
