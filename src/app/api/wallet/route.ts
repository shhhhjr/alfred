import { getAuthSession } from "@/lib/auth/session";
import { getWalletBalance } from "@/lib/rangs/earn";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const balance = await getWalletBalance(session.user.id);
  return NextResponse.json({ balance });
}
