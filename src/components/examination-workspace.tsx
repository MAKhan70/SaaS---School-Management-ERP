"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Workspace = {
  permissions: {
    canEnter: boolean;
    canApprove: boolean;
    canLock: boolean;
    canCalculate: boolean;
    canPublish: boolean;
    canGenerate: boolean;
  };
  examinations: Array<{
    id: string;
    name: string;
    examinationType: string;
    assessmentGroup: string;
    state: string;
  }>;
  subjects: Array<{
    id: string;
    subject?: { name: string };
    section?: { name: string; gradeClass: { name: string } };
  }>;
  selectedSubjectId: string | null;
  components: Array<{
    id: string;
    code: string;
    name: string;
    kind: string;
    maximumMarks: string;
    passingMarks?: string | null;
    weightagePercent: string;
  }>;
  register?: { id: string; state: string } | null;
  roster: Array<{
    id: string;
    studentProfileId: string;
    rollNumber?: string | null;
    studentProfile: {
      studentNumber: string;
      person: { firstName: string; lastName: string };
    };
  }>;
  entries: Array<{
    componentId: string;
    studentProfileId: string;
    status: "MARKED" | "ABSENT" | "EXEMPT";
    marks?: string | null;
    teacherRemark?: string | null;
  }>;
  results: Array<{
    id: string;
    studentProfileId: string;
    percentage: string;
    gradeCode?: string | null;
    state: string;
    teacherRemark?: string | null;
    principalRemark?: string | null;
    promotionRecommendation: string;
  }>;
  templates: Array<{ id: string; name: string; version: number }>;
};

type MarkDraft = {
  status: "MARKED" | "ABSENT" | "EXEMPT";
  marks: string;
};

type ResultDraft = {
  teacherRemark: string;
  principalRemark: string;
  promotionRecommendation:
    | "PROMOTE"
    | "PROMOTE_WITH_SUPPORT"
    | "DETAIN"
    | "REVIEW_REQUIRED"
    | "NOT_APPLICABLE";
};

