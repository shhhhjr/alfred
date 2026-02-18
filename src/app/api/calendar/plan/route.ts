import { getAuthSession } from "@/lib/auth/session";
import { planDay } from "@/lib/calendar/scheduler";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const dateStr = (body.date ?? body.targetDate ?? new Date().toISOString().slice(0, 10)) as string;
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);

  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const [events, tasks, prefs] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        userId: session.user.id,
        startTime: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.task.findMany({
      where: { userId: session.user.id, isCompleted: false },
      orderBy: [{ priorityScore: "desc" }, { dueDate: "asc" }],
    }),
    prisma.userPreference.findUnique({
      where: { userId: session.user.id },
      select: { workHoursStart: true, workHoursEnd: true, breakMinutes: true },
    }),
  ]);

  const userPrefs = {
    workHoursStart: prefs?.workHoursStart ?? 9,
    workHoursEnd: prefs?.workHoursEnd ?? 17,
    breakMinutes: prefs?.breakMinutes ?? 15,
    bufferMinutes: 15,
  };

  const proposed = planDay(targetDate, events, tasks, userPrefs);

  const schedule = proposed.map((p) => ({
    id: p.id,
    title: p.title,
    startTime: p.startTime.toISOString(),
    endTime: p.endTime.toISOString(),
    isFixed: p.isFixed,
    color: p.color,
    source: p.source,
    sourceRef: p.sourceRef,
    taskId: p.taskId,
  }));

  return NextResponse.json({
    date: targetDate.toISOString().slice(0, 10),
    schedule,
    proposedCount: schedule.filter((s) => !s.id).length,
  });
}

/** Accept and save proposed blocks to calendar */
export async function PUT(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const proposed = (body.proposed ?? body.schedule ?? []).filter(
    (p: { id?: string }) => !p.id
  ) as Array<{
    title: string;
    startTime: string;
    endTime: string;
    taskId?: string;
  }>;

  if (proposed.length === 0) {
    return NextResponse.json({ ok: true, created: 0 });
  }

  const created = await prisma.$transaction(
    proposed.map((p) =>
      prisma.calendarEvent.create({
        data: {
          userId: session.user.id,
          title: p.title,
          startTime: new Date(p.startTime),
          endTime: new Date(p.endTime),
          isFixed: false,
          color: "#22C55E",
          source: "plan",
          sourceRef: p.taskId ?? null,
        },
      })
    )
  );

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "plan_accepted",
      description: `Accepted day plan: ${created.length} blocks added`,
      metadata: { count: created.length },
    },
  });

  return NextResponse.json({ ok: true, created: created.length, events: created });
}
