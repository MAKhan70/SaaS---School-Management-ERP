import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export const metadata: Metadata = { title: "Tenant onboarding" };

export default function OnboardingPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PUBLIC_ONBOARDING !== "true"
  )
    redirect("/sign-in");
  return (
    <main className="onboarding-page">
      <header>
        <Brand />
        <Link href="/sign-in">Sign in</Link>
      </header>
      <section aria-labelledby="onboarding-heading">
        <p className="eyebrow">Tenant onboarding</p>
        <h1 id="onboarding-heading">Set up your school workspace</h1>
        <p>
          Create the minimum secure structure needed to start administering your
          trust.
        </p>
        <OnboardingWizard />
      </section>
    </main>
  );
}
