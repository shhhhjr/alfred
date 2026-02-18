import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { exchangeGmailCode } from "@/lib/email/gmail";
import { encrypt } from "@/lib/security/encryption";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  let returnTo = "/email";
  let state = stateParam;
  if (stateParam?.includes("|")) {
    const parts = stateParam.split("|");
    state = parts[0];
    returnTo = parts[1] || "/email";
  }
  
  if (error) {
    return NextResponse.redirect(new URL(`${returnTo}?error=${encodeURIComponent(error)}`, request.url));
  }
  if (!code || state !== session.user.id) {
    return NextResponse.redirect(new URL(`${returnTo}?error=invalid_callback`, request.url));
  }

  try {
    const { accessToken, refreshToken, email } = await exchangeGmailCode(code, state);
    let accessEnc: string;
    let refreshEnc: string | null = null;
    try {
      accessEnc = encrypt(accessToken);
      refreshEnc = refreshToken ? encrypt(refreshToken) : null;
    } catch (encErr) {
      const encMsg = encErr instanceof Error ? encErr.message : String(encErr);
      const hint = encMsg.includes("64 hex") || encMsg.includes("pattern")
        ? "Fix ENCRYPTION_KEY in .env (must be 64 hex chars, e.g. openssl rand -hex 32)"
        : encMsg;
      return NextResponse.redirect(new URL(`${returnTo}?error=${encodeURIComponent(hint)}`, request.url));
    }
    await prisma.emailAccount.upsert({
      where: {
        userId_email: { userId: session.user.id, email },
      },
      create: {
        userId: session.user.id,
        provider: "gmail",
        email,
        accessToken: accessEnc,
        refreshToken: refreshEnc,
      },
      update: {
        accessToken: accessEnc,
        refreshToken: refreshEnc,
      },
    });
    return NextResponse.redirect(new URL(`${returnTo}?connected=gmail`, request.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`${returnTo}?error=${encodeURIComponent(msg)}`, request.url));
  }
}
