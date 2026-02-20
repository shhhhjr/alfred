import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { calculateTaskPriority } from "@/lib/tasks/prioritizer";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const taskSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(100).optional(),
  dueDate: z.string().datetime().optional(),
  estimatedTime: z.number().int().min(15).max(24 * 60).optional(),
  importance: z.number().int().min(1).max(10).default(5),
  topicId: z.string().cuid().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const categories = searchParams.getAll("category");
  const subject = searchParams.get("subject");
  const completed = searchParams.get("completed"); // "true" | "false" | null
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = { userId: session.user.id };

  if (categories.length > 0) {
    where.category = { in: categories };
  }
  if (subject != null && subject !== "") {
    where.subject = subject;
  }
  if (completed === "true") {
    where.isCompleted = true;
  } else if (completed === "false") {
    where.isCompleted = false;
  }

  if (startDate || endDate) {
    where.dueDate = {};
    if (startDate) {
      (where.dueDate as Record<string, Date>).gte = new Date(startDate);
    }
    if (endDate) {
      (where.dueDate as Record<string, Date>).lte = new Date(endDate);
    }
  }

  const [tasks, topics] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { topic: true },
      orderBy: [{ isCompleted: "asc" }, { priorityScore: "desc" }, { dueDate: "asc" }],
    }),
    prisma.taskTopic.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    }),
  ]);

  // Recalculate priority only for tasks with a dueDate (time-sensitive) whose score has gone stale
  const STALE_THRESHOLD = 1.0;
  const freshScores = tasks.map((task) => ({
    id: task.id,
    score: calculateTaskPriority({
      dueDate: task.dueDate,
      estimatedTime: task.estimatedTime,
      importance: task.importance,
      category: task.category,
    }),
  }));
  const staleUpdates = freshScores.filter((u) => {
    const existing = tasks.find((t) => t.id === u.id);
    if (!existing?.dueDate) return false;
    return Math.abs((existing.priorityScore ?? 0) - u.score) > STALE_THRESHOLD;
  });

  if (staleUpdates.length > 0) {
    await Promise.all(
      staleUpdates.map((u) =>
        prisma.task.update({
          where: { id: u.id },
          data: { priorityScore: u.score },
        })
      )
    );
  }

  const updatedTasks = tasks.map((t) => {
    const u = freshScores.find((x) => x.id === t.id);
    return { ...t, priorityScore: u?.score ?? t.priorityScore };
  });

  return NextResponse.json({ tasks: updatedTasks, topics });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = taskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid task payload" }, { status: 400 });
    }

    if (parsed.data.topicId) {
      const exists = await prisma.taskTopic.findFirst({
        where: { id: parsed.data.topicId, userId: session.user.id },
      });
      if (!exists) {
        return NextResponse.json({ error: "Topic not found" }, { status: 404 });
      }
    }

    const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    const priorityScore = calculateTaskPriority({
      dueDate,
      estimatedTime: parsed.data.estimatedTime ?? null,
      importance: parsed.data.importance ?? 5,
      category: parsed.data.category ?? null,
    });

    const task = await prisma.task.create({
      data: {
        userId: session.user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        subject: parsed.data.subject,
        dueDate,
        estimatedTime: parsed.data.estimatedTime,
        importance: parsed.data.importance,
        priorityScore,
        topicId: parsed.data.topicId,
      },
      include: { topic: true },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "task_created",
        description: `Created task: ${task.title}`,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Task creation error", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
