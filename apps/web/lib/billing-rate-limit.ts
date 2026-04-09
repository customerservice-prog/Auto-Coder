/**
 * Sliding-window rate limit for billing routes (`/api/stripe/checkout`, `/api/stripe/portal`).
 * In-process only — use a shared store (e.g. Redis) if you scale to many instances.
 */

const timestampsByUser = new Map<string, number[]>();

export function billingRateLimitConfig(): { maxPerWindow: number; windowMs: number } {
  const rawMax = Number.parseInt(process.env.BILLING_API_MAX_PER_WINDOW || '15', 10);
  const maxPerWindow = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 0;
  const windowMs = Math.max(
    1000,
    Number.parseInt(process.env.BILLING_API_WINDOW_MS || '60000', 10) || 60000
  );
  return { maxPerWindow, windowMs };
}

/** `false` when `BILLING_API_MAX_PER_WINDOW` is **`0`** (or invalid). */
export function isBillingRateLimitEnabled(): boolean {
  return billingRateLimitConfig().maxPerWindow > 0;
}

export type BillingQuotaOk = { ok: true; headers: Record<string, string> };

export type BillingQuotaDenied = {
  ok: false;
  status: 429;
  body: Record<string, unknown>;
  headers: Record<string, string>;
};

export type BillingQuotaResult = BillingQuotaOk | BillingQuotaDenied;

/** When `BILLING_API_MAX_PER_WINDOW` is 0 or invalid, limits are disabled. */
export function consumeBillingApiQuota(userId: string): BillingQuotaResult {
  const { maxPerWindow, windowMs } = billingRateLimitConfig();
  if (maxPerWindow <= 0) {
    return { ok: true, headers: {} };
  }

  const now = Date.now();
  let bucket = timestampsByUser.get(userId);
  if (!bucket) {
    bucket = [];
    timestampsByUser.set(userId, bucket);
  }

  const cutoff = now - windowMs;
  const recent = bucket.filter((t) => t > cutoff);
  timestampsByUser.set(userId, recent);

  if (recent.length >= maxPerWindow) {
    const oldest = Math.min(...recent);
    const resetAt = oldest + windowMs;
    const retrySec = Math.max(1, Math.ceil((resetAt - now) / 1000));
    return {
      ok: false,
      status: 429,
      body: {
        error: 'Too many billing requests. Try again shortly.',
        retryAfterMs: resetAt - now,
      },
      headers: {
        'Retry-After': String(retrySec),
        'X-RateLimit-Limit': String(maxPerWindow),
        'X-RateLimit-Remaining': '0',
      },
    };
  }

  recent.push(now);
  const oldestAfter = Math.min(...recent);
  const resetAt = oldestAfter + windowMs;
  return {
    ok: true,
    headers: {
      'X-RateLimit-Limit': String(maxPerWindow),
      'X-RateLimit-Remaining': String(maxPerWindow - recent.length),
      'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
    },
  };
}

/** @internal Vitest only — clears in-memory state between tests. */
export function __resetBillingRateLimitForTests(): void {
  timestampsByUser.clear();
}
