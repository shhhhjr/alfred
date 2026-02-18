import { ChatClient } from "@/components/chat/ChatClient";
import { AppShell } from "@/components/layout/AppShell";
import { getAuthSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function ChatPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <ChatClient />
    </AppShell>
  );
}
