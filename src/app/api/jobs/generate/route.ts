import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateCustomResume, generateCoverLetter } from "@/lib/jobs/resumeGen";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const generateSchema = z.object({
  jobId: z.string(),
  type: z.enum(["resume", "cover", "cover_letter", "both"]),
});

export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { jobId, type } = parsed.data;

  const [job, resume] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, userId: session.user.id } }),
    prisma.resume.findUnique({ where: { userId: session.user.id } }),
  ]);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (!resume) {
    return NextResponse.json(
      { error: "Please upload your resume first before generating custom documents." },
      { status: 400 }
    );
  }

  try {
    const updates: { customResume?: string; customCover?: string } = {};

    if (type === "resume" || type === "both") {
      updates.customResume = await generateCustomResume(session.user.id, jobId);
    }

    if (type === "cover" || type === "cover_letter" || type === "both") {
      updates.customCover = await generateCoverLetter(session.user.id, jobId);
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: updates,
    });

    return NextResponse.json({
      job: {
        id: updated.id,
        customResume: updated.customResume,
        customCover: updated.customCover,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
