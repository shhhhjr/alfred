import { createAlfredTools } from "@/lib/ai/alfred-tools";
import { buildAlfredSystemPrompt } from "@/lib/ai/prompts";
import { streamAssistantReply } from "@/lib/ai/provider";
import { checkRateLimit } from "@/lib/ai/rateLimit";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { convertToModelMessages, UIMessage } from "ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

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

  const [dbUser, userPrefs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, automationLevel: true },
    }),
    prisma.userPreference.findUnique({
      where: { userId: session.user.id },
      select: { workHoursStart: true, workHoursEnd: true, breakMinutes: true },
    }),
  ]);
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
    const body = await req.json().catch(() => ({}));

    const clientMessages: UIMessage[] = Array.isArray(
      (body as { messages?: UIMessage[] }).messages
    )
      ? (body as { messages: UIMessage[] }).messages
      : [];

    let messages: UIMessage[] = [...clientMessages];

    messages = messages
      .map((m) => {
        const role =
          (m as { role?: string }).role === "user" || (m as { role?: string }).role === "assistant"
            ? ((m as { role: "user" | "assistant" }).role)
            : "user";
        let text = "";
        const anyMsg = m as { parts?: unknown[]; content?: string | unknown[]; text?: string; id?: string };
        if (Array.isArray(anyMsg.parts)) {
          const partWithText = anyMsg.parts.find((p: unknown) => getTextFromPart(p));
          text = partWithText ? getTextFromPart(partWithText) : "";
        } else if (typeof anyMsg.content === "string") {
          text = anyMsg.content;
        } else if (Array.isArray(anyMsg.content)) {
          const partWithText = anyMsg.content.find((p: unknown) => getTextFromPart(p));
          text = partWithText ? getTextFromPart(partWithText) : "";
        } else if (typeof anyMsg.text === "string") {
          text = anyMsg.text;
        }
        return {
          id: anyMsg.id ?? crypto.randomUUID(),
          role,
          parts: [{ type: "text" as const, text: text ?? "" }],
        };
      })
      .filter((m) => m.parts[0]?.text?.trim());

    if (!messages.length) {
      const dbRows = await prisma.chatMessage.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, role: true, content: true },
      });
      dbRows.reverse();
      messages = dbRows.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text" as const, text: m.content }],
      }));
    }

    if (!messages.length) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }

    if (messages.length === 1 && messages[0].role === "user") {
      const dbRows = await prisma.chatMessage.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "desc" },
        take: 18,
        select: { id: true, role: true, content: true },
      });
      dbRows.reverse();
      const history = dbRows.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text" as const, text: m.content }],
      }));
      messages = [...history, messages[0]];
    }

    const lastTen = messages.slice(-10);

    if (clientMessages.length > 0) {
      const lastUserThisTurn = [...lastTen].reverse().find((m) => m.role === "user");
      const userText = lastUserThisTurn?.parts?.length
        ? getTextFromPart(lastUserThisTurn.parts[0]).trim()
        : "";
      if (userText) {
        await prisma.chatMessage.create({
          data: { userId: dbUser.id, role: "user", content: userText },
        });
      }
    }

    let modelMessages;
    try {
      modelMessages = await convertToModelMessages(lastTen);
    } catch (convertErr) {
      console.error("convertToModelMessages error", convertErr);
      return NextResponse.json(
        { error: "Invalid message format. Please try again." },
        { status: 400 }
      );
    }

    const automationLevel = (dbUser.automationLevel ?? "semi") as "manual" | "semi" | "auto";
    const schedulePrefs = userPrefs ? {
      workHoursStart: userPrefs.workHoursStart ?? 9,
      workHoursEnd: userPrefs.workHoursEnd ?? 17,
      breakMinutes: userPrefs.breakMinutes ?? 15,
    } : undefined;
    const userTimezone =
      req.headers.get("x-user-timezone") ||
      (userPrefs as { timezone?: string } | null)?.timezone ||
      "America/New_York";
    const systemPrompt = buildAlfredSystemPrompt(dbUser.name ?? null, automationLevel, schedulePrefs, userTimezone);

    const tools = createAlfredTools(session.user.id, userTimezone);
    const result = await streamAssistantReply(systemPrompt, modelMessages, {
      tools,
      maxToolSteps: 10,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: lastTen,
      onFinish: async ({ responseMessage }) => {
        try {
          const parts = responseMessage?.parts ?? [];
          const text = parts
            .filter(
              (p): p is { type: "text"; text: string } =>
                p && typeof p === "object" && "text" in p && typeof (p as { text: unknown }).text === "string"
            )
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
        } catch (saveErr) {
          console.error("Failed to save chat messages:", saveErr);
        }
      },
    });
  } catch (err) {
    console.error("Chat error", err);
    const message = err instanceof Error ? err.message : "Failed to generate response";
    const isConfig = /api key|no ai provider|unauthorized|invalid.*key/i.test(message);
    return NextResponse.json(
      { error: isConfig ? message : "Failed to generate response. Please try again." },
      { status: isConfig ? 503 : 500 }
    );
  }
}
