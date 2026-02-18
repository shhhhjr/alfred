import { getAuthSession } from "@/lib/auth/session";
import { awardRangsForTask } from "@/lib/rangs/earn";
import { prisma } from "@/lib/db/prisma";
import { calculateTaskPriority } from "@/lib/tasks/prioritizer";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().max(40).nullable().optional(),
  subject: z.string().trim().max(100).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedTime: z.number().int().min(15).max(24 * 60).nullable().optional(),
  importance: z.number().int().min(1).max(10).optional(),
  isCompleted: z.boolean().optional(),
  topicId: z.string().cuid().nullable().optional(),
});

type Params = { params: { id: string } };

async function updateTask(request: Request, id: string) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid task payload" }, { status: 400 });
    }

    const existing = await prisma.task.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const dueDate =
      parsed.data.dueDate === undefined
        ? existing.dueDate
        : parsed.data.dueDate
          ? new Date(parsed.data.dueDate)
          : null;
    const importance = parsed.data.importance ?? existing.importance;
    const estimatedTime =
      parsed.data.estimatedTime === undefined ? existing.estimatedTime : parsed.data.estimatedTime;
    const category =
      parsed.data.category === undefined ? existing.category : parsed.data.category ?? undefined;

    const priorityScore = calculateTaskPriority({
      dueDate,
      estimatedTime,
      importance,
      category: category ?? null,
    });

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...("title" in parsed.data ? { title: parsed.data.title } : {}),
        ...("description" in parsed.data ? { description: parsed.data.description ?? null } : {}),
        ...("category" in parsed.data ? { category: parsed.data.category ?? null } : {}),
        ...("subject" in parsed.data ? { subject: parsed.data.subject ?? null } : {}),
        ...("estimatedTime" in parsed.data ? { estimatedTime: parsed.data.estimatedTime ?? null } : {}),
        ...("importance" in parsed.data ? { importance: parsed.data.importance } : {}),
        ...("dueDate" in parsed.data ? { dueDate } : {}),
        ...("isCompleted" in parsed.data
          ? {
              isCompleted: parsed.data.isCompleted,
              completedAt: parsed.data.isCompleted ? new Date() : null,
            }
          : {}),
        ...("topicId" in parsed.data ? { topicId: parsed.data.topicId ?? null } : {}),
        priorityScore,
      },
      include: { topic: true },
    });

    if (parsed.data.isCompleted === true) {
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: "task_completed",
          description: `Completed task: ${task.title}`,
        },
      });
      await awardRangsForTask(
        session.user.id,
        task.id,
        task.title,
        task.importance,
        task.category,
        task.dueDate,
        task.completedAt!,
      );
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Task update error", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  return updateTask(request, params.id);
}

export async function PUT(request: Request, { params }: Params) {
  return updateTask(request, params.id);
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.task.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
