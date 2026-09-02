"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

type Preview = {
  accepted: Array<Record<string, string>>;
  errors: Array<{ row: number; message: string }>;
};
export function StudentImport() {
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function previewFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/v1/students/import", {
      method: "POST",
      headers: { "content-type": "text/csv" },
      body: await file.text(),
    });
    if (response.ok) setPreview((await response.json()) as Preview);
    else setMessage("The import preview could not be generated.");
    setBusy(false);
  }
  async function commit() {
    if (!preview) return;
    setBusy(true);
    const rows = preview.accepted.map((row) => ({
      ...row,
      sectionId: row.sectionId || undefined,
      phone: row.phone || undefined,
      email: row.email || undefined,
      transportEligible: false,
      hostelEligible: false,
    }));
    const response = await fetch("/api/v1/students/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const body = (await response.json()) as {
      imported?: number;
      error?: string;
    };
    setMessage(
      response.ok
        ? `${body.imported ?? 0} students imported in one transaction.`
        : (body.error ??
            "No students were imported; correct the file and retry."),
    );
    setBusy(false);
  }
  function downloadErrors() {
    if (!preview?.errors.length) return;
    const csv = [
      "row,message",
      ...preview.errors.map(
        (error) => `${error.row},"${error.message.replaceAll('"', '""')}"`,
      ),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "student-import-errors.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <div className="student-workspace narrow">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Bulk admission</p>
          <h1>Import students</h1>
          <p>
            Validate up to 250 synthetic or authorised student rows before
            creating records.
          </p>
        </div>
        <Link
          className="button secondary"
          href={"/api/v1/students/template" as Route}
          prefetch={false}
        >
          Download CSV template
        </Link>
      </header>
      <section className="panel import-panel">
        <label className="file-drop">
          Student CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void previewFile(event.target.files?.[0])}
            disabled={busy}
          />
          <span>
            Choose a CSV file to validate. The file is not written to client
            logs or analytics.
          </span>
        </label>
        {busy && <p role="status">Processing authorised rows…</p>}
        {message && <p role="status">{message}</p>}
        {preview && (
          <>
            <div className="import-summary">
              <strong>{preview.accepted.length} ready</strong>
              <strong>{preview.errors.length} errors</strong>
            </div>
            {preview.errors.length > 0 && (
              <div className="error-report">
                <h2>Import error report</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.map((error) => (
                      <tr key={`${error.row}-${error.message}`}>
                        <td>{error.row}</td>
                        <td>{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="button secondary" onClick={downloadErrors}>
                  Download error report
                </button>
              </div>
            )}
            <div className="form-actions">
              <Link className="button secondary" href={"/students" as Route}>
                Cancel
              </Link>
              <button
                className="button primary"
                onClick={() => void commit()}
                disabled={busy || preview.accepted.length === 0}
              >
                Import valid rows
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
