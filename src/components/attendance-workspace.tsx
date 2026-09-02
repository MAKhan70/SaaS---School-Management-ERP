"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AttendanceData = {
  scope: {
    trustId: string;
    schoolId: string;
    campusId: string;
    academicYearId: string;
    date: string;
  };
  permissions: {
    canMark: boolean;
    canCorrect: boolean;
    canLock: boolean;
    canApproveReopen: boolean;
    canMarkStaff: boolean;
  };
  sections: Array<{ id: string; name: string; gradeClass: { name: string } }>;
  statuses: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    presentFraction: number;
  }>;
  periods: Array<{ id: string; name: string; sequence: number }>;
  roster: Array<{
    id: string;
    studentProfileId: string;
    rollNumber?: string | null;
    studentProfile: {
      studentNumber: string;
      person: {
        firstName: string;
        lastName: string;
        preferredName?: string | null;
      };
    };
  }>;
  session?: {
    id: string;
    state: "OPEN" | "LOCKED";
    records: Array<{
      studentProfileId: string;
      statusDefinitionId: string;
      minutesLate?: number | null;
      note?: string | null;
    }>;
    reopenRequests: Array<{ id: string; reason: string; createdAt: string }>;
  } | null;
  reports: {
    month: string;
    studentSummaries: Array<{
      studentProfileId: string;
      studentNumber: string;
      name: string;
      markedDays: number;
      percentage: number;
      consecutiveAbsences: number;
    }>;
    defaulters: Array<{
      studentProfileId: string;
      studentNumber: string;
      name: string;
      markedDays: number;
      percentage: number;
    }>;
    consecutiveAbsenceAlerts: Array<{
      studentProfileId: string;
      studentNumber: string;
      name: string;
      consecutiveAbsences: number;
    }>;
    staffSummaries: Array<{
      staffProfileId: string;
      employeeCode: string;
      name: string;
      markedDays: number;
      lateDays: number;
      lateMinutes: number;
      earlyMinutes: number;
    }>;
  };
  staffRoster: Array<{
    id: string;
    employeeCode: string;
    person: { firstName: string; lastName: string };
  }>;
};

type DraftMarks = Record<string, string>;

