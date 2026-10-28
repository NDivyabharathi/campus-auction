interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < 120000);
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Lightweight sliding window rate limiter
 * @param key unique identifier (e.g. `question:userId` or `answer:userId`)
 * @param limit maximum allowed actions in the window
 * @param windowMs window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { timestamps: [] };

  // Filter timestamps within current window
  const activeTimestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (activeTimestamps.length >= limit) {
    const oldest = activeTimestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  activeTimestamps.push(now);
  rateLimitStore.set(key, { timestamps: activeTimestamps });

  return {
    allowed: true,
    remaining: limit - activeTimestamps.length,
  };
}

// Default limits
export const QUESTION_RATE_LIMIT = 5; // 5 questions per minute
export const ANSWER_RATE_LIMIT = 10;  // 10 answers per minute
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

