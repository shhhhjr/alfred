import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({ friendCode: z.string().trim().min(6).max(12) });

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.friendship.findMany({
    where: {
      OR: [{ userIdA: session.user.id }, { userIdB: session.user.id }],
      status: "accepted",
    },
    include: {
      userA: { select: { id: true, name: true, friendCode: true } },
      userB: { select: { id: true, name: true, friendCode: true } },
    },
  });

  const friends = rows.map((r) => {
    const other = r.userIdA === session.user.id ? r.userB : r.userA;
    return { id: other.id, name: other.name, friendCode: other.friendCode };
  });

  const pending = await prisma.friendship.findMany({
    where: { userIdB: session.user.id, status: "pending" },
    include: { userA: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ friends, pending });
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid friend code" }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { friendCode: parsed.data.friendCode.toUpperCase() },
  });
  if (!target) return NextResponse.json({ error: "Friend code not found" }, { status: 404 });
  if (target.id === session.user.id) return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 });

  const [idA, idB] = [session.user.id, target.id].sort();
  const existing = await prisma.friendship.findUnique({
    where: { userIdA_userIdB: { userIdA: idA, userIdB: idB } },
  });
  if (existing) return NextResponse.json({ error: "Already friends or request pending" }, { status: 409 });

  await prisma.friendship.create({
    data: { userIdA: idA, userIdB: idB, status: "pending" },
  });
  return NextResponse.json({ ok: true, message: "Friend request sent" });
}
