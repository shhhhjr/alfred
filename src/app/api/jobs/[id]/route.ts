import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["found", "saved", "applied", "interview", "offer", "rejected"]).optional(),
  notes: z.string().optional(),
  customResume: z.string().optional(),
  customCover: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const job = await prisma.job.findFirst({
    where: { id: params.id, userId: session.user.id },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const updated = await prisma.job.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json({
    job: {
      id: updated.id,
      status: updated.status,
      notes: updated.notes,
    },
  });
}
