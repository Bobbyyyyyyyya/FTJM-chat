interface RateLimitEntry {
  timestamps: number[]
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map()
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  tryAcquire(key: string): boolean {
    const now = Date.now()
    const entry = this.limits.get(key)
    if (!entry) {
      this.limits.set(key, { timestamps: [now] })
      return true
    }
    entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs)
    if (entry.timestamps.length >= this.maxRequests) {
      return false
    }
    entry.timestamps.push(now)
    return true
  }

  remaining(key: string): number {
    const now = Date.now()
    const entry = this.limits.get(key)
    if (!entry) return this.maxRequests
    const active = entry.timestamps.filter((t) => now - t < this.windowMs)
    return Math.max(0, this.maxRequests - active.length)
  }

  resetTimeMs(key: string): number {
    const entry = this.limits.get(key)
    if (!entry || entry.timestamps.length === 0) return 0
    const oldest = Math.min(...entry.timestamps.filter((t) => Date.now() - t < this.windowMs))
    return Math.max(0, oldest + this.windowMs - Date.now())
  }
}

export class RateLimitError extends Error {
  retryAfterMs: number
  constructor(message: string, retryAfterMs: number) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

export function enforceRateLimit(limiter: RateLimiter, key: string, label: string): void {
  if (!limiter.tryAcquire(key)) {
    const wait = Math.ceil(limiter.resetTimeMs(key) / 1000)
    throw new RateLimitError(
      `${label} is te vaak aangeroepen. Probeer over ${wait} seconden opnieuw.`,
      limiter.resetTimeMs(key)
    )
  }
}

// Global rate limiters per category
export const authLimiter = new RateLimiter(5, 60_000)        // 5 per minuut
export const messageLimiter = new RateLimiter(30, 60_000)     // 30 per minuut
export const postLimiter = new RateLimiter(40, 60_000)        // 40 per minuut
export const forumThreadLimiter = new RateLimiter(3, 60_000)  // 3 per minuut
export const forumCommentLimiter = new RateLimiter(15, 60_000)// 15 per minuut
export const reportLimiter = new RateLimiter(3, 3600_000)     // 3 per uur
export const typingLimiter = new RateLimiter(30, 60_000)      // 30 per minuut
export const socialLimiter = new RateLimiter(10, 60_000)      // 10 per minuut
export const uploadLimiter = new RateLimiter(5, 3600_000)     // 5 per uur
export const egressLimiter = new RateLimiter(20, 60_000)      // 20 requests per minuut
