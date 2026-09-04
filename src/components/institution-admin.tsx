"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  Building2,
  LoaderCircle,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type TrustProfile = {
  id: string;
  name: string;
  defaultLocale: string;
  defaultTimezone: string;
  defaultCurrency: string;
  status: string;
};

type SchoolProfile = {
  id: string;
  code: string;
  name: string;
  status: string;
  campuses: CampusProfile[];
};

type CampusProfile = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  status: string;
};

type InstitutionOverview = {
  trust: TrustProfile;
  school: SchoolProfile;
  canManageTrust: boolean;
  canManageSchool: boolean;
};

type ProfileEditorProps = {
  profile:
    | { resource: "trust"; value: TrustProfile }
    | { resource: "school"; value: SchoolProfile }
    | { resource: "campus"; value: CampusProfile };
  onSaved: () => Promise<void>;
};

function ProfileEditor({ profile, onSaved }: ProfileEditorProps) {
  const formId = useId();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  }>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(undefined);
    const values = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      [...values.entries()].filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && entry[1].trim().length > 0,
      ),
    );

    try {
      const response = await fetch("/api/v1/institutions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "profile.update",
          resource: profile.resource,
          resourceId: profile.value.id,
          ...body,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "The profile could not be updated");
      await onSaved();
      setFeedback({ kind: "success", text: "Profile updated successfully." });
    } catch (error) {
      setFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "The profile could not be updated",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="setup-editor">
      <summary>
        <span>
          <strong>Edit profile</strong>
          <small>Changes are validated and recorded in the audit trail.</small>
        </span>
      </summary>
      <form className="setup-form" onSubmit={submit}>
        <div className="setup-form-grid">
          <label htmlFor={`${formId}-name`}>
            <span>Display name *</span>
            <input
              id={`${formId}-name`}
              name="name"
              defaultValue={profile.value.name}
              maxLength={160}
              required
            />
          </label>
          {profile.resource === "trust" ? (
            <>
              <label htmlFor={`${formId}-locale`}>
                <span>Default locale</span>
                <input
                  id={`${formId}-locale`}
                  name="defaultLocale"
                  defaultValue={profile.value.defaultLocale}
                  placeholder="en-IN"
                />
              </label>
              <label htmlFor={`${formId}-timezone`}>
                <span>Default timezone</span>
                <input
                  id={`${formId}-timezone`}
                  name="defaultTimezone"
                  defaultValue={profile.value.defaultTimezone}
                  placeholder="Asia/Kolkata"
                />
              </label>
              <label htmlFor={`${formId}-currency`}>
                <span>ISO currency</span>
                <input
                  id={`${formId}-currency`}
                  name="defaultCurrency"
                  defaultValue={profile.value.defaultCurrency}
                  maxLength={3}
                  placeholder="INR"
                />
              </label>
            </>
          ) : (
            <>
              <label htmlFor={`${formId}-code`}>
                <span>Code</span>
                <input
                  id={`${formId}-code`}
                  name="code"
                  defaultValue={profile.value.code}
                  maxLength={64}
                />
              </label>
              {profile.resource === "campus" ? (
                <label htmlFor={`${formId}-timezone`}>
                  <span>Timezone</span>
                  <input
                    id={`${formId}-timezone`}
                    name="timezone"
                    defaultValue={profile.value.timezone}
                    placeholder="Asia/Kolkata"
                  />
                </label>
              ) : null}
            </>
          )}
        </div>
        {feedback ? (
          <p
            className={
              feedback.kind === "success" ? "form-success" : "form-error"
            }
            role="status"
            aria-live="polite"
          >
            {feedback.text}
          </p>
        ) : null}
        <button className="button primary" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={16} aria-hidden="true" />
          ) : null}
          {busy ? "Saving" : "Save profile"}
        </button>
      </form>
    </details>
  );
}

export function InstitutionAdmin() {
  const [data, setData] = useState<InstitutionOverview>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/v1/institutions", {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json()) as InstitutionOverview & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Institution profiles could not load");
      setData(payload);
      setError(undefined);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Institution profiles could not load",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !data)
    return (
      <section className="state-card state-error">
        <Building2 aria-hidden="true" />
        <p className="eyebrow">Institutions</p>
        <h1>Profiles unavailable</h1>
        <p>{error}</p>
        <button className="button secondary" onClick={() => void load()}>
          Try again
        </button>
      </section>
    );

  if (!data)
    return (
      <section className="state-card" aria-live="polite">
        <LoaderCircle className="spin" aria-hidden="true" />
        <h1>Loading institutions</h1>
        <p>Reading the profiles available in your active school context.</p>
      </section>
    );

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>Administration</li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">Institutions</li>
        </ol>
      </nav>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Organisation structure</p>
          <h1>Institutions</h1>
          <p>
            Manage the trust, school and campus profiles in your authorized
            context.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => void load()}
          disabled={refreshing}
        >
          <RefreshCw
            className={refreshing ? "spin" : ""}
            size={16}
            aria-hidden="true"
          />
          Refresh
        </button>
      </header>

      {error ? (
        <p className="form-error" role="status">
          {error}
        </p>
      ) : null}

      <section className="setup-profile-grid" aria-label="Institution profiles">
        <article className="panel">
          <ShieldCheck size={20} aria-hidden="true" />
          <p className="eyebrow">Educational trust</p>
          <h2>{data.trust.name}</h2>
          <dl className="institution-details">
            <div>
              <dt>Locale</dt>
              <dd>{data.trust.defaultLocale}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{data.trust.defaultTimezone}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{data.trust.defaultCurrency}</dd>
            </div>
          </dl>
          {data.canManageTrust ? (
            <ProfileEditor
              profile={{ resource: "trust", value: data.trust }}
              onSaved={load}
            />
          ) : (
            <p className="institution-scope-note">
              Trust settings require trust-level administration access.
            </p>
          )}
        </article>

        <article className="panel">
          <Building2 size={20} aria-hidden="true" />
          <p className="eyebrow">School</p>
          <h2>{data.school.name}</h2>
          <dl className="institution-details">
            <div>
              <dt>Code</dt>
              <dd>{data.school.code}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{data.school.status}</dd>
            </div>
            <div>
              <dt>Campuses</dt>
              <dd>{data.school.campuses.length}</dd>
            </div>
          </dl>
          {data.canManageSchool ? (
            <ProfileEditor
              profile={{ resource: "school", value: data.school }}
              onSaved={load}
            />
          ) : (
            <p className="institution-scope-note">
              School settings require school-level administration access.
            </p>
          )}
        </article>

        {data.school.campuses.map((campus) => (
          <article className="panel" key={campus.id}>
            <MapPin size={20} aria-hidden="true" />
            <p className="eyebrow">Campus</p>
            <h2>{campus.name}</h2>
            <dl className="institution-details">
              <div>
                <dt>Code</dt>
                <dd>{campus.code}</dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>{campus.timezone}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{campus.status}</dd>
              </div>
            </dl>
            <ProfileEditor
              profile={{ resource: "campus", value: campus }}
              onSaved={load}
            />
          </article>
        ))}
      </section>

      {data.school.campuses.length === 0 ? (
        <section className="state-card">
          <MapPin aria-hidden="true" />
          <h2>No active campus is available</h2>
          <p>Campus creation remains part of controlled client onboarding.</p>
        </section>
      ) : null}
    </>
  );
}
