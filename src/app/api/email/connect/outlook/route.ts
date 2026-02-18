import { getAuthSession } from "@/lib/auth/session";
import { getOutlookOAuthUrl } from "@/lib/email/outlook";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const returnTo = url.searchParams.get("returnTo") || "/email";
    const oauthUrl = await getOutlookOAuthUrl(session.user.id, returnTo);
    return NextResponse.redirect(oauthUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
