import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  activity: z.string().trim().min(1).max(500),
  productiveMinutes: z.number().int().min(0).max(480),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const social = await prisma.socialSettings.findUnique({
    where: { userId: session.user.id },
  });
  if (social && !social.enabled) return NextResponse.json({ error: "Social disabled" }, { status: 400 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await prisma.socialSettings.upsert({
    where: { userId: session.user.id },
    update: { lastPromptedAt: new Date() },
    create: { userId: session.user.id, lastPromptedAt: new Date() },
  });

  const snapshot = await prisma.productivitySnapshot.create({
    data: {
      userId: session.user.id,
      activity: parsed.data.activity,
      productiveMinutes: parsed.data.productiveMinutes,
    },
  });

  return NextResponse.json({ snapshot }, { status: 201 });
}
