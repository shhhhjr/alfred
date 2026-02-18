"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] p-6">
      <Card className="max-w-md p-6">
        <h2 className="text-xl font-semibold text-zinc-100">Something went wrong!</h2>
        <p className="mt-2 text-sm text-zinc-400">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-zinc-500">Error ID: {error.digest}</p>
        )}
        <div className="mt-4 flex gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            Go home
          </Button>
        </div>
      </Card>
    </div>
  );
}
