import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [tasks, events, emails] = await Promise.all([
    prisma.task.findMany({
      where: { userId, isCompleted: false, dueDate: { lte: next48h } },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: { title: true, dueDate: true },
    }),
    prisma.calendarEvent.findMany({
      where: { userId, startTime: { gte: todayStart, lte: todayEnd } },
      orderBy: { startTime: "asc" },
      take: 5,
      select: { title: true, startTime: true },
    }),
    prisma.emailMessage.findMany({
      where: {
        userId,
        importance: { in: ["high", "medium"] },
        receivedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        isRead: false,
      },
      orderBy: [{ importance: "desc" }, { receivedAt: "desc" }],
      take: 3,
      select: { subject: true, fromAddress: true },
    }),
  ]);

  const parts: string[] = [];

  if (events.length > 0) {
    const eventLines = events
      .map((e) => `• ${e.title} at ${e.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`)
      .join("\n");
    parts.push(`Today's schedule:\n${eventLines}`);
  }

  if (tasks.length > 0) {
    const taskLines = tasks
      .map((t) => `• ${t.title}${t.dueDate ? ` (due ${t.dueDate.toLocaleDateString()})` : ""}`)
      .join("\n");
    parts.push(`Upcoming tasks:\n${taskLines}`);
  }

  if (emails.length > 0) {
    const emailLines = emails.map((e) => `• ${e.subject} from ${e.fromAddress}`).join("\n");
    parts.push(`Unread important emails:\n${emailLines}`);
  }

  if (parts.length === 0) {
    parts.push("No urgent items for today. Keep up the great work!");
  }

  const body = parts.join("\n\n");
  const title =
    events.length > 0
      ? `Good morning — ${events.length} event${events.length > 1 ? "s" : ""} today`
      : tasks.length > 0
      ? `Good morning — ${tasks.length} task${tasks.length > 1 ? "s" : ""} due soon`
      : "Good morning — your daily briefing";

  const notification = await prisma.notification.create({
    data: {
      userId,
      type: "morning_briefing",
      title,
      body,
      metadata: JSON.stringify({ taskCount: tasks.length, eventCount: events.length, emailCount: emails.length }),
    },
  });

  // Update lastBriefingDate so we don't double-send
  const todayKey = now.toISOString().slice(0, 10);
  await prisma.userPreference.upsert({
    where: { userId },
    update: { lastBriefingDate: todayKey },
    create: {
      userId,
      lastBriefingDate: todayKey,
      travelMode: "drive",
      workHoursStart: 9,
      workHoursEnd: 17,
      breakMinutes: 15,
      emailDigestHours: 24,
      profileVisibility: "private",
      notifEmailDigest: false,
      notifPush: false,
      notifMorningBrief: false,
      notifMorningHour: 8,
      hasCompletedOnboarding: false,
    },
  });

  return NextResponse.json({ notification });
}
