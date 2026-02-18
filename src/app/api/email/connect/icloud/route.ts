import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { testICloudConnection } from "@/lib/email/icloud";
import { encrypt } from "@/lib/security/encryption";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email(),
  appPassword: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or app password" }, { status: 400 });
  }

  const { email, appPassword } = parsed.data;

  try {
    await testICloudConnection(email, appPassword);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let userMsg = msg;
    if (msg.toLowerCase().includes("auth") || msg.toLowerCase().includes("invalid") || msg.includes("AUTHENTICATIONFAILED")) {
      userMsg = "Invalid email or app-specific password. Generate one at appleid.apple.com → Sign-In and Security → App-Specific Passwords.";
    } else if (msg.toLowerCase().includes("connection") || msg.toLowerCase().includes("econnrefused") || msg.toLowerCase().includes("timeout")) {
      userMsg = "Could not reach iCloud. Check your internet connection and try again.";
    }
    return NextResponse.json({ error: userMsg }, { status: 400 });
  }

  await prisma.emailAccount.upsert({
    where: {
      userId_email: { userId: session.user.id, email },
    },
    create: {
      userId: session.user.id,
      provider: "icloud",
      email,
      imapPassword: encrypt(appPassword),
    },
    update: {
      imapPassword: encrypt(appPassword),
    },
  });

  return NextResponse.json({ ok: true, email });
}
