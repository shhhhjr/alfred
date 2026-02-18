import { getAuthSession } from "@/lib/auth/session";
import { generateFriendCode } from "@/lib/social/code";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { friendCode: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!user?.friendCode) {
    let code = generateFriendCode();
    while (await prisma.user.findUnique({ where: { friendCode: code } })) {
      code = generateFriendCode();
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { friendCode: code },
    });
    return NextResponse.json({ friendCode: code });
  }
  return NextResponse.json({ friendCode: user.friendCode });
}
