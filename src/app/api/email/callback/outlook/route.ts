import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { exchangeOutlookCode } from "@/lib/email/outlook";
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
    const { accessToken, refreshToken, email } = await exchangeOutlookCode(code, state);
    await prisma.emailAccount.upsert({
      where: {
        userId_email: { userId: session.user.id, email },
      },
      create: {
        userId: session.user.id,
        provider: "outlook",
        email,
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
      },
      update: {
        accessToken: encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
      },
    });
    return NextResponse.redirect(new URL(`${returnTo}?connected=outlook`, request.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`${returnTo}?error=${encodeURIComponent(msg)}`, request.url));
  }
}
