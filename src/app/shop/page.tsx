import { AppShell } from "@/components/layout/AppShell";
import { ShopClient } from "@/components/shop/ShopClient";
import { getAuthSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function ShopPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <ShopClient />
    </AppShell>
  );
}
