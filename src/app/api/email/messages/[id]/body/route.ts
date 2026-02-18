import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/security/encryption";
import { getGmailClient } from "@/lib/email/gmail";
import { getOutlookGraphClient } from "@/lib/email/outlook";
import { ImapFlow } from "imapflow";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const msg = await prisma.emailMessage.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { account: true },
  });

  if (!msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const acc = msg.account;

  if (acc.provider === "gmail") {
    if (!acc.accessToken) return NextResponse.json({ error: "No token" }, { status: 400 });
    const token = decrypt(acc.accessToken);
    const gmail = await getGmailClient(token, acc.refreshToken ? decrypt(acc.refreshToken) : null);
    const res = await gmail.users.messages.get({
      userId: "me",
      id: msg.providerId,
      format: "full",
    });
    const payload = res.data.payload;
    let body = "";
    if (payload?.body?.data) {
      body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload?.parts) {
      for (const p of payload.parts) {
        if (p.mimeType === "text/html" && p.body?.data) {
          body = Buffer.from(p.body.data, "base64").toString("utf-8");
          break;
        }
        if (p.mimeType === "text/plain" && p.body?.data && !body) {
          body = Buffer.from(p.body.data, "base64").toString("utf-8");
        }
      }
    }
    return NextResponse.json({ body, html: body.includes("<") });
  }

  if (acc.provider === "outlook") {
    if (!acc.accessToken) return NextResponse.json({ error: "No token" }, { status: 400 });
    const token = decrypt(acc.accessToken);
    const client = getOutlookGraphClient(token);
    const res = await client
      .api(`/me/messages/${msg.providerId}`)
      .select("body")
      .get();
    const content = res.body?.content ?? "";
    const type = res.body?.contentType ?? "text";
    return NextResponse.json({ body: content, html: type.toLowerCase().includes("html") });
  }

  if (acc.provider === "icloud") {
    if (!acc.imapPassword) return NextResponse.json({ error: "No credentials" }, { status: 400 });
    const pass = decrypt(acc.imapPassword);
    const client = new ImapFlow({
      host: "imap.mail.me.com",
      port: 993,
      secure: true,
      auth: { user: acc.email, pass },
      logger: false,
    });
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    let body = "";
    try {
      const uid = parseInt(msg.providerId, 10);
      if (!isNaN(uid)) {
        const m = await client.fetchOne(uid, { source: true });
        body = m && typeof m === "object" && "source" in m ? String((m as { source?: Buffer }).source ?? "") : "";
      }
    } finally {
      lock.release();
      await client.logout();
    }
    return NextResponse.json({ body, html: body.includes("<html") });
  }

  return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
}
