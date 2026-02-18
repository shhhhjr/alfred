import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(20).optional(),
});

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sections = await prisma.customSection.findMany({
    where: { userId: session.user.id },
    include: { entries: true },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ sections });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const count = await prisma.customSection.count({ where: { userId: session.user.id } });
  const section = await prisma.customSection.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      icon: parsed.data.icon ?? "folder",
      sortOrder: count,
    },
  });
  return NextResponse.json({ section }, { status: 201 });
}
