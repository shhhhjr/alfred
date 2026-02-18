import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const entrySchema = z.object({
  payload: z.record(z.string(), z.unknown()),
  nextAction: z.string().datetime().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const section = await prisma.customSection.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { entries: true },
  });
  if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ section });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.customSection.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = z.object({ name: z.string().trim().min(1).max(60).optional(), icon: z.string().trim().max(20).optional() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const section = await prisma.customSection.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json({ section });
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.customSection.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.customSection.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request, { params }: Params) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const section = await prisma.customSection.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = entrySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const entry = await prisma.customSectionEntry.create({
    data: {
      sectionId: params.id,
      payload: parsed.data.payload as object,
      nextAction: parsed.data.nextAction ? new Date(parsed.data.nextAction) : null,
      tags: parsed.data.tags ?? [],
    },
  });
  return NextResponse.json({ entry }, { status: 201 });
}
