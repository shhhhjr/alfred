const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_USER = 20;
const CACHE_TTL_MS = 60 * 60 * 1000;

const requestLog = new Map<string, number[]>();
const responseCache = new Map<string, { expiresAt: number; text: string }>();

type Message = { role: string; content: string };

export function checkRateLimit(userId: string): { ok: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = requestLog.get(userId) ?? [];
  const recent = timestamps.filter((ts) => ts > windowStart);

  if (recent.length >= MAX_REQUESTS_PER_USER) {
    const oldest = recent[0];
    const retryAfterSeconds = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    requestLog.set(userId, recent);
    return { ok: false, retryAfterSeconds };
  }

  recent.push(now);
  requestLog.set(userId, recent);
  return { ok: true };
}

function getCacheKey(system: string, messages: Message[]) {
  return JSON.stringify({
    system,
    messages: messages.slice(-10),
  });
}

export function getCachedResponse(system: string, messages: Message[]): string | null {
  const key = getCacheKey(system, messages);
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.text;
  }
  return null;
}

export function setCachedResponse(system: string, messages: Message[], text: string): void {
  const key = getCacheKey(system, messages);
  responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, text });
}

/**
 * Exponential backoff delay for retries when both providers fail.
 */
export function getBackoffDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30_000);
}
