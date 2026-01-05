import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';

const RATE_LIMIT_MAX_TOKENS = 30;
const RATE_LIMIT_INTERVAL_MS = 60_000;
const RATE_LIMIT_INTERVAL_LABEL = '60 s';
const RATE_LIMIT_PREFIX = 'patientmatch:api';

export type RateLimitState = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  reason?: string;
};

interface RateLimiter {
  limit(identifier: string): Promise<RateLimitState>;
}

class UpstashRateLimiter implements RateLimiter {
  private readonly limiter: Ratelimit;

  constructor(url: string, token: string) {
    const redis = new Redis({
      url,
      token,
    });

    this.limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(
        RATE_LIMIT_MAX_TOKENS,
        RATE_LIMIT_INTERVAL_LABEL,
        RATE_LIMIT_MAX_TOKENS,
      ),
      prefix: RATE_LIMIT_PREFIX,
    });
  }

  async limit(identifier: string): Promise<RateLimitState> {
    const result = await this.limiter.limit(identifier);

    // Avoid unhandled promise rejections for background analytics/prefetch work.
    void result.pending.catch(() => undefined);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      reason: result.reason,
    };
  }
}

type MemoryBucketState = {
  tokens: number;
  lastRefill: number;
};

class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, MemoryBucketState>();
  private readonly refillPerMs = RATE_LIMIT_MAX_TOKENS / RATE_LIMIT_INTERVAL_MS;

  async limit(identifier: string): Promise<RateLimitState> {
    const now = Date.now();
    let bucket = this.buckets.get(identifier);

    if (!bucket) {
      bucket = { tokens: RATE_LIMIT_MAX_TOKENS, lastRefill: now };
      this.buckets.set(identifier, bucket);
    } else {
      const elapsed = now - bucket.lastRefill;
      if (elapsed > 0) {
        const refillAmount = elapsed * this.refillPerMs;
        bucket.tokens = Math.min(RATE_LIMIT_MAX_TOKENS, bucket.tokens + refillAmount);
        bucket.lastRefill = now;
      }
    }

    let success = false;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      success = true;
    }

    const remaining = Math.max(0, Math.floor(bucket.tokens));
    const tokensNeeded = Math.max(0, 1 - bucket.tokens);
    const timeToNextToken =
      tokensNeeded > 0 ? Math.ceil(tokensNeeded / this.refillPerMs) : 0;
    const timeToFull =
      bucket.tokens >= RATE_LIMIT_MAX_TOKENS
        ? 0
        : Math.ceil((RATE_LIMIT_MAX_TOKENS - bucket.tokens) / this.refillPerMs);
    const resetDelay = timeToNextToken > 0 ? timeToNextToken : timeToFull;

    return {
      success,
      limit: RATE_LIMIT_MAX_TOKENS,
      remaining,
      reset: now + resetDelay,
    };
  }
}

let memoryWarningLogged = false;

function createRateLimiter(): RateLimiter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const env = process.env.NODE_ENV;
  const isDevLike = env === 'development' || env === 'test';

  if (url && token) {
    return new UpstashRateLimiter(url, token);
  }

  if (isDevLike) {
    if (!memoryWarningLogged) {
      console.warn(
        '[rate-limit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN missing; using in-memory limiter.',
      );
      memoryWarningLogged = true;
    }
    return new MemoryRateLimiter();
  }

  throw new Error(
    '[rate-limit] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured in production.',
  );
}

const limiter: RateLimiter = createRateLimiter();

export function buildSharedRateLimitKey(ip: string): string {
  return `ip:${ip || 'unknown'}`;
}

export async function takeSharedRateLimit(ip: string): Promise<RateLimitState> {
  const identifier = buildSharedRateLimitKey(ip);
  return limiter.limit(identifier);
}

export function createRateLimitHeaders(state: RateLimitState): Record<string, string> {
  const now = Date.now();
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': state.limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, state.remaining).toString(),
    'X-RateLimit-Reset': Math.max(0, Math.ceil(state.reset / 1000)).toString(),
  };

  if (!state.success) {
    const retryAfter = state.reset > now ? Math.ceil((state.reset - now) / 1000) : 1;
    headers['Retry-After'] = Math.max(1, retryAfter).toString();
  }

  return headers;
}

export function getClientIp(
  request: NextRequest | Request & { headers: Headers },
): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const real = request.headers.get('x-real-ip');
  if (real) return real;

  const client = request.headers.get('x-client-ip');
  if (client) return client;

  return 'unknown';
}

export const RATE_LIMIT_RULE = {
  maxTokens: RATE_LIMIT_MAX_TOKENS,
  intervalMs: RATE_LIMIT_INTERVAL_MS,
};
