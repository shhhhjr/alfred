import { getAuthSession } from "@/lib/auth/session";
import { getWalletBalance } from "@/lib/rangs/earn";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const redeemSchema = z.object({ itemId: z.string().cuid() });

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = redeemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const item = await prisma.shopItem.findUnique({
    where: { id: parsed.data.itemId },
  });
  if (!item || !item.available)
    return NextResponse.json({ error: "Item not found or unavailable" }, { status: 404 });

  const balance = await getWalletBalance(session.user.id);
  if (balance < item.cost)
    return NextResponse.json({ error: "Insufficient Rangs" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.purchase.create({
      data: { userId: session.user.id!, itemId: item.id, cost: item.cost },
    });
    const newBalance = balance - item.cost;
    await tx.wallet.upsert({
      where: { userId: session.user.id! },
      create: { userId: session.user.id!, balance: newBalance },
      update: { balance: newBalance },
    });
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "shop_purchase",
      description: `Purchased: ${item.name} for ${item.cost} Rangs`,
      metadata: { itemId: item.id, cost: item.cost },
    },
  });

  const newBalance = balance - item.cost;
  return NextResponse.json({ ok: true, item: item.name, newBalance });
}
