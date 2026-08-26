"use client";

import { useEffect } from "react";

// todo: surface the api requestId here, it ties a user report to a server log line.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-6">
      <p className="text-sm">Something went wrong.</p>
      <button type="button" onClick={reset} className="mt-2 underline text-sm">
        Try again
      </button>
    </div>
  );
}
