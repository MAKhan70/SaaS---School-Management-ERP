import Link from "next/link";

export default function NotFound() {
  return (
    <main className="fatal-error">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The page may have moved, or your workspace may not include it.</p>
      <Link className="button primary" href="/dashboard">
        Return to dashboard
      </Link>
    </main>
  );
}
