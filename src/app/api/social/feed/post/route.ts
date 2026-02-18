import { getAuthSession } from "@/lib/auth/session";
import { computeDailyRatio } from "@/lib/social/productivity";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ note: z.string().trim().max(200).optional() });

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const social = await prisma.socialSettings.findUnique({
    where: { userId: session.user.id },
  });
  if (social && !social.enabled) return NextResponse.json({ error: "Social disabled" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  const today = new Date();
  const { ratio, completedTasks, productiveMinutes } = await computeDailyRatio(
    session.user.id,
    today,
  );

  const post = await prisma.feedPost.create({
    data: {
      userId: session.user.id,
      ratio,
      completedTasks,
      productiveMinutes,
      note: parsed.success ? parsed.data.note ?? null : null,
    },
  });

  return NextResponse.json({ post });
}
