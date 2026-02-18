import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

const MS_PER_6_HOURS = 6 * 60 * 60 * 1000;
const ITEMS_PER_SLOT = 6;

/** Returns the 6 rotating shop items for the current 6-hour window. */
export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = await prisma.shopItem.findMany({
    where: { available: true, rotating: true },
    orderBy: { sortOrder: "asc" },
  });

  if (all.length === 0) return NextResponse.json({ items: [] });

  const slot = Math.floor(Date.now() / MS_PER_6_HOURS);
  const startIndex = (slot * ITEMS_PER_SLOT) % all.length;

  const items: typeof all = [];
  for (let i = 0; i < ITEMS_PER_SLOT; i++) {
    items.push(all[(startIndex + i) % all.length]);
  }

  return NextResponse.json({ items });
}
