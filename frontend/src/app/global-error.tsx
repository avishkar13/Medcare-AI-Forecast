"use client";

// catches errors thrown by the root layout, which error.tsx cannot. it replaces the
// whole document so it renders its own html and body.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: 24, fontFamily: "system-ui" }}>
          <p>The application failed to load.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
          {error.digest ? <p>Reference: {error.digest}</p> : null}
        </div>
      </body>
    </html>
  );
}
