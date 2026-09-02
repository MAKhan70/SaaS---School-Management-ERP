"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

type Profile = Record<string, unknown> & {
  id: string;
  studentNumber: string;
  lifecycleStatus: string;
  transportEligible: boolean;
  hostelEligible: boolean;
  sensitiveAccess: boolean;
  person: {
    firstName: string;
    lastName: string;
    preferredName?: string | null;
    dateOfBirth?: string | null;
    contacts: Array<{ id: string; type: string; value: string }>;
    addresses: Array<{
      id: string;
      type: string;
      line1: string;
      city: string;
      stateCode: string;
      postalCode: string;
    }>;
    sensitiveIdentifiers: Array<{
      id: string;
      type: string;
      maskedValue: string;
    }>;
  };
  admissions: Array<Record<string, unknown>>;
  guardianRelationships: Array<{
    id: string;
    relationshipType: string;
    isPrimary: boolean;
    canPickUp: boolean;
    guardianPerson: {
      firstName: string;
      lastName: string;
      contacts: Array<{ type: string; value: string }>;
    };
  }>;
  emergencyContacts: Array<{
    id: string;
    name: string;
    relationship: string;
    phone: string;
  }>;
  enrollments: Array<{
    id: string;
    status: string;
    startsOn: string;
    endsOn?: string;
    rollNumber?: string;
    academicYear: { name: string };
    campus: { name: string };
    section: { name: string; gradeClass: { name: string } };
  }>;
  enrollmentEvents: Array<{
    id: string;
    type: string;
    occurredOn: string;
    reason?: string;
  }>;
  documents: Array<{
    id: string;
    displayName: string;
    type: string;
    status: string;
  }>;
  notes: Array<{
    id: string;
    body: string;
    visibility: string;
    createdAt: string;
  }>;
  tags: Array<{ id: string; tag: { label: string } }>;
  houseAssignments: Array<{
    id: string;
    house: { name: string };
    academicYear: { name: string };
  }>;
  identityCards: Array<{ id: string; cardNumber: string; status: string }>;
  sensitive?: Array<{ type: string; value: unknown }>;
};

const sections = [
  "overview",
  "admission",
  "contacts",
  "guardians",
  "academic",
  "health",
  "documents",
  "notes",
  "identity",
] as const;

type Setup = {
  academicYears: Array<{ id: string; name: string }>;
  school: { campuses: Array<{ id: string; name: string }> };
  sections: Array<{
    id: string;
    name: string;
    gradeClassId: string;
  }>;
  grades: Array<{ id: string; name: string }>;
};

