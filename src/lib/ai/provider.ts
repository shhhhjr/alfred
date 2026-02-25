import { env } from "@/lib/env";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { createMinimax } from "vercel-minimax-ai-provider";
import type { ModelMessage } from "ai";
import { generateText, streamText, stepCountIs } from "ai";

export type StreamResult = ReturnType<typeof streamText>;

const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_MODEL = "llama-3.1-8b-instant";
const MINIMAX_MODEL = "MiniMax-M2";

/** Providers in fallback order. MiniMax/Groq first to avoid Gemini quota. */
const PROVIDERS = [
  {
    name: "MiniMax",
    hasKey: () => !!env.MINIMAX_API_KEY,
    model: () => (env.MINIMAX_API_KEY ? createMinimax({ apiKey: env.MINIMAX_API_KEY })(MINIMAX_MODEL) : minimax(MINIMAX_MODEL)),
  },
  {
    name: "Groq",
    hasKey: () => !!env.GROQ_API_KEY,
    model: () => groq(GROQ_MODEL),
  },
  {
    name: "Gemini",
    hasKey: () => !!env.GEMINI_API_KEY,
    model: () => google(GEMINI_MODEL),
  },
] as const;

/**
 * Preflight: minimal generateText to verify provider works before streaming.
 * streamText errors (e.g. 429) often surface when the stream is consumed, not when called,
 * so we use generateText to force the request and catch quota errors here.
 */
async function preflightProvider(
  name: string,
  model: ReturnType<(typeof PROVIDERS)[number]["model"]>,
  system: string,
  messages: ModelMessage[]
): Promise<boolean> {
  try {
    await generateText({
      model,
      system,
      messages: messages.slice(-2),
      maxTokens: 1,
    });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isQuota =
      /rate limit|429|quota|resource exhausted|exceeded|google.*fail|api.*fail/i.test(msg);
    if (isQuota) console.warn(`[AI] ${name} quota/rate limit, trying next provider`);
    return false;
  }
}

/**
 * Unified AI provider with fallback. Order: MiniMax → Groq → Gemini.
 * Uses a preflight check so quota errors are caught before streaming.
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

  const errors: string[] = [];

  for (const provider of PROVIDERS) {
    if (!provider.hasKey()) continue;

    const model = provider.model();
    const ok = await preflightProvider(provider.name, model, system, lastTen);
    if (!ok) {
      errors.push(`${provider.name}: quota/rate limit`);
      continue;
    }

    try {
      return await streamText({ ...baseOptions, model });
    } catch (e) {
      errors.push(`${provider.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const detail = errors.length > 0 ? ` (${errors.join("; ")})` : "";
  throw new Error(
    `No AI provider available. Add MINIMAX_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY to Vercel env vars.${detail}`
  );
}
