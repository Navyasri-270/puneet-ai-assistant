interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Simple in-memory sliding window rate limiter.
 * @param identifier IP or Auth Token identifier
 * @param limit Maximum allowed requests per window
 * @param windowMs Window duration in milliseconds (default: 60,000ms = 1 minute)
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 30,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true, remaining: limit - 1, resetMs: windowMs };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetMs: record.resetTime - now };
  }

  record.count += 1;
  return { allowed: true, remaining: limit - record.count, resetMs: record.resetTime - now };
}
