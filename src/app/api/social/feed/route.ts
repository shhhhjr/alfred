import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const social = await prisma.socialSettings.findUnique({
    where: { userId: session.user.id },
  });
  if (!social?.enabled) {
    return NextResponse.json({ posts: [], message: "Social disabled" });
  }

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userIdA: session.user.id }, { userIdB: session.user.id }],
      status: "accepted",
    },
  });
  const friendIds = friendships.map((f) =>
    f.userIdA === session.user.id ? f.userIdB : f.userIdA,
  );

  let where: { userId: string } | { userId: { in: string[] } } = { userId: session.user.id };
  if (social.visibility === "friends" && friendIds.length > 0) {
    where = { userId: { in: [session.user.id, ...friendIds] } };
  } else if (social.visibility === "friends") {
    where = { userId: session.user.id };
  }

  const posts = await prisma.feedPost.findMany({
    where,
    orderBy: { postedAt: "desc" },
    take: 30,
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ posts });
}
