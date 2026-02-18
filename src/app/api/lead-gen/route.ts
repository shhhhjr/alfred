import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  prospect: z.string().trim().min(1).max(120),
  company: z.string().trim().min(1).max(120),
  channel: z.string().trim().max(80).optional(),
  contactEmail: z.string().trim().max(200).optional(),
  contactInstagram: z.string().trim().max(120).optional(),
  contactLinkedIn: z.string().trim().max(200).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  stage: z.string().trim().max(40).optional(),
  contactStatus: z.string().trim().max(40).optional(),
  nextFollowUp: z.string().datetime().optional(),
  nextSteps: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
  isClosed: z.boolean().optional(),
  isConfirmed: z.boolean().optional(),
});

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage");

  const entries = await prisma.leadGenEntry.findMany({
    where: {
      userId: session.user.id,
      ...(stage ? { stage } : {}),
    },
    orderBy: [{ isClosed: "asc" }, { nextFollowUp: "asc" }, { stage: "asc" }],
  });
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const entry = await prisma.leadGenEntry.create({
    data: {
      userId: session.user.id,
      prospect: parsed.data.prospect,
      company: parsed.data.company,
      channel: parsed.data.channel ?? null,
      contactEmail: parsed.data.contactEmail ?? null,
      contactInstagram: parsed.data.contactInstagram ?? null,
      contactLinkedIn: parsed.data.contactLinkedIn ?? null,
      contactPhone: parsed.data.contactPhone ?? null,
      stage: parsed.data.stage ?? "new",
      contactStatus: parsed.data.contactStatus ?? null,
      nextFollowUp: parsed.data.nextFollowUp ? new Date(parsed.data.nextFollowUp) : null,
      nextSteps: parsed.data.nextSteps ?? null,
      notes: parsed.data.notes ?? null,
      isClosed: parsed.data.isClosed ?? false,
      isConfirmed: parsed.data.isConfirmed ?? false,
    },
  });
  return NextResponse.json({ entry }, { status: 201 });
}
