import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-[#0A0A0F] text-zinc-100">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar />
        <main className="flex min-h-0 flex-1 flex-col p-6">{children}</main>
      </div>
    </div>
  );
}
