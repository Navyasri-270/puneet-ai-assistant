/**
 * Redacts sensitive tokens, secrets, and authorization values before logging.
 */
function sanitizeArg(arg: any): any {
  if (typeof arg === 'string') {
    return arg
      .replace(/Bearer\s+[A-Za-z0-9._\~+/=-]+/gi, 'Bearer [REDACTED]')
      .replace(/(access_token|refresh_token|token|secret|password)=[^&\s]+/gi, '$1=[REDACTED]')
      .replace(/("accessToken"|"refreshToken"|"clientSecret"|"apiKey"):\s*"[^"]+"/gi, '$1: "[REDACTED]"');
  }
  if (typeof arg === 'object' && arg !== null) {
    try {
      const copy = { ...arg };
      for (const key of Object.keys(copy)) {
        if (/token|secret|password|key|auth/i.test(key)) {
          copy[key] = '[REDACTED]';
        } else if (typeof copy[key] === 'object') {
          copy[key] = sanitizeArg(copy[key]);
        }
      }
      return copy;
    } catch (e) {
      return '[Object]';
    }
  }
  return arg;
}

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, ...args.map(sanitizeArg));
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, ...args.map(sanitizeArg));
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, ...args.map(sanitizeArg));
  },
};
