import { SettingsClient } from "@/components/dashboard/SettingsClient";
import { AppShell } from "@/components/layout/AppShell";
import { getAuthSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <SettingsClient />
    </AppShell>
  );
}
