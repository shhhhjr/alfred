import { CalendarClient } from "@/components/calendar/CalendarClient";
import { AppShell } from "@/components/layout/AppShell";
import { getAuthSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function CalendarPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <CalendarClient />
    </AppShell>
  );
}