export function ExaminationWorkspace() {
  const [data, setData] = useState<Workspace>();
  const [examinationId, setExaminationId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, MarkDraft>>({});
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>(
    {},
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reportPreview, setReportPreview] = useState<Record<string, unknown>>();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      ...(examinationId ? { examinationId } : {}),
      ...(subjectId ? { examinationSubjectId: subjectId } : {}),
    });
    try {
      const response = await fetch(`/api/v1/examinations?${query}`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("Examination data could not be loaded.");
      const result = (await response.json()) as Workspace;
      setData(result);
      const nextExam = examinationId || result.examinations[0]?.id || "";
      const nextSubject = subjectId || result.selectedSubjectId || "";
      setExaminationId(nextExam);
      setSubjectId(nextSubject);
      if (!templateId) setTemplateId(result.templates[0]?.id ?? "");
      setDrafts(
        Object.fromEntries(
          result.roster.flatMap((student) =>
            result.components.map((component) => {
              const entry = result.entries.find(
                (item) =>
                  item.studentProfileId === student.studentProfileId &&
                  item.componentId === component.id,
              );
              return [
                `${student.studentProfileId}:${component.id}`,
                {
                  status: entry?.status ?? "MARKED",
                  marks: entry?.marks?.toString() ?? "",
                } satisfies MarkDraft,
              ];
            }),
          ),
        ),
      );
      setResultDrafts(
        Object.fromEntries(
          result.roster.map((student) => {
            const existing = result.results.find(
              (item) => item.studentProfileId === student.studentProfileId,
            );
            return [
              student.studentProfileId,
              {
                teacherRemark: existing?.teacherRemark ?? "",
                principalRemark: existing?.principalRemark ?? "",
                promotionRecommendation:
                  (existing?.promotionRecommendation as ResultDraft["promotionRecommendation"]) ??
                  "NOT_APPLICABLE",
              },
            ];
          }),
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Loading failed.");
    } finally {
      setLoading(false);
    }
  }, [examinationId, subjectId, templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const maximumByComponent = useMemo(
    () =>
      new Map(
        data?.components.map((item) => [item.id, Number(item.maximumMarks)]),
      ),
    [data],
  );

  async function mutate(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/v1/examinations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        snapshot?: Record<string, unknown>;
      };
      if (!response.ok) throw new Error(result.error ?? "Operation failed");
      return result;
    } finally {
      setSaving(false);
    }
  }

  async function saveMarks(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveAttempted(true);
    if (!data || !subjectId) return;
    try {
      await mutate({
        action: "marks.bulk.save",
        examinationSubjectId: subjectId,
        reason: reason || undefined,
        records: data.roster.flatMap((student) =>
          data.components.map((component) => {
            const value = drafts[
              `${student.studentProfileId}:${component.id}`
            ] ?? {
              status: "MARKED",
              marks: "",
            };
            return {
              enrollmentId: student.id,
              studentProfileId: student.studentProfileId,
              componentId: component.id,
              status: value.status,
              marks: value.status === "MARKED" ? value.marks : null,
            };
          }),
        ),
      });
      setMessage("Marks saved to the official gradebook.");
      setReason("");
      setSaveAttempted(false);
      setTouched({});
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Marks could not be saved.",
      );
    }
  }

  async function registerAction(action: "register.approve" | "register.lock") {
    if (!data?.register) return;
    try {
      await mutate({ action, registerId: data.register.id });
      setMessage(
        action === "register.approve"
          ? "Register approved."
          : "Register locked.",
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Transition failed.");
    }
  }

  async function calculateStudent(studentProfileId: string) {
    const resultDraft = resultDrafts[studentProfileId] ?? {
      teacherRemark: "",
      principalRemark: "",
      promotionRecommendation: "NOT_APPLICABLE",
    };
    try {
      await mutate({
        action: "results.calculate",
        examinationId,
        studentProfileId,
        teacherRemark: resultDraft.teacherRemark || undefined,
        principalRemark: resultDraft.principalRemark || undefined,
        promotionRecommendation: resultDraft.promotionRecommendation,
      });
      setMessage("Result calculated from the versioned rule set.");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Calculation failed.",
      );
    }
  }

  async function publishResults() {
    try {
      await mutate({ action: "results.publish", examinationId });
      setMessage("Result snapshots published.");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Publication failed.",
      );
    }
  }

  async function preview(studentProfileId: string) {
    try {
      const result = await mutate({
        action: "report.preview",
        examinationId,
        templateId,
        studentProfileId,
      });
      setReportPreview(result.snapshot);
      setMessage("Report card preview generated without publishing it.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preview failed.");
    }
  }

  async function generateReport(
    kind: "INDIVIDUAL" | "BULK",
    studentProfileId?: string,
  ) {
    try {
      await mutate({
        action: "report.generate",
        examinationId,
        templateId,
        kind,
        studentProfileId,
      });
      setMessage(
        kind === "BULK"
          ? "Published report cards queued for bulk generation."
          : "Published report card queued for generation.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Report generation failed.",
      );
    }
  }

  return (
    <div className="examination-workspace">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Assessment and reporting</p>
          <h1>Examinations and gradebook</h1>
          <p>
            Enter assigned-subject marks, control approval and locking, and
            publish immutable result snapshots using the selected board rule
            version.
          </p>
        </div>
        <span className="gradebook-state" role="status">
          Register: {data?.register?.state ?? "Not configured"}
        </span>
      </header>

      <form
        className="attendance-filters"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor="examination-selector">
          Examination
          <select
            id="examination-selector"
            value={examinationId}
            onChange={(event) => {
              setExaminationId(event.target.value);
              setSubjectId("");
            }}
          >
            {data?.examinations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.examinationType}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="gradebook-subject">
          Assigned subject and class
          <select
            id="gradebook-subject"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            {data?.subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.subject?.name} · {item.section?.gradeClass.name} ·{" "}
                {item.section?.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="report-template">
          Report-card template
          <select
            id="report-template"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            {data?.templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · v{item.version}
              </option>
            ))}
          </select>
        </label>
      </form>

      {message && (
        <p className="attendance-message" role="status" aria-live="polite">
          {message}
        </p>
      )}
      {error && (
        <div className="student-state error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="student-state" role="status">
          Loading gradebook…
        </div>
      ) : !data?.subjects.length ? (
        <div className="student-state">
          <h2>No assigned gradebooks</h2>
          <p>Only effective subject and section assignments are shown.</p>
        </div>
      ) : (
        <form onSubmit={saveMarks}>
          <div className="gradebook-table-wrap">
            <table className="gradebook-table">
              <caption>
                Marks entry. Each component shows its maximum, passing mark, and
                weightage.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Learner</th>
                  {data.components.map((component) => (
                    <th scope="col" key={component.id}>
                      {component.name}
                      <small>
                        Max {component.maximumMarks} · Pass{" "}
                        {component.passingMarks ?? "—"} ·{" "}
                        {component.weightagePercent}%
                      </small>
                    </th>
                  ))}
                  <th scope="col">Result actions</th>
                </tr>
              </thead>
              <tbody>
                {data.roster.map((student) => (
                  <tr key={student.id}>
                    <th scope="row">
                      {student.studentProfile.person.firstName}{" "}
                      {student.studentProfile.person.lastName}
                      <small>{student.studentProfile.studentNumber}</small>
                    </th>
                    {data.components.map((component) => {
                      const key = `${student.studentProfileId}:${component.id}`;
                      const draft = drafts[key] ?? {
                        status: "MARKED",
                        marks: "",
                      };
                      const invalid =
                        draft.status === "MARKED" &&
                        (draft.marks === "" ||
                          Number(draft.marks) < 0 ||
                          Number(draft.marks) >
                            (maximumByComponent.get(component.id) ?? 0));
                      return (
                        <td key={component.id}>
                          <label
                            htmlFor={`${key}-status`}
                            className="visually-hidden"
                          >
                            Status for {student.studentProfile.person.firstName}
                            , {component.name}
                          </label>
                          <select
                            id={`${key}-status`}
                            value={draft.status}
                            disabled={
                              data.register?.state === "LOCKED" || saving
                            }
                            onChange={(event) =>
                              setDrafts({
                                ...drafts,
                                [key]: {
                                  ...draft,
                                  status: event.target
                                    .value as MarkDraft["status"],
                                },
                              })
                            }
                          >
                            <option value="MARKED">Marked</option>
                            <option value="ABSENT">Absent</option>
                            <option value="EXEMPT">Exempt</option>
                          </select>
                          {draft.status === "MARKED" && (
                            <>
                              <label
                                htmlFor={`${key}-marks`}
                                className="visually-hidden"
                              >
                                Marks for{" "}
                                {student.studentProfile.person.firstName},{" "}
                                {component.name}
                              </label>
                              <input
                                id={`${key}-marks`}
                                inputMode="decimal"
                                type="number"
                                min="0"
                                max={component.maximumMarks}
                                step="0.01"
                                required
                                aria-invalid={
                                  ((saveAttempted || touched[key]) &&
                                    invalid) ||
                                  undefined
                                }
                                aria-errormessage={`${key}-error`}
                                value={draft.marks}
                                disabled={
                                  data.register?.state === "LOCKED" || saving
                                }
                                onBlur={() =>
                                  setTouched({ ...touched, [key]: true })
                                }
                                onChange={(event) =>
                                  setDrafts({
                                    ...drafts,
                                    [key]: {
                                      ...draft,
                                      marks: event.target.value,
                                    },
                                  })
                                }
                              />
                              <span
                                id={`${key}-error`}
                                className="gradebook-error"
                              >
                                Enter 0 to {component.maximumMarks}.
                              </span>
                            </>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      {data.permissions.canCalculate && (
                        <div className="result-inputs">
                          <label
                            htmlFor={`${student.studentProfileId}-teacher-remark`}
                          >
                            Teacher remark
                          </label>
                          <textarea
                            id={`${student.studentProfileId}-teacher-remark`}
                            maxLength={1000}
                            value={
                              resultDrafts[student.studentProfileId]
                                ?.teacherRemark ?? ""
                            }
                            onChange={(event) =>
                              setResultDrafts({
                                ...resultDrafts,
                                [student.studentProfileId]: {
                                  ...(resultDrafts[
                                    student.studentProfileId
                                  ] ?? {
                                    principalRemark: "",
                                    promotionRecommendation: "NOT_APPLICABLE",
                                  }),
                                  teacherRemark: event.target.value,
                                },
                              })
                            }
                          />
                          <label
                            htmlFor={`${student.studentProfileId}-principal-remark`}
                          >
                            Principal remark
                          </label>
                          <textarea
                            id={`${student.studentProfileId}-principal-remark`}
                            maxLength={1000}
                            value={
                              resultDrafts[student.studentProfileId]
                                ?.principalRemark ?? ""
                            }
                            onChange={(event) =>
                              setResultDrafts({
                                ...resultDrafts,
                                [student.studentProfileId]: {
                                  ...(resultDrafts[
                                    student.studentProfileId
                                  ] ?? {
                                    teacherRemark: "",
                                    promotionRecommendation: "NOT_APPLICABLE",
                                  }),
                                  principalRemark: event.target.value,
                                },
                              })
                            }
                          />
                          <label
                            htmlFor={`${student.studentProfileId}-promotion`}
                          >
                            Promotion recommendation
                          </label>
                          <select
                            id={`${student.studentProfileId}-promotion`}
                            value={
                              resultDrafts[student.studentProfileId]
                                ?.promotionRecommendation ?? "NOT_APPLICABLE"
                            }
                            onChange={(event) =>
                              setResultDrafts({
                                ...resultDrafts,
                                [student.studentProfileId]: {
                                  ...(resultDrafts[
                                    student.studentProfileId
                                  ] ?? {
                                    teacherRemark: "",
                                    principalRemark: "",
                                  }),
                                  promotionRecommendation: event.target
                                    .value as ResultDraft["promotionRecommendation"],
                                },
                              })
                            }
                          >
                            <option value="NOT_APPLICABLE">
                              Not applicable
                            </option>
                            <option value="PROMOTE">Promote</option>
                            <option value="PROMOTE_WITH_SUPPORT">
                              Promote with support
                            </option>
                            <option value="DETAIN">Detain</option>
                            <option value="REVIEW_REQUIRED">
                              Review required
                            </option>
                          </select>
                        </div>
                      )}
                      {data.permissions.canCalculate && (
                        <button
                          type="button"
                          className="button secondary"
                          disabled={saving}
                          onClick={() =>
                            void calculateStudent(student.studentProfileId)
                          }
                        >
                          Calculate result
                        </button>
                      )}
                      {data.permissions.canGenerate && (
                        <>
                          <button
                            type="button"
                            className="button secondary"
                            disabled={saving || !templateId}
                            onClick={() =>
                              void preview(student.studentProfileId)
                            }
                          >
                            Preview report card
                          </button>
                          <button
                            type="button"
                            className="button secondary"
                            disabled={
                              saving ||
                              !templateId ||
                              !data.results.some(
                                (result) =>
                                  result.studentProfileId ===
                                    student.studentProfileId &&
                                  result.state === "PUBLISHED",
                              )
                            }
                            onClick={() =>
                              void generateReport(
                                "INDIVIDUAL",
                                student.studentProfileId,
                              )
                            }
                          >
                            Generate published report
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.register?.state === "REOPENED" && (
            <label htmlFor="post-lock-reason" className="correction-reason">
              Post-lock change reason
              <textarea
                id="post-lock-reason"
                value={reason}
                required
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
          <div className="gradebook-actions">
            <button
              className="button primary"
              disabled={
                !data.permissions.canEnter ||
                data.register?.state === "LOCKED" ||
                saving
              }
            >
              Save marks
            </button>
            {data.permissions.canApprove &&
              ["ENTRY", "REOPENED"].includes(data.register?.state ?? "") && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void registerAction("register.approve")}
                >
                  Approve register
                </button>
              )}
            {data.permissions.canLock &&
              data.register?.state === "APPROVED" && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void registerAction("register.lock")}
                >
                  Lock register
                </button>
              )}
            {data.permissions.canPublish && (
              <button
                type="button"
                className="button secondary"
                disabled={saving}
                onClick={() => void publishResults()}
              >
                Publish calculated results
              </button>
            )}
            {data.permissions.canGenerate && (
              <button
                type="button"
                className="button secondary"
                disabled={
                  saving ||
                  !templateId ||
                  !data.results.some((result) => result.state === "PUBLISHED")
                }
                onClick={() => void generateReport("BULK")}
              >
                Generate all published reports
              </button>
            )}
          </div>
        </form>
      )}

      {reportPreview && (
        <section
          className="report-card-preview"
          aria-labelledby="report-preview-title"
        >
          <h2 id="report-preview-title">Report card preview</h2>
          <p>
            This preview is privileged and is not visible to students or
            parents.
          </p>
          <pre>{JSON.stringify(reportPreview, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}
