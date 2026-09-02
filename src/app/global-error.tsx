"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-IN">
      <body>
        <main className="fatal-error">
          <p>NASAQ Academic Systems</p>
          <h1>Something went wrong</h1>
          <p>
            We couldn’t open your workspace. Your data has not been changed.
          </p>
          <button className="button primary" type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
