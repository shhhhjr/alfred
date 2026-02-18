import { EmailHubClient } from "@/components/email/EmailHubClient";
import { AppShell } from "@/components/layout/AppShell";
import { getAuthSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function EmailPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <div className="min-h-0 flex-1 overflow-hidden">
        <EmailHubClient />
      </div>
    </AppShell>
  );
}
