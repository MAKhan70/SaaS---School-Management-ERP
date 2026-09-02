import type { Metadata } from "next";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Activate account" };

export default async function ActivateAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const trustId = typeof params.trustId === "string" ? params.trustId : "";
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="activation-heading">
        <Brand />
        <p className="eyebrow">Secure invitation</p>
        <h1 id="activation-heading">Activate your administrator account</h1>
        <p>Create a strong password to access your school workspace.</p>
        {params.error === "invalid" && (
          <p className="form-error" role="alert">
            This invitation is invalid or has expired.
          </p>
        )}
        <form action="/api/auth/invitations/accept" method="post">
          <input type="hidden" name="trustId" value={trustId} />
          <input type="hidden" name="token" value={token} />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <button
            className="button primary full"
            type="submit"
            disabled={!token || !trustId}
          >
            Activate account
          </button>
        </form>
      </section>
    </main>
  );
}
