import { env } from "@/lib/env";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { minimax } from "vercel-minimax-ai-provider";
import type { ModelMessage } from "ai";
import { streamText, stepCountIs } from "ai";

export type StreamResult = ReturnType<typeof streamText>;

const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_MODEL = "llama-3.1-8b-instant";
const MINIMAX_MODEL = "MiniMax-M2";

/**
 * Unified AI provider. Order: MiniMax (subscription) → Gemini → Groq.
 * MiniMax first if you have a subscription to avoid free-tier limits.
 */
export async function streamAssistantReply(
  system: string,
  messages: ModelMessage[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: { tools?: Record<string, any>; maxToolSteps?: number }
): Promise<StreamResult> {
  const lastTen = messages.slice(-10);
  const tools = options?.tools;
  const maxToolSteps = options?.maxToolSteps ?? 5;
  const baseOptions = {
    system,
    messages: lastTen,
    ...(tools && Object.keys(tools).length > 0
      ? { tools, stopWhen: stepCountIs(maxToolSteps) }
      : {}),
  };

  const tryProvider = async (name: string, fn: () => Promise<StreamResult>) => {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = /rate limit|429|quota|resource exhausted|exceeded/i.test(msg);
      if (isRateLimit) console.warn(`[AI] ${name} rate limited, trying next provider`);
      throw err;
    }
  };

  if (env.MINIMAX_API_KEY) {
    try {
      return await tryProvider("MiniMax", () =>
        streamText({ ...baseOptions, model: minimax(MINIMAX_MODEL) })
      );
    } catch {
      /* fall through */
    }
  }

  if (env.GEMINI_API_KEY) {
    try {
      return await tryProvider("Gemini", () =>
        streamText({ ...baseOptions, model: google(GEMINI_MODEL) })
      );
    } catch {
      /* fall through */
    }
  }

  if (env.GROQ_API_KEY) {
    try {
      return await tryProvider("Groq", () =>
        streamText({ ...baseOptions, model: groq(GROQ_MODEL) })
      );
    } catch {
      /* fall through */
    }
  }

  throw new Error("No AI provider available. Add MINIMAX_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY to .env");
}
