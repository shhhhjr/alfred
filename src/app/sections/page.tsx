import { AppShell } from "@/components/layout/AppShell";
import { CustomSectionsClient } from "@/components/custom-sections/CustomSectionsClient";
import { getAuthSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function SectionsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <CustomSectionsClient />
    </AppShell>
  );
}
