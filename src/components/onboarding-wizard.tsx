"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const steps = [
  "Organization",
  "Academic setup",
  "Administrator",
  "Initial staff",
] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        trustName: form.get("trustName"),
        trustSlug: form.get("trustSlug"),
        schoolName: form.get("schoolName"),
        schoolCode: form.get("schoolCode"),
        campusName: form.get("campusName"),
        campusCode: form.get("campusCode"),
        academicYearName: form.get("academicYearName"),
        academicYearCode: form.get("academicYearCode"),
        academicYearStartsOn: form.get("academicYearStartsOn"),
        academicYearEndsOn: form.get("academicYearEndsOn"),
        boardType: form.get("boardType"),
        administratorName: form.get("administratorName"),
        administratorEmail: form.get("administratorEmail"),
        administratorPassword: form.get("administratorPassword"),
        staffEmails: String(form.get("staffEmails") ?? "")
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
      }),
    });
    if (response.ok) router.push("/sign-in?onboarded=true");
    else {
      setError(
        "Onboarding could not be completed. Review the details or use a different trust slug and administrator email.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form className="onboarding-card" onSubmit={submit} noValidate>
      <nav aria-label="Onboarding progress">
        <ol className="step-list">
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              data-complete={index < step}
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>
      </nav>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <fieldset hidden={step !== 0}>
        <legend>Trust, school, and campus</legend>
        <label htmlFor="trustName">Educational trust name</label>
        <input id="trustName" name="trustName" required minLength={3} />
        <label htmlFor="trustSlug">Trust URL identifier</label>
        <input
          id="trustSlug"
          name="trustSlug"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
          aria-describedby="slug-hint"
        />
        <small id="slug-hint">Lowercase letters, numbers, and hyphens.</small>
        <label htmlFor="schoolName">Primary school name</label>
        <input id="schoolName" name="schoolName" required />
        <label htmlFor="schoolCode">School code</label>
        <input
          id="schoolCode"
          name="schoolCode"
          pattern="[A-Z0-9-]+"
          required
        />
        <label htmlFor="campusName">First campus name</label>
        <input id="campusName" name="campusName" required />
        <label htmlFor="campusCode">Campus code</label>
        <input
          id="campusCode"
          name="campusCode"
          pattern="[A-Z0-9-]+"
          required
        />
      </fieldset>
      <fieldset hidden={step !== 1}>
        <legend>Academic year and board</legend>
        <label htmlFor="academicYearName">Academic year name</label>
        <input
          id="academicYearName"
          name="academicYearName"
          placeholder="2026–27"
          required
        />
        <label htmlFor="academicYearCode">Academic year code</label>
        <input
          id="academicYearCode"
          name="academicYearCode"
          placeholder="AY-2026-27"
          pattern="[A-Z0-9-]+"
          required
        />
        <label htmlFor="academicYearStartsOn">Starts on</label>
        <input
          id="academicYearStartsOn"
          name="academicYearStartsOn"
          type="date"
          required
        />
        <label htmlFor="academicYearEndsOn">Ends on</label>
        <input
          id="academicYearEndsOn"
          name="academicYearEndsOn"
          type="date"
          required
        />
        <label htmlFor="boardType">Board</label>
        <select id="boardType" name="boardType" required>
          <option value="CBSE">CBSE</option>
          <option value="CISCE">CISCE</option>
          <option value="MAHARASHTRA_STATE">Maharashtra State Board</option>
          <option value="OTHER_STATE">Other State Board</option>
        </select>
      </fieldset>
      <fieldset hidden={step !== 2}>
        <legend>Administrator account</legend>
        <label htmlFor="administratorName">Full name</label>
        <input
          id="administratorName"
          name="administratorName"
          autoComplete="name"
          required
        />
        <label htmlFor="administratorEmail">Email address</label>
        <input
          id="administratorEmail"
          name="administratorEmail"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
        />
        <label htmlFor="administratorPassword">Password</label>
        <small id="admin-password-hint">
          At least 12 characters with upper and lowercase letters and a number.
        </small>
        <input
          id="administratorPassword"
          name="administratorPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          aria-describedby="admin-password-hint"
          required
        />
      </fieldset>
      <fieldset hidden={step !== 3}>
        <legend>Invite initial staff</legend>
        <label htmlFor="staffEmails">Staff email addresses</label>
        <small id="staff-email-hint">
          Optional. Separate up to ten addresses with commas.
        </small>
        <textarea
          id="staffEmails"
          name="staffEmails"
          aria-describedby="staff-email-hint"
        />
        <div className="checklist">
          <h2>Onboarding checklist</h2>
          <ul>
            {[
              "Educational trust",
              "Primary school",
              "First campus",
              "Active academic year",
              "Board configuration",
              "Administrator account",
              "Initial staff invitations",
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </fieldset>
      <div className="wizard-actions">
        {step > 0 && (
          <button
            className="button secondary"
            type="button"
            onClick={() => setStep((current) => current - 1)}
          >
            Previous
          </button>
        )}
        {step < steps.length - 1 ? (
          <button
            key="continue"
            className="button primary"
            type="button"
            onClick={() => setStep((current) => current + 1)}
          >
            Continue
          </button>
        ) : (
          <button
            key="complete"
            className="button primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Creating workspace…" : "Complete onboarding"}
          </button>
        )}
      </div>
    </form>
  );
}
