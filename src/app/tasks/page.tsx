import { AppShell } from "@/components/layout/AppShell";
import { TaskListClient } from "@/components/tasks/TaskListClient";
import { getAuthSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function TasksPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <TaskListClient />
    </AppShell>
  );
}
