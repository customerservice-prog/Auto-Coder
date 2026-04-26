/**
 * Per-user quotas for POST /api/agent.
 * - Default: in-memory (single Node instance).
 * - Optional: Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 */

import { randomUUID } from 'crypto';
import { Redis } from '@upstash/redis';
import { getUpstashRedis } from '@/lib/upstash-redis';

type WindowBucket = { timestamps: number[] };

const windowStore = new Map<string, WindowBucket>();

type DailyBucket = { day: string; count: number };

const dailyStore = new Map<string, DailyBucket>();

let redisSingleton: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisSingleton !== undefined) {
    return redisSingleton;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisSingleton = null;
    return null;
  }
  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}

export function windowConfig() {
  const windowMs = Math.max(
    1000,
    Number.parseInt(process.env.AGENT_API_WINDOW_MS || '60000', 10) || 60000
  );
  const maxPerWindow = Math.max(
    1,
    Number.parseInt(process.env.AGENT_API_MAX_PER_WINDOW || '30', 10) || 30
  );
  return { windowMs, maxPerWindow };
}

export function dailyLimit(): number {
  const v = Number.parseInt(process.env.AGENT_API_DAILY_MAX || '0', 10);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export type AgentQuotaOk = {
  ok: true;
  headers: Record<string, string>;
};

export type AgentQuotaDenied = {
  ok: false;
  status: 429;
  body: Record<string, unknown>;
  headers: Record<string, string>;
};

export type AgentQuotaResult = AgentQuotaOk | AgentQuotaDenied;

function denyWindow(maxPerWindow: number, resetAt: number, now: number): AgentQuotaDenied {
  const retrySec = Math.max(1, Math.ceil((resetAt - now) / 1000));
  return {
    ok: false,
    status: 429,
    body: {
      error: 'Too many assistant requests. Try again shortly.',
      retryAfterMs: resetAt - now,
    },
    headers: {
      'Retry-After': String(retrySec),
      'X-RateLimit-Limit': String(maxPerWindow),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
    },
  };
}

function allowHeaders(
  maxPerWindow: number,
  countAfter: number,
  resetAt: number,
  dailyMax: number,
  dailyUsed: number
): Record<string, string> {
  const h: Record<string, string> = {
    'X-RateLimit-Limit': String(maxPerWindow),
    'X-RateLimit-Remaining': String(Math.max(0, maxPerWindow - countAfter)),
    'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
  };
  if (dailyMax > 0) {
    h['X-Agent-Quota-Daily-Limit'] = String(dailyMax);
    h['X-Agent-Quota-Daily-Used'] = String(dailyUsed);
  }
  return h;
}

/**
 * In-memory sliding window + optional daily cap.
 */
export function consumeAgentApiQuotaInMemory(userId: string): AgentQuotaResult {
  const now = Date.now();
  const { windowMs, maxPerWindow } = windowConfig();

  let w = windowStore.get(userId);
  if (!w) {
    w = { timestamps: [] };
    windowStore.set(userId, w);
  }
  const cutoff = now - windowMs;
  w.timestamps = w.timestamps.filter((t) => t > cutoff);

  if (w.timestamps.length >= maxPerWindow) {
    const oldest = Math.min(...w.timestamps);
    return denyWindow(maxPerWindow, oldest + windowMs, now);
  }

  const dailyMax = dailyLimit();
  if (dailyMax > 0) {
    const day = utcDay();
    let d = dailyStore.get(userId);
    if (!d || d.day !== day) {
      d = { day, count: 0 };
    }
    if (d.count >= dailyMax) {
      return {
        ok: false,
        status: 429,
        body: {
          error: 'Daily assistant quota reached. Upgrade or try again tomorrow.',
          limit: dailyMax,
          used: d.count,
        },
        headers: {
          'X-Agent-Quota-Daily-Limit': String(dailyMax),
          'X-Agent-Quota-Daily-Used': String(d.count),
        },
      };
    }
    d = { day, count: d.count + 1 };
    dailyStore.set(userId, d);

    w.timestamps.push(now);
    const oldestAfter = Math.min(...w.timestamps);
    const resetAt = oldestAfter + windowMs;
    return {
      ok: true,
      headers: allowHeaders(maxPerWindow, w.timestamps.length, resetAt, dailyMax, d.count),
    };
  }

  w.timestamps.push(now);
  const oldestAfter = Math.min(...w.timestamps);
  const resetAt = oldestAfter + windowMs;
  return {
    ok: true,
    headers: allowHeaders(maxPerWindow, w.timestamps.length, resetAt, 0, 0),
  };
}

function parseOldestScore(raw: unknown): number | undefined {
  if (raw == null) {
    return undefined;
  }
  if (Array.isArray(raw)) {
    if (raw.length >= 2) {
      const s = raw[1];
      if (typeof s === 'number') {
        return s;
      }
      if (typeof s === 'string') {
        const n = Number.parseFloat(s);
        return Number.isFinite(n) ? n : undefined;
      }
    }
    const row = raw[0];
    if (row && typeof row === 'object' && row !== null && 'score' in row) {
      const s = (row as { score?: unknown }).score;
      if (typeof s === 'number') {
        return s;
      }
      if (typeof s === 'string') {
        const n = Number.parseFloat(s);
        return Number.isFinite(n) ? n : undefined;
      }
    }
  }
  return undefined;
}

async function oldestWindowScore(r: Redis, key: string): Promise<number | undefined> {
  const first = await r.zrange(key, 0, 0, { withScores: true });
  return parseOldestScore(first);
}

async function consumeAgentApiQuotaRedis(r: Redis, userId: string): Promise<AgentQuotaResult> {
  const now = Date.now();
  const { windowMs, maxPerWindow } = windowConfig();
  const dailyMax = dailyLimit();
  const winKey = `agent:rl:${userId}`;
  const dayStr = utcDay();
  let dailyUsedAfter = 0;

  if (dailyMax > 0) {
    const dayKey = `agent:daily:${userId}:${dayStr}`;
    const raw = await r.get<string | number>(dayKey);
    const cur =
      typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw, 10) || 0 : 0;
    if (cur >= dailyMax) {
      return {
        ok: false,
        status: 429,
        body: {
          error: 'Daily assistant quota reached. Upgrade or try again tomorrow.',
          limit: dailyMax,
          used: cur,
        },
        headers: {
          'X-Agent-Quota-Daily-Limit': String(dailyMax),
          'X-Agent-Quota-Daily-Used': String(cur),
        },
      };
    }
    dailyUsedAfter = await r.incr(dayKey);
    if (dailyUsedAfter === 1) {
      await r.expire(dayKey, 172800);
    }
  }

  await r.zremrangebyscore(winKey, 0, now - windowMs);
  let count = await r.zcard(winKey);

  if (count >= maxPerWindow) {
    const oldestScore = await oldestWindowScore(r, winKey);
    const resetAt = (oldestScore ?? now) + windowMs;
    if (dailyMax > 0) {
      await r.decr(`agent:daily:${userId}:${dayStr}`);
    }
    return denyWindow(maxPerWindow, resetAt, now);
  }

  await r.zadd(winKey, { score: now, member: `${now}:${randomUUID()}` });
  await r.expire(winKey, Math.max(60, Math.ceil(windowMs / 1000) * 2));
  count += 1;

  const oldestAfter = await oldestWindowScore(r, winKey);
  const resetAt = (oldestAfter ?? now) + windowMs;

  return {
    ok: true,
    headers: allowHeaders(maxPerWindow, count, resetAt, dailyMax, dailyMax > 0 ? dailyUsedAfter : 0),
  };
}

/**
 * Atomically records one assistant request if both sliding window and optional daily cap allow it.
 */
export async function consumeAgentApiQuota(userId: string): Promise<AgentQuotaResult> {
  const r = getUpstashRedis();
  if (r) {
    try {
      return await consumeAgentApiQuotaRedis(r, userId);
    } catch (err) {
      console.warn('[agent-rate-limit] Redis error, falling back to in-memory:', err);
    }
  }
  return consumeAgentApiQuotaInMemory(userId);
}
