import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.shopItem.findMany({
    where: { available: true, rotating: false },
    orderBy: { cost: "asc" },
  });
  return NextResponse.json({ items });
}
