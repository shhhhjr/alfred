"use client";

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
        <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] p-6">
          <div className="max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-xl font-semibold text-zinc-100">Something went wrong!</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {error.message || "An unexpected error occurred. Please refresh the page."}
            </p>
            {error.digest && (
              <p className="mt-1 text-xs text-zinc-500">Error ID: {error.digest}</p>
            )}
            <button
              onClick={reset}
              className="mt-4 rounded-md bg-[#6C63FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#5a52e6]"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
