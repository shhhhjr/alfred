import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import type { NormalizedEmail } from "./parser";

type EmailAnalysis = {
  importance: "high" | "medium" | "low";
  actionItems: string[];
  detectedEvents: Array<{ title: string; date?: string; time?: string; location?: string }>;
  detectedDeadlines: Array<{ description: string; dueDate: string }>;
  aiSummary: string;
  requiresSignup: boolean;
  requiresResponse: boolean;
  signupUrl: string | null;
};

type BatchAnalysis = { emails: Array<{ id: string; accountId: string; analysis: EmailAnalysis }> };

const SYSTEM = `You analyze emails and return JSON. For each email, provide:
- importance: "high" | "medium" | "low" (high=urgent/action needed, medium=relevant, low=informational)
- actionItems: string[] (concrete things the user should do)
- detectedEvents: { title, date?, time?, location? }[] (calendar-like events mentioned)
- detectedDeadlines: { description, dueDate }[] (deadlines, due dates)
- aiSummary: string (1-2 sentence summary of the email)
- requiresSignup: boolean (contains signup/registration link?)
- requiresResponse: boolean (does this email need a reply? e.g. question, request, invitation)
- signupUrl: string | null (URL if requiresSignup)

Return valid JSON only: { "emails": [ { "id": "<providerId>", "accountId": "<accountId>", "analysis": { ... } } ] }`;

export async function analyzeEmailsWithAI(
  userId: string,
  emails: NormalizedEmail[]
): Promise<void> {
  if (emails.length === 0) return;

  const prompt = emails
    .map(
      (e) =>
        `--- Email id=${e.id} accountId=${e.accountId} ---\nFrom: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet}\n---`
    )
    .join("\n\n");

  let text: string;
  try {
    const model = env.GEMINI_API_KEY
      ? google("gemini-2.0-flash")
      : env.GROQ_API_KEY
        ? groq("llama-3.1-8b-instant")
        : null;
    if (!model) return;

    const result = await generateText({
      model,
      system: SYSTEM,
      prompt,
    });
    text = result.text;
  } catch {
    return;
  }

  let parsed: BatchAnalysis;
  try {
    const json = text.replace(/```json\s*|\s*```/g, "").trim();
    parsed = JSON.parse(json) as BatchAnalysis;
  } catch {
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const automationLevel = user?.automationLevel ?? "semi";

  for (const item of parsed.emails ?? []) {
    const a = item.analysis;
    if (!a) continue;

    const importance = ["high", "medium", "low"].includes(a.importance) ? a.importance : "low";
    const actionItems = Array.isArray(a.actionItems) ? a.actionItems : [];
    const detectedEvents = Array.isArray(a.detectedEvents) ? a.detectedEvents : [];
    const detectedDeadlines = Array.isArray(a.detectedDeadlines) ? a.detectedDeadlines : [];
    const aiSummary = typeof a.aiSummary === "string" && a.aiSummary.trim() ? a.aiSummary.trim().slice(0, 500) : null;
    const requiresSignup = Boolean(a.requiresSignup);
    const requiresResponse = Boolean(a.requiresResponse);
    const signupUrl = typeof a.signupUrl === "string" ? a.signupUrl : null;

    await prisma.emailMessage.updateMany({
      where: { emailAccountId: item.accountId, providerId: item.id },
      data: {
        importance,
        actionItems: actionItems as object,
        detectedEvents: detectedEvents as object,
        detectedDeadlines: detectedDeadlines as object,
        aiSummary,
        requiresSignup,
        requiresResponse,
        signupUrl,
      },
    });

    if (requiresSignup && signupUrl) {
      await prisma.task.create({
        data: {
          userId,
          title: "Sign up / Register",
          description: `Email signup required: ${signupUrl}`,
          category: "errand",
          importance: 9,
          source: "email",
        },
      });
    }

    if (automationLevel === "manual") continue;

    for (const ev of detectedEvents) {
      if (!ev.title) continue;
      const start = ev.date && ev.time ? new Date(`${ev.date}T${ev.time}`) : new Date();
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      await prisma.calendarEvent.create({
        data: {
          userId,
          title: ev.title,
          location: ev.location ?? null,
          startTime: start,
          endTime: end,
          source: "email",
          sourceRef: item.id,
        },
      });
    }

    for (const dl of detectedDeadlines) {
      if (!dl.description) continue;
      const due = dl.dueDate ? new Date(dl.dueDate) : new Date();
      await prisma.task.create({
        data: {
          userId,
          title: dl.description.slice(0, 150),
          dueDate: due,
          category: "assignment",
          importance: 7,
          source: "email",
        },
      });
    }

    if (automationLevel === "auto") {
      await prisma.activityLog.create({
        data: {
          userId,
          action: "email_auto_processed",
          description: `Auto-created events/tasks from email`,
          metadata: { emailId: item.id },
        },
      });
    }
  }
}