export function AttendanceWorkspace() {
  const [data, setData] = useState<AttendanceData>();
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodId, setPeriodId] = useState("");
  const [marks, setMarks] = useState<DraftMarks>({});
  const [online, setOnline] = useState(true);
  const [draftPending, setDraftPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [staffProfileId, setStaffProfileId] = useState("");

  const draftKey = useMemo(
    () =>
      data && sectionId
        ? `nasaq-attendance-draft:${data.scope.trustId}:${data.scope.schoolId}:${data.scope.academicYearId}:${sectionId}:${date}:${periodId || "daily"}`
        : "",
    [data, sectionId, date, periodId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      date,
      ...(sectionId ? { sectionId } : {}),
      ...(periodId ? { periodId } : {}),
      month: date.slice(0, 7),
    });
    try {
      const response = await fetch(`/api/v1/attendance?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const result = (await response.json()) as AttendanceData;
      setData(result);
      if (!sectionId && result.sections[0]) setSectionId(result.sections[0].id);
      if (!staffProfileId && result.staffRoster[0])
        setStaffProfileId(result.staffRoster[0].id);
      const statusCode = new Map(
        result.statuses.map((status) => [status.id, status.code]),
      );
      setMarks(
        Object.fromEntries(
          result.roster.map((student) => [
            student.studentProfileId,
            statusCode.get(
              result.session?.records.find(
                (record) =>
                  record.studentProfileId === student.studentProfileId,
              )?.statusDefinitionId ?? "",
            ) ?? "PRESENT",
          ]),
        ),
      );
    } catch {
      setError("Attendance data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [date, periodId, sectionId, staffProfileId]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!draftKey) return;
    const saved = localStorage.getItem(draftKey);
    if (!saved) return;
    try {
      setMarks(JSON.parse(saved) as DraftMarks);
      setDraftPending(true);
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  function updateMark(studentId: string, statusCode: string) {
    const next = { ...marks, [studentId]: statusCode };
    setMarks(next);
    if (draftKey) localStorage.setItem(draftKey, JSON.stringify(next));
    setDraftPending(true);
  }

  async function mutate(payload: Record<string, unknown>) {
    const response = await fetch("/api/v1/attendance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Request failed");
    return result;
  }

  async function submitAttendance(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!online) {
      setDraftPending(true);
      setMessage(
        "Draft saved on this device. It is not synchronized and must be submitted when connectivity returns.",
      );
      return;
    }
    if (!data || !sectionId) return;
    setSaving(true);
    try {
      await mutate({
        action: "student.bulk.submit",
        sectionId,
        date,
        periodId: periodId || null,
        clientSubmissionId: crypto.randomUUID(),
        correctionReason: correctionReason || undefined,
        records: data.roster.map((student) => ({
          enrollmentId: student.id,
          studentProfileId: student.studentProfileId,
          statusCode: marks[student.studentProfileId] ?? "PRESENT",
        })),
      });
      if (draftKey) localStorage.removeItem(draftKey);
      setDraftPending(false);
      setCorrectionReason("");
      setMessage("Attendance synchronized successfully.");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Attendance could not be submitted.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function lockSession() {
    if (!data?.session) return;
    setSaving(true);
    try {
      await mutate({
        action: "student.session.lock",
        sessionId: data.session.id,
      });
      setMessage("Attendance session locked.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Locking failed.");
    } finally {
      setSaving(false);
    }
  }

  async function markStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staffProfileId) return;
    setSaving(true);
    try {
      await mutate({
        action: "staff.check",
        staffProfileId,
        date,
        checkInAt: new Date().toISOString(),
        source: "MANUAL",
      });
      setMessage("Staff check-in recorded.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Check-in failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="attendance-workspace">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Student and staff attendance</p>
          <h1>Attendance workspace</h1>
          <p>
            Mark daily or period attendance, manage locks, and review monthly
            exceptions in the selected campus and academic year.
          </p>
        </div>
        <div
          className={`sync-state ${online ? "synced" : "offline"}`}
          role="status"
          aria-live="polite"
        >
          {online
            ? draftPending
              ? "Online · local draft not yet synchronized"
              : "Online · synchronized"
            : "Offline · changes remain only on this device"}
        </div>
      </header>

      {!online && (
        <div className="offline-warning" role="alert">
          You are offline. Draft changes are stored only in this browser and are
          not part of the official attendance register until submitted.
        </div>
      )}

      <form
        className="attendance-filters"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor="attendance-date">
          Attendance date
          <input
            id="attendance-date"
            name="attendanceDate"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label htmlFor="attendance-section">
          Class and section
          <select
            id="attendance-section"
            name="sectionId"
            value={sectionId}
            onChange={(event) => setSectionId(event.target.value)}
          >
            {data?.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.gradeClass.name} · {section.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="attendance-period">
          Attendance mode
          <select
            id="attendance-period"
            name="periodId"
            value={periodId}
            onChange={(event) => setPeriodId(event.target.value)}
          >
            <option value="">Daily attendance</option>
            {data?.periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name}
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
          <button className="button secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="student-state" role="status">
          Loading attendance register…
        </div>
      ) : !data?.sections.length ? (
        <div className="student-state">
          <h2>No assigned sections</h2>
          <p>
            A teacher can mark only sections covered by an active teaching
            assignment.
          </p>
        </div>
      ) : (
        <form className="attendance-register" onSubmit={submitAttendance}>
          <div className="attendance-register-head">
            <div>
              <h2>Student register</h2>
              <p>
                {data.roster.length} learners ·{" "}
                {data.session?.state ?? "Not marked"}
              </p>
            </div>
            {data.permissions.canLock && data.session?.state === "OPEN" && (
              <button
                type="button"
                className="button secondary"
                disabled={saving}
                onClick={() => void lockSession()}
              >
                Lock attendance
              </button>
            )}
          </div>
          {data.session?.state === "LOCKED" && (
            <div className="offline-warning" role="status">
              This attendance session is locked. An approved reopening request
              is required before correction.
            </div>
          )}
          <ol className="attendance-roster">
            {data.roster.map((student) => {
              const name =
                student.studentProfile.person.preferredName ??
                `${student.studentProfile.person.firstName} ${student.studentProfile.person.lastName}`;
              return (
                <li key={student.studentProfileId}>
                  <div className="attendance-student">
                    <strong>{name}</strong>
                    <span>
                      Roll {student.rollNumber ?? "—"} ·{" "}
                      {student.studentProfile.studentNumber}
                    </span>
                  </div>
                  <fieldset
                    className="attendance-statuses"
                    disabled={data.session?.state === "LOCKED" || saving}
                  >
                    <legend className="visually-hidden">
                      Attendance status for {name}
                    </legend>
                    {data.statuses.map((status) => {
                      const inputId = `${student.studentProfileId}-${status.code}`;
                      return (
                        <span key={status.id}>
                          <input
                            className="visually-hidden attendance-radio"
                            id={inputId}
                            type="radio"
                            name={`status-${student.studentProfileId}`}
                            value={status.code}
                            checked={
                              marks[student.studentProfileId] === status.code
                            }
                            onChange={() =>
                              updateMark(student.studentProfileId, status.code)
                            }
                          />
                          <label htmlFor={inputId}>{status.name}</label>
                        </span>
                      );
                    })}
                  </fieldset>
                </li>
              );
            })}
          </ol>
          {data.permissions.canCorrect && (
            <label className="correction-reason" htmlFor="correction-reason">
              Correction reason
              <span id="correction-hint">
                Required when changing saved or previous-day attendance.
              </span>
              <textarea
                id="correction-reason"
                name="correctionReason"
                aria-describedby="correction-hint"
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
                maxLength={500}
              />
            </label>
          )}
          <div className="attendance-submit-bar">
            <span>
              {draftPending
                ? "Draft changes are awaiting synchronization."
                : "No unsynchronized changes."}
            </span>
            <button
              className="button primary"
              type="submit"
              disabled={
                saving ||
                !data.permissions.canMark ||
                data.session?.state === "LOCKED"
              }
            >
              {saving ? "Submitting…" : "Submit attendance"}
            </button>
          </div>
        </form>
      )}

      <section
        className="attendance-report-grid"
        aria-labelledby="reports-title"
      >
        <h2 id="reports-title">Monthly attendance reports</h2>
        <article>
          <h3>Defaulters below 75%</h3>
          {data?.reports.defaulters.length ? (
            <ul>
              {data.reports.defaulters.map((item) => (
                <li key={item.studentProfileId}>
                  <strong>{item.name}</strong>
                  <span>{item.percentage}% attendance</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No attendance defaulters for this month.</p>
          )}
        </article>
        <article>
          <h3>Consecutive absence alerts</h3>
          {data?.reports.consecutiveAbsenceAlerts.length ? (
            <ul>
              {data.reports.consecutiveAbsenceAlerts.map((item) => (
                <li key={item.studentProfileId}>
                  <strong>{item.name}</strong>
                  <span>{item.consecutiveAbsences} consecutive absences</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No three-day absence alerts.</p>
          )}
        </article>
        <article>
          <h3>Staff monthly summary</h3>
          {data?.reports.staffSummaries.length ? (
            <ul>
              {data.reports.staffSummaries.map((item) => (
                <li key={item.staffProfileId}>
                  <strong>{item.name}</strong>
                  <span>
                    {item.markedDays} days · {item.lateDays} late ·{" "}
                    {item.earlyMinutes} early minutes
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No staff attendance recorded for this month.</p>
          )}
          {data?.permissions.canMarkStaff && (
            <form className="staff-check-form" onSubmit={markStaff}>
              <label htmlFor="staff-member">
                Staff member
                <select
                  id="staff-member"
                  name="staffProfileId"
                  value={staffProfileId}
                  onChange={(event) => setStaffProfileId(event.target.value)}
                >
                  {data.staffRoster.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.person.firstName} {staff.person.lastName} ·{" "}
                      {staff.employeeCode}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button secondary"
                type="submit"
                disabled={saving}
              >
                Record check-in now
              </button>
            </form>
          )}
        </article>
      </section>
    </div>
  );
}
