"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Setup = {
  academicYears: Array<{ id: string; name: string; status: string }>;
  school: { campuses: Array<{ id: string; name: string }> };
  sections: Array<{
    id: string;
    name: string;
    campusId: string;
    academicYearId: string;
    gradeClassId: string;
  }>;
  grades: Array<{ id: string; name: string }>;
};

export function StudentCreateForm() {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch("/api/v1/school-setup", { cache: "no-store" }).then(
      async (response) => {
        if (response.ok) setSetup((await response.json()) as Setup);
      },
    );
  }, []);
  async function submit(form: FormData) {
    setBusy(true);
    setMessage("");
    const data = Object.fromEntries(form);
    const response = await fetch("/api/v1/students", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "student.create",
        data: {
          ...data,
          transportEligible: form.has("transportEligible"),
          hostelEligible: form.has("hostelEligible"),
          sectionId: data.sectionId || undefined,
          phone: data.phone || undefined,
          email: data.email || undefined,
          preferredName: data.preferredName || undefined,
        },
      }),
    });
    const body = (await response.json()) as { id?: string; error?: string };
    if (response.ok && body.id) router.push(`/students/${body.id}` as Route);
    else setMessage(body.error ?? "Student could not be created.");
    setBusy(false);
  }
  return (
    <div className="student-workspace narrow">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Admission</p>
          <h1>Create student</h1>
          <p>
            Admission numbers are reserved from the school’s configured
            numbering rule.
          </p>
        </div>
      </header>
      <form className="student-form panel" action={(form) => void submit(form)}>
        <fieldset>
          <legend>Basic information</legend>
          <div className="form-grid">
            <label>
              First name
              <input name="firstName" required maxLength={120} />
            </label>
            <label>
              Last name
              <input name="lastName" required maxLength={120} />
            </label>
            <label>
              Preferred name
              <input name="preferredName" maxLength={120} />
            </label>
            <label>
              Date of birth
              <input name="dateOfBirth" type="date" required />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Admission and contact</legend>
          <div className="form-grid">
            <label>
              Admission date
              <input name="admissionDate" type="date" required />
            </label>
            <label>
              Academic year
              <select name="academicYearId" required defaultValue="">
                <option value="" disabled>
                  Select year
                </option>
                {setup?.academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Campus
              <select name="campusId" required defaultValue="">
                <option value="" disabled>
                  Select campus
                </option>
                {setup?.school.campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Section (optional)
              <select name="sectionId" defaultValue="">
                <option value="">Admit without enrolment</option>
                {setup?.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {
                      setup.grades.find(
                        (grade) => grade.id === section.gradeClassId,
                      )?.name
                    }{" "}
                    · {section.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Phone
              <input name="phone" type="tel" autoComplete="tel" />
            </label>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Eligibility</legend>
          <div className="check-row">
            <label>
              <input name="transportEligible" type="checkbox" /> Transport
              eligible
            </label>
            <label>
              <input name="hostelEligible" type="checkbox" /> Hostel eligible
            </label>
          </div>
        </fieldset>
        {message && (
          <p className="form-message error" role="alert">
            {message}
          </p>
        )}
        <div className="form-actions">
          <Link className="button secondary" href={"/students" as Route}>
            Cancel
          </Link>
          <button className="button primary" disabled={busy || !setup}>
            {busy ? "Creating…" : "Create student"}
          </button>
        </div>
      </form>
    </div>
  );
}
