import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  prospect: z.string().trim().min(1).max(120).optional(),
  company: z.string().trim().min(1).max(120).optional(),
  channel: z.string().trim().max(80).nullable().optional(),
  contactEmail: z.string().trim().max(200).nullable().optional(),
  contactInstagram: z.string().trim().max(120).nullable().optional(),
  contactLinkedIn: z.string().trim().max(200).nullable().optional(),
  contactPhone: z.string().trim().max(40).nullable().optional(),
  stage: z.string().trim().max(40).optional(),
  contactStatus: z.string().trim().max(40).nullable().optional(),
  nextFollowUp: z.string().datetime().nullable().optional(),
  nextSteps: z.string().trim().max(500).nullable().optional(),
  result: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  isClosed: z.boolean().optional(),
  isConfirmed: z.boolean().optional(),
});

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.leadGenEntry.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.prospect) data.prospect = parsed.data.prospect;
  if (parsed.data.company) data.company = parsed.data.company;
  if ("channel" in parsed.data) data.channel = parsed.data.channel ?? null;
  if ("contactEmail" in parsed.data) data.contactEmail = parsed.data.contactEmail ?? null;
  if ("contactInstagram" in parsed.data) data.contactInstagram = parsed.data.contactInstagram ?? null;
  if ("contactLinkedIn" in parsed.data) data.contactLinkedIn = parsed.data.contactLinkedIn ?? null;
  if ("contactPhone" in parsed.data) data.contactPhone = parsed.data.contactPhone ?? null;
  if (parsed.data.stage) data.stage = parsed.data.stage;
  if ("contactStatus" in parsed.data) data.contactStatus = parsed.data.contactStatus ?? null;
  if ("nextFollowUp" in parsed.data) data.nextFollowUp = parsed.data.nextFollowUp ? new Date(parsed.data.nextFollowUp) : null;
  if ("nextSteps" in parsed.data) data.nextSteps = parsed.data.nextSteps ?? null;
  if ("result" in parsed.data) data.result = parsed.data.result ?? null;
  if ("notes" in parsed.data) data.notes = parsed.data.notes ?? null;
  if ("isClosed" in parsed.data) data.isClosed = parsed.data.isClosed ?? false;
  if ("isConfirmed" in parsed.data) data.isConfirmed = parsed.data.isConfirmed ?? false;

  const entry = await prisma.leadGenEntry.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json({ entry });
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.leadGenEntry.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.leadGenEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
