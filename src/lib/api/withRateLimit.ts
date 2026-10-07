import type { Middleware } from './compose';
import {
  rateLimit,
  rateLimitWriteAsync,
  type RateLimitResult,
  applyRateLimitHeaders,
} from '@/lib/rate-limit';
import { apiRateLimited } from './standardResponse';

type Mode = 'read' | 'write';

interface ContextWithUser {
  user?: {
    id: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- runs on any route context; see compose.ts
export function withRateLimit(mode: Mode = 'read'): Middleware<any> {
  return async (req, ctx, next) => {
    let result: RateLimitResult;
    if (mode === 'read') {
      result = await rateLimit(req);
    } else {
      // If a user is available in ctx, use their id; otherwise fall back to IP-based
      const ctxWithUser = ctx as ContextWithUser | undefined;
      const userId = ctxWithUser?.user?.id;
      if (userId) {
        result = await rateLimitWriteAsync(userId);
      } else {
        result = await rateLimit(req);
      }
    }

    if (!result.success) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      const res = apiRateLimited('Rate limit exceeded', retryAfter);
      return res;
    }
    const response = await next(req, ctx);
    try {
      if (response instanceof Response) {
        return applyRateLimitHeaders(response, result);
      }
      return response;
    } catch {
      return response;
    }
  };
}
