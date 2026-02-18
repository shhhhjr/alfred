import { createAlfredTools } from "@/lib/ai/alfred-tools";
import { buildAlfredSystemPrompt } from "@/lib/ai/prompts";
import { streamAssistantReply } from "@/lib/ai/provider";
import { checkRateLimit } from "@/lib/ai/rateLimit";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { convertToModelMessages, UIMessage } from "ai";
import { NextResponse } from "next/server";

export const maxDuration = 30;

function getTextFromPart(part: unknown): string {
  if (part && typeof part === "object" && "text" in part && typeof (part as { text: unknown }).text === "string") {
    return (part as { text: string }).text;
  }
  return "";
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, automationLevel: true },
  });
  if (!dbUser) {
    return NextResponse.json(
      { error: "Account no longer exists. Please sign in again." },
      { status: 401 }
    );
  }

  const limitCheck = checkRateLimit(session.user.id);
  if (!limitCheck.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: limitCheck.retryAfterSeconds ?? 60 },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    let messages: UIMessage[] = body?.messages ?? [];
    if (!messages?.length) {
      const dbRows = await prisma.chatMessage.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true, role: true, content: true },
      });
      messages = dbRows.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text" as const, text: m.content }],
      }));
    }
    if (!messages?.length) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }
    if (messages.length === 1 && messages[0].role === "user") {
      const dbRows = await prisma.chatMessage.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "asc" },
        take: 18,
        select: { id: true, role: true, content: true },
      });
      const history = dbRows.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text" as const, text: m.content }],
      }));
      messages = [...history, messages[0]];
    }
    const lastTen = messages.slice(-10);
    const modelMessages = await convertToModelMessages(lastTen);

    const automationLevel = (dbUser.automationLevel ?? "semi") as "manual" | "semi" | "auto";
    const systemPrompt = buildAlfredSystemPrompt(dbUser.name ?? null, automationLevel);

    const tools = createAlfredTools(session.user.id);
    const result = await streamAssistantReply(systemPrompt, modelMessages, {
      tools,
      maxToolSteps: 5,
    });

    const lastUserMsg = lastTen.filter((m) => m.role === "user").pop();
    const lastUserContent = lastUserMsg?.parts?.length
      ? getTextFromPart(lastUserMsg.parts[0])
      : "";

    if (lastUserContent.trim()) {
      await prisma.chatMessage.create({
        data: { userId: dbUser.id, role: "user", content: lastUserContent.trim() },
      });
    }

    return result.toUIMessageStreamResponse({
      originalMessages: lastTen,
      onFinish: async ({ responseMessage }) => {
        const parts = responseMessage?.parts ?? [];
        const text = parts
          .filter((p): p is { type: "text"; text: string } => p && typeof p === "object" && "text" in p && typeof (p as { text: unknown }).text === "string")
          .map((p) => (p as { text: string }).text)
          .join("");
        if (text?.trim()) {
          await prisma.chatMessage.create({
            data: {
              userId: dbUser.id,
              role: "assistant",
              content: text.trim(),
            },
          });
        }
      },
    });
  } catch (err) {
    console.error("Chat error", err);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
