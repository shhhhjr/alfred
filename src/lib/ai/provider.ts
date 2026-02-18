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
 * Unified AI provider: Gemini 2.5 Flash primary, Groq (Llama 3.1) fallback.
 * If Gemini rate limits, automatically fall back to Groq.
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

  if (env.GEMINI_API_KEY) {
    try {
      return streamText({
        ...baseOptions,
        model: google(GEMINI_MODEL),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = /rate limit|429|quota|resource exhausted/i.test(msg);
      if (!isRateLimit) throw err;
    }
  }

  if (env.GROQ_API_KEY) {
    try {
      return streamText({
        ...baseOptions,
        model: groq(GROQ_MODEL),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = /rate limit|429|quota|resource exhausted/i.test(msg);
      if (!isRateLimit) throw err;
    }
  }

  if (env.MINIMAX_API_KEY) {
    return streamText({
      ...baseOptions,
      model: minimax(MINIMAX_MODEL),
    });
  }

  throw new Error("No AI provider available. Add GEMINI_API_KEY, GROQ_API_KEY, or MINIMAX_API_KEY.");
}
