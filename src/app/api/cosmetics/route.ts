import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [purchases, preferences] = await Promise.all([
    prisma.purchase.findMany({
      where: { userId },
      include: { item: true },
    }),
    prisma.userPreference.findUnique({ where: { userId } }),
  ]);

  const themeItem = preferences?.equippedThemeId
    ? await prisma.shopItem.findUnique({
        where: { id: preferences.equippedThemeId },
        select: { config: true },
      })
    : null;

  const owned = purchases.map((p) => ({
    id: p.item.id,
    name: p.item.name,
    kind: p.item.kind,
  }));

  const themeAccent =
    themeItem?.config && typeof themeItem.config === "object" && themeItem.config !== null && "accent" in themeItem.config
      ? (themeItem.config as { accent?: string }).accent ?? "#6C63FF"
      : "#6C63FF";

  return NextResponse.json({
    owned,
    equipped: {
      bannerId: preferences?.equippedBannerId ?? null,
      titleId: preferences?.equippedTitleId ?? null,
      borderId: preferences?.equippedBorderId ?? null,
      themeId: preferences?.equippedThemeId ?? null,
      themeAccent,
    },
  });
}

const equipSchema = z.object({
  slot: z.enum(["banner", "title", "border", "theme"]),
  itemId: z.string().cuid(),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = equipSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { slot, itemId } = parsed.data;

  const purchase = await prisma.purchase.findFirst({
    where: { userId: session.user.id, itemId },
    include: { item: true },
  });

  if (!purchase) {
    return NextResponse.json({ error: "Item not owned" }, { status: 400 });
  }

  const expectedKind = slot === "banner" ? "banner" : slot === "title" ? "title" : slot === "border" ? "border" : "theme";
  if (purchase.item.kind !== expectedKind) {
    return NextResponse.json({ error: "Item cannot be equipped in this slot" }, { status: 400 });
  }

  await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      equippedBannerId: slot === "banner" ? itemId : undefined,
      equippedTitleId: slot === "title" ? itemId : undefined,
      equippedBorderId: slot === "border" ? itemId : undefined,
      equippedThemeId: slot === "theme" ? itemId : undefined,
    },
    update:
      slot === "banner"
        ? { equippedBannerId: itemId }
        : slot === "title"
          ? { equippedTitleId: itemId }
          : slot === "border"
            ? { equippedBorderId: itemId }
            : { equippedThemeId: itemId },
  });

  return NextResponse.json({ ok: true });
}

