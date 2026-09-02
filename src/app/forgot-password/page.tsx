import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <main className="auth-simple">
      <section className="auth-card" aria-labelledby="forgot-heading">
        <p className="eyebrow">Account recovery</p>
        <h1 id="forgot-heading">Reset your password</h1>
        <p>
          Enter your email address. For security, the response is the same
          whether or not an account exists.
        </p>
        {params.submitted === "true" && (
          <p className="form-success" role="status">
            If an eligible account matches that address, password reset
            instructions will be sent.
          </p>
        )}
        <form action="/api/auth/password/forgot" method="post">
          <label htmlFor="recovery-email">Email address</label>
          <input
            id="recovery-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            required
          />
          <button className="button primary full" type="submit">
            Send reset instructions
          </button>
        </form>
        <Link className="text-link" href="/sign-in">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
