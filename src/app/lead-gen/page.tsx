import { AppShell } from "@/components/layout/AppShell";
import { LeadGenClient } from "@/components/lead-gen/LeadGenClient";
import { getAuthSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function LeadGenPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <LeadGenClient />
    </AppShell>
  );
}
