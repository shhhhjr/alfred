import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.emailAccount.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: {
          messages: { where: { isRead: false } },
        },
      },
    },
  });

  const list = accounts.map((a) => ({
    id: a.id,
    provider: a.provider,
    email: a.email,
    unreadCount: a._count.messages,
    lastSynced: a.lastSynced,
    status: a.accessToken || a.refreshToken || a.imapPassword ? "connected" : "disconnected",
  }));

  return NextResponse.json({ accounts: list });
}
