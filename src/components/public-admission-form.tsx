"use client";

import { useEffect, useState, type FormEvent } from "react";

type FormField = {
  key: string;
  label: string;
  type:
    "text" | "email" | "phone" | "date" | "textarea" | "select" | "checkbox";
  required: boolean;
  helpText?: string;
  options?: string[];
};

type PublicForm = {
  kind: "ENQUIRY" | "APPLICATION";
  name: string;
  schoolName: string;
  academicYearName: string;
  formToken: string;
  fields: FormField[];
  targetGrades: Array<{ id: string; name: string; available: number }>;
};

export function PublicAdmissionForm({ publicKey }: { publicKey: string }) {
  const [form, setForm] = useState<PublicForm>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/public/admissions/${encodeURIComponent(publicKey)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setForm((await response.json()) as PublicForm);
      })
      .catch(() => setError("This admission form is not available."))
      .finally(() => setLoading(false));
  }, [publicKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const answers = Object.fromEntries(
      form.fields.map((field) => [
        field.key,
        field.type === "checkbox"
          ? values.get(field.key) === "on"
          : String(values.get(field.key) ?? ""),
      ]),
    );
    try {
      const response = await fetch(
        `/api/public/admissions/${encodeURIComponent(publicKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            formToken: form.formToken,
            website: String(values.get("website") ?? ""),
            applicantName: String(values.get("applicantName") ?? ""),
            dateOfBirth: String(values.get("dateOfBirth") ?? "") || undefined,
            email: String(values.get("email") ?? "") || undefined,
            phone: String(values.get("phone") ?? "") || undefined,
            source: "SCHOOL_WEBSITE",
            targetGradeClassId:
              String(values.get("targetGradeClassId") ?? "") || undefined,
            answers,
          }),
        },
      );
      const result = (await response.json()) as {
        referenceNumber?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error);
      setReference(result.referenceNumber ?? "submitted");
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "The form could not be submitted. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function syncAriaInvalid(target: EventTarget) {
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      if (target.checkValidity()) target.removeAttribute("aria-invalid");
      else target.setAttribute("aria-invalid", "true");
    }
  }

  if (loading)
    return (
      <main className="public-admission-shell">
        <div className="public-admission-card" role="status">
          Loading admission form…
        </div>
      </main>
    );
  if (error && !form)
    return (
      <main className="public-admission-shell">
        <div className="public-admission-card error" role="alert">
          {error}
        </div>
      </main>
    );
  if (reference)
    return (
      <main className="public-admission-shell">
        <section className="public-admission-card" aria-live="polite">
          <p className="eyebrow">Submission received</p>
          <h1>Thank you</h1>
          <p>Your details have been sent securely to the admissions team.</p>
          <p>
            <strong>Reference:</strong> {reference}
          </p>
          <p>Keep this reference for future communication.</p>
        </section>
      </main>
    );
  if (!form) return null;
  return (
    <main className="public-admission-shell">
      <section className="public-admission-card">
        <p className="eyebrow">
          {form.kind === "ENQUIRY"
            ? "Admission enquiry"
            : "Admission application"}
        </p>
        <h1>{form.name}</h1>
        <p>
          {form.schoolName} · {form.academicYearName}
        </p>
        <p className="privacy-note">
          Your details are used only to process this admission request. Required
          fields are marked with an asterisk.
        </p>
        <form
          onSubmit={submit}
          onInvalid={(event) => syncAriaInvalid(event.target)}
          onInput={(event) => syncAriaInvalid(event.target)}
          className="public-admission-form"
        >
          <label>
            Applicant name <span aria-hidden="true">*</span>
            <input
              name="applicantName"
              autoComplete="name"
              required
              maxLength={160}
            />
          </label>
          <label>
            Date of birth
            <input name="dateOfBirth" type="date" autoComplete="bday" />
          </label>
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
            />
          </label>
          <label>
            Mobile number
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              pattern="\+?[1-9]\d{7,14}"
            />
          </label>
          {form.targetGrades.length ? (
            <label>
              Class applying for{" "}
              {form.kind === "APPLICATION" ? (
                <span aria-hidden="true">*</span>
              ) : null}
              <select
                name="targetGradeClassId"
                required={form.kind === "APPLICATION"}
              >
                <option value="">Select class</option>
                {form.targetGrades.map((grade) => (
                  <option
                    key={grade.id}
                    value={grade.id}
                    disabled={grade.available === 0}
                  >
                    {grade.name} · {grade.available} seats available
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="admission-honeypot" aria-hidden="true">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {form.fields.map((field) => (
            <label
              key={field.key}
              className={
                field.type === "checkbox" ? "checkbox-field" : undefined
              }
            >
              {field.type === "checkbox" ? (
                <>
                  <input
                    name={field.key}
                    type="checkbox"
                    required={field.required}
                  />{" "}
                  {field.label}
                </>
              ) : (
                <>
                  {field.label}
                  {field.required ? <span aria-hidden="true"> *</span> : null}
                  {field.type === "textarea" ? (
                    <textarea
                      name={field.key}
                      required={field.required}
                      maxLength={2000}
                      aria-describedby={
                        field.helpText ? `${field.key}-help` : undefined
                      }
                    />
                  ) : field.type === "select" ? (
                    <select name={field.key} required={field.required}>
                      <option value="">Select</option>
                      {field.options?.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={field.key}
                      type={field.type === "phone" ? "tel" : field.type}
                      required={field.required}
                      maxLength={500}
                      aria-describedby={
                        field.helpText ? `${field.key}-help` : undefined
                      }
                    />
                  )}
                </>
              )}
              {field.helpText ? (
                <small id={`${field.key}-help`}>{field.helpText}</small>
              ) : null}
            </label>
          ))}
          {error ? (
            <div className="form-error" role="alert">
              {error}
            </div>
          ) : null}
          <button
            className="button primary"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Submitting securely…"
              : form.kind === "ENQUIRY"
                ? "Send enquiry"
                : "Submit application"}
          </button>
        </form>
      </section>
    </main>
  );
}
