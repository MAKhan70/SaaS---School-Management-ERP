import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return (
    <main className="auth-simple">
      <section className="auth-card" aria-labelledby="reset-heading">
        <p className="eyebrow">Account security</p>
        <h1 id="reset-heading">Choose a new password</h1>
        <p id="password-hint">
          Use at least 12 characters with upper and lowercase letters and a
          number.
        </p>
        {params.error === "invalid" && (
          <p className="form-error" role="alert">
            The reset link is invalid or expired.
          </p>
        )}
        <form action="/api/auth/password/reset" method="post">
          <input type="hidden" name="token" value={token} />
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            aria-describedby="password-hint"
            required
          />
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <button className="button primary full" type="submit">
            Update password
          </button>
        </form>
        <Link className="text-link" href="/sign-in">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
