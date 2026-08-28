import Link from "next/link";

/**
 * A dead end otherwise: this was a bare sentence with no way back, so a mistyped or
 * stale URL stranded the reader with only the browser's Back button.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-2xl font-bold tracking-tight text-foreground">Page not found</p>
      <p className="max-w-md text-sm text-muted-foreground">
        That address does not match anything in the app. It may have been renamed, or the
        link that brought you here may be out of date.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex h-9 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}
