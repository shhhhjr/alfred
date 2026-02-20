import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: courseId } = await params;

  // Verify course belongs to user
  const course = await prisma.course.findFirst({ where: { id: courseId, userId: session.user.id } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  // Parse PDF text using pdf-parse
  let syllabusText = "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = ((await import("pdf-parse")) as any).default ?? (await import("pdf-parse"));
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buffer);
    syllabusText = result.text.slice(0, 8000);
  } catch {
    return NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 });
  }

  // Ask AI to extract assignments
  let assignments: Array<{ title: string; dueDate?: string; weight?: number; description?: string }> = [];
  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: `From this course syllabus text, extract all assignments, quizzes, exams, and projects.
Return a JSON array of objects with this shape:
[{ "title": "string", "dueDate": "YYYY-MM-DD or null", "weight": number (0-100, percentage of grade) or null, "description": "string or null" }]

Respond ONLY with valid JSON array, no other text.

SYLLABUS:
${syllabusText}`,
    });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as typeof assignments;
      assignments = parsed.filter(
        (a) => typeof a.title === "string" && a.title.trim().length > 0
      );
    }
  } catch {
    // If AI extraction fails, just save syllabus text without assignments
  }

  // Save syllabus text to course
  await prisma.course.update({
    where: { id: courseId },
    data: { syllabusText },
  });

  // Insert extracted assignments
  const created = await Promise.all(
    assignments.slice(0, 50).map((a) =>
      prisma.assignment.create({
        data: {
          courseId,
          userId: session.user.id,
          title: a.title.trim().slice(0, 200),
          description: a.description?.slice(0, 500),
          dueDate: a.dueDate ? new Date(a.dueDate) : null,
          weight: a.weight ?? null,
          source: "syllabus",
        },
      })
    )
  );

  return NextResponse.json({ syllabusText: syllabusText.slice(0, 200) + "...", assignmentsCreated: created.length });
}
