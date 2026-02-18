import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] p-6">
      <Card className="max-w-md p-6 text-center">
        <h2 className="text-2xl font-semibold text-zinc-100">404</h2>
        <p className="mt-2 text-sm text-zinc-400">This page could not be found.</p>
        <div className="mt-4">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
