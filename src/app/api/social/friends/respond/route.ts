import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ friendshipId: z.string().cuid(), accept: z.boolean() });

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const friendship = await prisma.friendship.findFirst({
    where: { id: parsed.data.friendshipId, userIdB: session.user.id, status: "pending" },
  });
  if (!friendship) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  if (parsed.data.accept) {
    await prisma.friendship.update({
      where: { id: parsed.data.friendshipId },
      data: { status: "accepted" },
    });
    return NextResponse.json({ ok: true, message: "Friend added" });
  }

  await prisma.friendship.delete({ where: { id: parsed.data.friendshipId } });
  return NextResponse.json({ ok: true, message: "Request declined" });
}
