import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  enabled: z.boolean().optional(),
  visibility: z.enum(["private", "friends"]).optional(),
  promptIntervalHours: z.number().int().min(1).max(6).optional(),
});

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.socialSettings.findUnique({
    where: { userId: session.user.id },
  });
  return NextResponse.json({
    enabled: settings?.enabled ?? true,
    visibility: settings?.visibility ?? "private",
    promptIntervalHours: settings?.promptIntervalHours ?? 3,
  });
}

export async function PATCH(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const settings = await prisma.socialSettings.upsert({
    where: { userId: session.user.id },
    update: parsed.data,
    create: {
      userId: session.user.id,
      ...parsed.data,
    },
  });
  return NextResponse.json(settings);
}
