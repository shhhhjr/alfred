import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { env } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const msg = await prisma.emailMessage.findFirst({
    where: { id: params.id, userId: session.user.id },
  });

  if (!msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  let emailBody = "";
  try {
    const body = await request.json();
    emailBody = typeof body?.emailBody === "string" ? body.emailBody : "";
  } catch {
    emailBody = "";
  }

  const model = env.GEMINI_API_KEY
    ? google("gemini-2.0-flash")
    : env.GROQ_API_KEY
      ? groq("llama-3.1-8b-instant")
      : null;

  if (!model) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  try {
    const { text } = await generateText({
      model,
      system: "You draft professional, concise email replies. Return only the plain text body of the reply. No subject line, no headers. Be helpful and appropriate.",
      prompt: `Reply to this email:
From: ${msg.fromAddress}
Subject: ${msg.subject}

---
${emailBody.slice(0, 4000)}
---

Draft a brief, professional reply:`,
    });

    const match = msg.fromAddress.match(/<([^>]+)>/);
    const toEmail = match ? match[1].trim() : msg.fromAddress.trim();

    return NextResponse.json({
      draft: text?.trim() ?? "",
      to: toEmail,
      subject: msg.subject.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`,
    });
  } catch (e) {
    console.error("Draft reply error", e);
    return NextResponse.json({ error: "Failed to draft reply" }, { status: 500 });
  }
}
