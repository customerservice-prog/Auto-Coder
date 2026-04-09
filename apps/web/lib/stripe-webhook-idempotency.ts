import { getUpstashRedis } from '@/lib/upstash-redis';

/** Align with Stripe retry horizon; keys auto-expire. */
const TTL_SEC = 72 * 3600;

const memorySeen = new Map<string, number>();
const MEM_TTL_MS = TTL_SEC * 1000;

function pruneMemory(now: number) {
  for (const [id, t] of memorySeen) {
    if (now - t > MEM_TTL_MS) {
      memorySeen.delete(id);
    }
  }
}

/**
 * @returns `true` if this worker is the first to claim this `event.id` (safe to process).
 * With Upstash: `SET NX` across instances. Without: in-memory (single instance only).
 */
export async function claimStripeWebhookEvent(eventId: string): Promise<boolean> {
  const now = Date.now();
  const r = getUpstashRedis();
  if (r) {
    try {
      const result = await r.set(`stripe:evt:${eventId}`, String(now), {
        nx: true,
        ex: TTL_SEC,
      });
      return result === 'OK';
    } catch {
      /* Redis flake: fall back to memory best-effort */
    }
  }
  pruneMemory(now);
  if (memorySeen.has(eventId)) {
    return false;
  }
  memorySeen.set(eventId, now);
  return true;
}
