// ============================================================
// Rate Limiter - Sliding Window (In-Memory)
// ============================================================
//
// Lightweight rate limiter using a sliding window counter.
// No external dependencies required.
//

export interface RateLimitConfig {
  /** Maximum number of requests in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Custom key prefix */
  keyPrefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private windows: Map<string, WindowEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    private config: RateLimitConfig,
  ) {
    // Cleanup stale entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if a request should be allowed
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const fullKey = this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
    const windowMs = this.config.windowMs;

    let entry = this.windows.get(fullKey);

    // If no entry or window has expired, create new window
    if (!entry || (now - entry.windowStart) >= windowMs) {
      entry = { count: 0, windowStart: now };
      this.windows.set(fullKey, entry);
    }

    entry.count++;

    const resetAt = entry.windowStart + windowMs;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);

    return {
      success: entry.count <= this.config.maxRequests,
      remaining,
      resetAt,
      limit: this.config.maxRequests,
    };
  }

  /**
   * Get rate limit headers for a response
   */
  getHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    };
  }

  /**
   * Remove stale entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows.entries()) {
      if ((now - entry.windowStart) >= this.config.windowMs * 2) {
        this.windows.delete(key);
      }
    }
  }

  /**
   * Get current number of tracked windows
   */
  get size(): number {
    return this.windows.size;
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.windows.clear();
  }
}

// Pre-configured limiters
export const rateLimiters = {
  /** General API: 100 req/min */
  api: new RateLimiter({ maxRequests: 100, windowMs: 60 * 1000, keyPrefix: 'api' }),
  /** Auth endpoints: 5 req/min */
  auth: new RateLimiter({ maxRequests: 5, windowMs: 60 * 1000, keyPrefix: 'auth' }),
  /** AI endpoints: 20 req/min */
  ai: new RateLimiter({ maxRequests: 20, windowMs: 60 * 1000, keyPrefix: 'ai' }),
  /** AI endpoints: 20 req/min */
  webhook: new RateLimiter({ maxRequests: 30, windowMs: 60 * 1000, keyPrefix: 'webhook' }),
  /** General: 200 req/min */
  general: new RateLimiter({ maxRequests: 200, windowMs: 60 * 1000, keyPrefix: 'general' }),
};
