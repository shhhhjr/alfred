import { getAuthSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { NotificationBell } from "@/components/layout/NotificationBell";

export async function TopBar() {
  const session = await getAuthSession();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-800 bg-[#0A0A0F]/95 px-6 backdrop-blur">
      <div>
        <p className="text-sm text-zinc-400">
          {session?.user?.name
            ? `Good day Mr. ${session.user.name}, welcome back.`
            : "Good day, welcome back."}
        </p>
        <p className="text-base font-medium text-zinc-100">
          ALFRED Command Center
        </p>
      </div>

      {session ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-300">Automation: {session.user.automationLevel}</p>
          <NotificationBell />
          <SignOutButton />
        </div>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      )}
    </header>
  );
}
