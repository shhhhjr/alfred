import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const assignmentSchema = z.object({
  courseId: z.string().cuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  dueDate: z.string().datetime().optional(),
  weight: z.number().min(0).max(100).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courseId = request.nextUrl.searchParams.get("courseId");
  const where: Record<string, unknown> = { userId: session.user.id };
  if (courseId) where.courseId = courseId;

  const assignments = await prisma.assignment.findMany({
    where,
    orderBy: { dueDate: "asc" },
    include: { course: { select: { name: true, color: true } } },
  });

  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = assignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid assignment data" }, { status: 400 });
  }

  // Verify course belongs to user
  const course = await prisma.course.findFirst({
    where: { id: parsed.data.courseId, userId: session.user.id },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const assignment = await prisma.assignment.create({
    data: {
      courseId: parsed.data.courseId,
      userId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      weight: parsed.data.weight,
    },
  });

  return NextResponse.json({ assignment }, { status: 201 });
}
