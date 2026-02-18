import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  requiresResponse: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const msg = await prisma.emailMessage.findFirst({
    where: { id: params.id, userId: session.user.id },
  });

  if (!msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  await prisma.emailMessage.update({
    where: { id: params.id },
    data: { requiresResponse: parsed.data.requiresResponse },
  });

  return NextResponse.json({ ok: true, requiresResponse: parsed.data.requiresResponse });
}
