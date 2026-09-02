import Link from "next/link";
import {
  AlertTriangle,
  FileQuestion,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";

export function LoadingState({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="state-card" role="status" aria-live="polite">
      <LoaderCircle className="spin" size={30} aria-hidden="true" />
      <h2>{label}</h2>
      <p>Preparing secure, tenant-scoped information.</p>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="state-card">
      <FileQuestion size={30} aria-hidden="true" />
      <h2>No announcements yet</h2>
      <p>Campus announcements will appear here when they are published.</p>
      <button className="button secondary" type="button">
        Create announcement
      </button>
    </div>
  );
}

export function ErrorState() {
  return (
    <div className="state-card state-error" role="alert">
      <AlertTriangle size={30} aria-hidden="true" />
      <h2>We couldn’t load this information</h2>
      <p>
        Your data is safe. Try again, or contact support if the issue continues.
      </p>
      <button
        className="button secondary"
        type="button"
        onClick={() => window.location.reload()}
      >
        Try again
      </button>
    </div>
  );
}

export function AccessDeniedState() {
  return (
    <div className="state-card state-denied">
      <LockKeyhole size={30} aria-hidden="true" />
      <p className="eyebrow">Permission required</p>
      <h1>Access denied</h1>
      <p>
        Your current role does not have permission to view this page. Ask a
        trust administrator if you believe this is incorrect.
      </p>
      <Link className="button primary" href="/dashboard">
        Return to dashboard
      </Link>
    </div>
  );
}