function StudentActions({ student }: { student: Profile }) {
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
  async function mutate(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/v1/students", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { error?: string };
    if (response.ok) window.location.reload();
    else setMessage(body.error ?? "The student change could not be saved.");
    setBusy(false);
  }
  return (
    <section className="student-operation-panel" aria-label="Student actions">
      <details>
        <summary>Edit student</summary>
        <form
          className="compact-form"
          action={(form) =>
            void mutate({
              action: "student.update",
              studentId: student.id,
              data: {
                firstName: form.get("firstName"),
                lastName: form.get("lastName"),
                preferredName: form.get("preferredName") || undefined,
                phone: form.get("phone") || undefined,
                email: form.get("email") || undefined,
                transportEligible: form.has("transportEligible"),
                hostelEligible: form.has("hostelEligible"),
              },
            })
          }
        >
          <label>
            First name
            <input
              name="firstName"
              required
              defaultValue={student.person.firstName}
            />
          </label>
          <label>
            Last name
            <input
              name="lastName"
              required
              defaultValue={student.person.lastName}
            />
          </label>
          <label>
            Preferred name
            <input
              name="preferredName"
              defaultValue={student.person.preferredName ?? ""}
            />
          </label>
          <label>
            Phone
            <input name="phone" type="tel" />
          </label>
          <label>
            Email
            <input name="email" type="email" />
          </label>
          <label className="inline-check">
            <input
              name="transportEligible"
              type="checkbox"
              defaultChecked={student.transportEligible}
            />{" "}
            Transport eligible
          </label>
          <label className="inline-check">
            <input
              name="hostelEligible"
              type="checkbox"
              defaultChecked={student.hostelEligible}
            />{" "}
            Hostel eligible
          </label>
          <button className="button primary" disabled={busy}>
            Save profile
          </button>
        </form>
      </details>
      <details>
        <summary>Assign guardian</summary>
        <form
          className="compact-form"
          action={(form) =>
            void mutate({
              action: "guardian.assign",
              studentId: student.id,
              firstName: form.get("firstName"),
              lastName: form.get("lastName"),
              phone: form.get("phone"),
              email: form.get("email") || undefined,
              relationshipType: form.get("relationshipType"),
              effectiveFrom: form.get("effectiveFrom"),
              priority: Number(form.get("priority")),
              isPrimary: form.has("isPrimary"),
              canPickUp: form.has("canPickUp"),
              receivesCommunication: form.has("receivesCommunication"),
              hasCustody: form.has("hasCustody"),
            })
          }
        >
          <label>
            First name
            <input name="firstName" required />
          </label>
          <label>
            Last name
            <input name="lastName" required />
          </label>
          <label>
            Phone
            <input name="phone" type="tel" required />
          </label>
          <label>
            Email
            <input name="email" type="email" />
          </label>
          <label>
            Relationship
            <select name="relationshipType">
              <option value="FATHER">Father</option>
              <option value="MOTHER">Mother</option>
              <option value="LEGAL_GUARDIAN">Legal guardian</option>
              <option value="GRANDPARENT">Grandparent</option>
              <option value="SIBLING">Sibling</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label>
            Effective from
            <input name="effectiveFrom" type="date" required />
          </label>
          <label>
            Priority
            <input
              name="priority"
              type="number"
              min="1"
              defaultValue="1"
              required
            />
          </label>
          <label className="inline-check">
            <input name="isPrimary" type="checkbox" /> Primary guardian
          </label>
          <label className="inline-check">
            <input name="canPickUp" type="checkbox" /> Pickup permitted
          </label>
          <label className="inline-check">
            <input
              name="receivesCommunication"
              type="checkbox"
              defaultChecked
            />{" "}
            Receives communication
          </label>
          <label className="inline-check">
            <input name="hasCustody" type="checkbox" /> Has custody
          </label>
          <button className="button primary" disabled={busy}>
            Assign guardian
          </button>
        </form>
      </details>
      <details>
        <summary>Enrolment and lifecycle</summary>
        <form
          className="compact-form"
          action={(form) => {
            const action = String(form.get("action"));
            void mutate({
              action,
              studentId: student.id,
              effectiveOn: form.get("effectiveOn"),
              academicYearId: form.get("academicYearId") || undefined,
              campusId: form.get("campusId") || undefined,
              sectionId: form.get("sectionId") || undefined,
              schoolId: form.get("schoolId") || undefined,
              rollNumber: form.get("rollNumber") || undefined,
              reason: form.get("reason") || undefined,
            });
          }}
        >
          <label>
            Workflow
            <select name="action" required>
              <option value="enrollment.enrol">Enrol in academic year</option>
              <option value="enrollment.transfer-section">
                Transfer section
              </option>
              <option value="enrollment.promote">Promote</option>
              <option value="enrollment.detain">Detain</option>
              <option value="enrollment.withdraw">Withdraw</option>
              <option value="enrollment.transfer-school">
                Transfer school
              </option>
              <option value="enrollment.graduate">Graduate</option>
              <option value="enrollment.mark-alumni">Mark as alumni</option>
            </select>
          </label>
          <label>
            Effective on
            <input name="effectiveOn" type="date" required />
          </label>
          <label>
            Academic year
            <select name="academicYearId" defaultValue="">
              <option value="">Not applicable</option>
              {setup?.academicYears.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Campus
            <select name="campusId" defaultValue="">
              <option value="">Not applicable</option>
              {setup?.school.campuses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Class and section
            <select name="sectionId" defaultValue="">
              <option value="">Not applicable</option>
              {setup?.sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {
                    setup.grades.find((grade) => grade.id === item.gradeClassId)
                      ?.name
                  }{" "}
                  · {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Destination school ID
            <input name="schoolId" aria-describedby="school-transfer-help" />
          </label>
          <small id="school-transfer-help">
            Required only for a school transfer; use an authorised school ID.
          </small>
          <label>
            Roll number
            <input name="rollNumber" />
          </label>
          <label>
            Reason
            <input name="reason" maxLength={500} />
          </label>
          <button className="button primary" disabled={busy}>
            Apply workflow
          </button>
        </form>
      </details>
      <details>
        <summary>Archive or restore</summary>
        <form
          className="compact-form"
          action={(form) =>
            void mutate({
              action: form.get("action"),
              studentId: student.id,
              reason: form.get("reason"),
            })
          }
        >
          <label>
            Action
            <select name="action">
              <option value="student.archive">Archive student</option>
              <option value="student.restore">Restore archived student</option>
            </select>
          </label>
          <label>
            Reason
            <input name="reason" minLength={10} maxLength={500} required />
          </label>
          <button className="button secondary" disabled={busy}>
            Apply
          </button>
        </form>
      </details>
      {message && (
        <p className="form-message error" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
export function StudentProfile({ studentId }: { studentId: string }) {
  const [student, setStudent] = useState<Profile>();
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch(`/api/v1/students/${studentId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setStudent((await response.json()) as Profile);
      })
      .catch(() => setError("The student profile could not be loaded."));
  }, [studentId]);
  if (error)
    return (
      <div className="student-state error" role="alert">
        {error}
      </div>
    );
  if (!student)
    return (
      <div className="student-state" role="status">
        Loading student profile…
      </div>
    );
  const name =
    student.person.preferredName ||
    `${student.person.firstName} ${student.person.lastName}`;
  return (
    <div className="student-workspace">
      <header className="student-profile-head">
        <div className="student-avatar" aria-hidden="true">
          {student.person.firstName[0]}
          {student.person.lastName[0]}
        </div>
        <div>
          <p className="eyebrow">{student.studentNumber}</p>
          <h1>{name}</h1>
          <p>
            <span className="status-chip">
              {student.lifecycleStatus.toLowerCase()}
            </span>
          </p>
        </div>
        <div className="student-actions">
          <Link className="button secondary" href={"/students" as Route}>
            Back to directory
          </Link>
        </div>
      </header>
      <StudentActions student={student} />
      <nav className="profile-tabs" aria-label="Student profile sections">
        {sections.map((section) => (
          <a key={section} href={`#${section}`}>
            {section}
          </a>
        ))}
      </nav>
      <div className="profile-grid">
        <section id="overview" className="panel">
          <h2>Basic information</h2>
          <dl className="detail-list">
            <div>
              <dt>Legal name</dt>
              <dd>
                {student.person.firstName} {student.person.lastName}
              </dd>
            </div>
            <div>
              <dt>Date of birth</dt>
              <dd>
                {student.person.dateOfBirth
                  ? new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    }).format(new Date(student.person.dateOfBirth))
                  : "Not recorded"}
              </dd>
            </div>
            <div>
              <dt>Transport eligibility</dt>
              <dd>{student.transportEligible ? "Eligible" : "Not eligible"}</dd>
            </div>
            <div>
              <dt>Hostel eligibility</dt>
              <dd>{student.hostelEligible ? "Eligible" : "Not eligible"}</dd>
            </div>
          </dl>
          <h3>Tags</h3>
          <p>
            {student.tags.map((item) => item.tag.label).join(", ") || "No tags"}
          </p>
        </section>
        <section id="admission" className="panel">
          <h2>Admission information</h2>
          {student.admissions.length ? (
            <pre className="safe-json">
              {JSON.stringify(student.admissions, null, 2)}
            </pre>
          ) : (
            <p>No admission history.</p>
          )}
        </section>
        <section id="contacts" className="panel">
          <h2>Contact and address</h2>
          {student.person.contacts.map((contact) => (
            <p key={contact.id}>
              <strong>{contact.type.toLowerCase()}:</strong> {contact.value}
            </p>
          ))}
          {student.person.addresses.map((address) => (
            <address key={address.id}>
              {address.line1}, {address.city}, {address.stateCode}{" "}
              {address.postalCode}
            </address>
          ))}
        </section>
        <section id="guardians" className="panel">
          <h2>Parents, guardians and emergency contacts</h2>
          {student.guardianRelationships.map((item) => (
            <article key={item.id} className="sub-card">
              <strong>
                {item.guardianPerson.firstName} {item.guardianPerson.lastName}
              </strong>
              <p>
                {item.relationshipType.toLowerCase()}{" "}
                {item.isPrimary ? "· primary" : ""}{" "}
                {item.canPickUp ? "· pickup permitted" : ""}
              </p>
            </article>
          ))}
          {!student.guardianRelationships.length && (
            <p>No guardians assigned.</p>
          )}
          <h3>Emergency contacts</h3>
          {student.emergencyContacts.map((contact) => (
            <p key={contact.id}>
              {contact.name} · {contact.relationship} · {contact.phone}
            </p>
          ))}
        </section>
        <section id="academic" className="panel span-two">
          <h2>Enrolment timeline and academic history</h2>
          <ol className="timeline">
            {student.enrollments.map((item) => (
              <li key={item.id}>
                <strong>
                  {item.academicYear.name}: {item.section.gradeClass.name} ·{" "}
                  {item.section.name}
                </strong>
                <span>
                  {item.campus.name} · {item.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ol>
          <h3>Lifecycle events</h3>
          <ol className="timeline compact">
            {student.enrollmentEvents.map((event) => (
              <li key={event.id}>
                <strong>{event.type.toLowerCase().replaceAll("_", " ")}</strong>
                <span>
                  {new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(new Date(event.occurredOn))}
                  {event.reason ? ` · ${event.reason}` : ""}
                </span>
              </li>
            ))}
          </ol>
          <h3>House assignments</h3>
          <p>
            {student.houseAssignments
              .map((item) => `${item.house.name} (${item.academicYear.name})`)
              .join(", ") || "No house assigned"}
          </p>
        </section>
        <section id="health" className="panel">
          <h2>Medical alerts, allergies and accommodations</h2>
          {student.sensitiveAccess ? (
            student.sensitive?.length ? (
              <pre className="safe-json">
                {JSON.stringify(student.sensitive, null, 2)}
              </pre>
            ) : (
              <p>No sensitive records.</p>
            )
          ) : (
            <div className="permission-note">
              You do not have permission to view restricted health or
              demographic information.
            </div>
          )}
          <h3>Masked identifiers</h3>
          {student.person.sensitiveIdentifiers.map((item) => (
            <p key={item.id}>
              {item.type}: {item.maskedValue}
            </p>
          ))}
        </section>
        <section id="documents" className="panel">
          <h2>Documents</h2>
          {student.documents.map((document) => (
            <p key={document.id}>
              <a href={`/api/v1/students/documents/${document.id}`}>
                {document.displayName}
              </a>{" "}
              · {document.status.toLowerCase()}
            </p>
          ))}
          {!student.documents.length && <p>No documents registered.</p>}
        </section>
        <section id="notes" className="panel">
          <h2>Notes</h2>
          {student.notes.map((note) => (
            <article className="sub-card" key={note.id}>
              <p>{note.body}</p>
              <small>{note.visibility.toLowerCase()}</small>
            </article>
          ))}
          {!student.notes.length && <p>No notes.</p>}
        </section>
        <section id="identity" className="panel">
          <h2>Student identity card</h2>
          <div className="identity-card-placeholder">
            <strong>{name}</strong>
            <span>{student.studentNumber}</span>
            <small>
              {student.identityCards[0]?.status.toLowerCase() ?? "Not issued"}
            </small>
            <p>Photograph and QR placeholder</p>
          </div>
        </section>
      </div>
    </div>
  );
}
