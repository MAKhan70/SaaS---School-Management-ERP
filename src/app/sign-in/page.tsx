import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { CheckCircle2, LockKeyhole, Mail } from "lucide-react";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { safeReturnUrl } from "@/modules/identity/domain/auth-contracts";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const returnUrl = safeReturnUrl(
    typeof params.returnUrl === "string" ? params.returnUrl : undefined,
  );
  return (
    <main className="sign-in-page">
      <section className="sign-in-story" aria-labelledby="product-heading">
        <Brand />
        <div>
          <p className="eyebrow light">
            Intelligent Systems for Smarter Campuses
          </p>
          <h1 id="product-heading">
            One connected campus. Every learner in focus.
          </h1>
          <p>
            Securely bring academics, administration, and campus operations
            together across every school in your trust.
          </p>
          <ul>
            <li>
              <CheckCircle2 size={18} aria-hidden="true" /> Trust-first data
              isolation
            </li>
            <li>
              <CheckCircle2 size={18} aria-hidden="true" /> India-ready academic
              structure
            </li>
            <li>
              <CheckCircle2 size={18} aria-hidden="true" /> Permission-aware
              access
            </li>
          </ul>
        </div>
        <small>Secure school workspace</small>
      </section>
      <section className="sign-in-form-wrap" aria-labelledby="sign-in-heading">
        <div className="sign-in-theme">
          <ThemeToggle />
        </div>
        <form className="sign-in-card" action="/api/auth/sign-in" method="post">
          <p className="eyebrow">Welcome back</p>
          <h2 id="sign-in-heading">Sign in to your workspace</h2>
          <p>Use the account provided by your educational trust.</p>
          {params.error === "invalid" && (
            <p className="form-error" role="alert">
              The email or password is incorrect, or the account is unavailable.
            </p>
          )}
          {params.reset === "true" && (
            <p className="form-success" role="status">
              Password updated. Sign in with your new password.
            </p>
          )}
          {params.onboarded === "true" && (
            <p className="form-success" role="status">
              Onboarding completed. Sign in as the administrator.
            </p>
          )}
          {params.activated === "true" && (
            <p className="form-success" role="status">
              Account activated. Sign in to your school workspace.
            </p>
          )}
          <input type="hidden" name="returnUrl" value={returnUrl} />
          <label htmlFor="email">Email address</label>
          <div className="input-with-icon">
            <Mail size={18} aria-hidden="true" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
            />
          </div>
          <div className="label-row">
            <label htmlFor="password">Password</label>
            <Link href={"/forgot-password" as Route}>Forgot password?</Link>
          </div>
          <div className="input-with-icon">
            <LockKeyhole size={18} aria-hidden="true" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="button primary full" type="submit">
            Sign in
          </button>
          <p className="form-note">
            New client onboarding is managed securely by NASAQ.
          </p>
        </form>
      </section>
    </main>
  );
}
