"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { tenantFeatures } from "@/modules/platform-admin/domain/feature-catalogue";

type Client = {
  id: string;
  name: string;
  slug: string;
  status: string;
  schools: {
    id: string;
    name: string;
    campuses: { id: string; name: string }[];
  }[];
  featureGrants: { featureKey: string }[];
  staffInvitations: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    status: string;
    expiresAt: string | Date;
  }[];
};

export function PlatformClientAdmin({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  async function provision(formData: FormData) {
    setPending(true);
    setMessage(undefined);
    const response = await fetch("/api/platform/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trustName: formData.get("trustName"),
        trustSlug: formData.get("trustSlug"),
        schoolName: formData.get("schoolName"),
        schoolCode: formData.get("schoolCode"),
        campusName: formData.get("campusName"),
        campusCode: formData.get("campusCode"),
        academicYearName: formData.get("academicYearName"),
        academicYearCode: formData.get("academicYearCode"),
        academicYearStartsOn: formData.get("academicYearStartsOn"),
        academicYearEndsOn: formData.get("academicYearEndsOn"),
        boardType: formData.get("boardType"),
        administratorFirstName: formData.get("administratorFirstName"),
        administratorLastName: formData.get("administratorLastName"),
        administratorEmail: formData.get("administratorEmail"),
        administratorPhone: formData.get("administratorPhone"),
        featureKeys: formData.getAll("featureKeys"),
      }),
    });
    const body = (await response.json()) as {
      deliveryStatus?: string;
      error?: string;
    };
    setPending(false);
    setMessage(
      response.ok
        ? `Client created. Invitation delivery: ${body.deliveryStatus === "SENT" ? "sent" : "awaiting provider configuration"}.`
        : (body.error ?? "Client could not be created."),
    );
    if (response.ok) router.refresh();
  }

  async function updateFeatures(clientId: string, formData: FormData) {
    setPending(true);
    const response = await fetch(`/api/platform/clients/${clientId}/features`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ featureKeys: formData.getAll("featureKeys") }),
    });
    setPending(false);
    setMessage(
      response.ok
        ? "Feature access updated."
        : "Feature access could not be updated.",
    );
    if (response.ok) router.refresh();
  }

  async function enterWorkspace(clientId: string, formData: FormData) {
    setPending(true);
    const response = await fetch(`/api/platform/clients/${clientId}/support`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: formData.get("reason"),
        durationMinutes: 30,
      }),
    });
    setPending(false);
    if (response.ok) router.push("/dashboard?support=true");
    else setMessage("Support access could not be started.");
  }

  return (
    <div className="platform-admin-workspace">
      <header className="page-heading">
        <div>
          <p className="eyebrow">NASAQ control plane</p>
          <h1>Client administration</h1>
          <p>
            Provision isolated school tenants, control licensed features, and
            start audited test access.
          </p>
        </div>
      </header>
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      <section className="panel" aria-labelledby="new-client-heading">
        <h2 id="new-client-heading">Onboard a school client</h2>
        <form
          className="platform-client-form"
          action={(data) => void provision(data)}
        >
          <fieldset>
            <legend>Organization</legend>
            <div className="form-grid">
              <label>
                Educational trust name
                <input name="trustName" required minLength={3} />
              </label>
              <label>
                Trust URL identifier
                <input
                  name="trustSlug"
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                />
              </label>
              <label>
                Primary school name
                <input name="schoolName" required />
              </label>
              <label>
                School code
                <input name="schoolCode" required pattern="[A-Z0-9-]+" />
              </label>
              <label>
                First campus name
                <input name="campusName" required />
              </label>
              <label>
                Campus code
                <input name="campusCode" required pattern="[A-Z0-9-]+" />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Academic setup</legend>
            <div className="form-grid">
              <label>
                Academic year name
                <input name="academicYearName" required />
              </label>
              <label>
                Academic year code
                <input name="academicYearCode" required pattern="[A-Z0-9-]+" />
              </label>
              <label>
                Starts on
                <input name="academicYearStartsOn" type="date" required />
              </label>
              <label>
                Ends on
                <input name="academicYearEndsOn" type="date" required />
              </label>
              <label>
                Board
                <select name="boardType" defaultValue="CBSE">
                  <option value="CBSE">CBSE</option>
                  <option value="CISCE">CISCE</option>
                  <option value="MAHARASHTRA_STATE">
                    Maharashtra State Board
                  </option>
                  <option value="OTHER_STATE">Other State Board</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Master administrator</legend>
            <div className="form-grid">
              <label>
                First name
                <input
                  name="administratorFirstName"
                  autoComplete="given-name"
                  required
                />
              </label>
              <label>
                Last name
                <input
                  name="administratorLastName"
                  autoComplete="family-name"
                  required
                />
              </label>
              <label>
                Email address
                <input
                  name="administratorEmail"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Phone number
                <input
                  name="administratorPhone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+919876543210"
                  required
                />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Granted features</legend>
            <div className="feature-grid">
              {tenantFeatures.map((feature) => (
                <label key={feature.key}>
                  <input
                    type="checkbox"
                    name="featureKeys"
                    value={feature.key}
                    defaultChecked
                  />{" "}
                  {feature.label}
                </label>
              ))}
            </div>
          </fieldset>
          <button className="button primary" type="submit" disabled={pending}>
            {pending ? "Creating client…" : "Create client and send invitation"}
          </button>
        </form>
      </section>
      <section aria-labelledby="clients-heading">
        <h2 id="clients-heading">Client environments</h2>
        <div className="client-grid">
          {clients.length === 0 ? (
            <p className="empty-state">No clients have been created.</p>
          ) : (
            clients.map((client) => {
              const enabled = new Set(
                client.featureGrants.map((grant) => grant.featureKey),
              );
              const invitation = client.staffInvitations[0];
              return (
                <article className="panel client-card" key={client.id}>
                  <div>
                    <h3>{client.name}</h3>
                    <p>
                      {client.schools.length} school(s) ·{" "}
                      {client.status.toLowerCase()}
                    </p>
                    {invitation && (
                      <small>
                        Administrator: {invitation.firstName}{" "}
                        {invitation.lastName} · {invitation.email} · invite{" "}
                        {invitation.status.toLowerCase()}
                      </small>
                    )}
                  </div>
                  <form action={(data) => void updateFeatures(client.id, data)}>
                    <fieldset>
                      <legend>Features</legend>
                      <div className="feature-grid">
                        {tenantFeatures.map((feature) => (
                          <label key={feature.key}>
                            <input
                              type="checkbox"
                              name="featureKeys"
                              value={feature.key}
                              defaultChecked={enabled.has(feature.key)}
                            />{" "}
                            {feature.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button
                      className="button secondary"
                      type="submit"
                      disabled={pending}
                    >
                      Save feature access
                    </button>
                  </form>
                  <form
                    className="support-access-form"
                    action={(data) => void enterWorkspace(client.id, data)}
                  >
                    <label>
                      Reason for test access
                      <input
                        name="reason"
                        minLength={10}
                        maxLength={300}
                        required
                        placeholder="Verify onboarding configuration"
                      />
                    </label>
                    <button className="button" type="submit" disabled={pending}>
                      Open client dashboard for 30 minutes
                    </button>
                  </form>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
