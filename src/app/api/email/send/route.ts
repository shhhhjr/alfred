import { getAuthSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const sendSchema = z.object({
  to: z.string().email(),
  subject: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(10_000),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  return NextResponse.json(
    {
      ok: false,
      message:
        "Email send is staged for Phase 2. Drafting flow will stay in-app for review before provider send.",
      draft: parsed.data,
    },
    { status: 202 },
  );
}
