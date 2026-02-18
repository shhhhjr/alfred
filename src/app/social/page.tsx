import { AppShell } from "@/components/layout/AppShell";
import { SocialClient } from "@/components/social/SocialClient";
import { getAuthSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function SocialPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <SocialClient />
    </AppShell>
  );
}
