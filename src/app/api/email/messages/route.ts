import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10) || 50, 100);
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10) || 0;

  const where: { userId: string; emailAccountId?: string } = { userId: session.user.id };
  if (accountId) where.emailAccountId = accountId;

  const [messages, total] = await Promise.all([
    prisma.emailMessage.findMany({
      where,
      include: { account: { select: { provider: true, email: true } } },
      orderBy: { receivedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.emailMessage.count({ where }),
  ]);

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      providerId: m.providerId,
      accountId: m.emailAccountId,
      provider: m.account.provider,
      from: m.fromAddress,
      subject: m.subject,
      snippet: m.snippet,
      receivedAt: m.receivedAt.toISOString(),
      isRead: m.isRead,
      importance: m.importance,
      actionItems: m.actionItems,
      detectedEvents: m.detectedEvents,
      detectedDeadlines: m.detectedDeadlines,
      aiSummary: m.aiSummary,
      requiresSignup: m.requiresSignup,
      requiresResponse: m.requiresResponse,
      signupUrl: m.signupUrl,
    })),
    total,
    hasMore: offset + messages.length < total,
  });
}
