import { getAuthSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";
import { syncUserEmails } from "@/lib/email/sync";

export async function POST() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncUserEmails(session.user.id);
    return NextResponse.json({
      ok: true,
      syncedAccounts: result.syncedAccounts,
      newMessages: result.newMessages,
      message: `Synced ${result.syncedAccounts} account(s), ${result.newMessages} new messages.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
