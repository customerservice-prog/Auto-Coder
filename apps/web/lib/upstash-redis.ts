import { Redis } from '@upstash/redis';

let redisSingleton: Redis | null | undefined;

/**
 * Shared Upstash client when REST URL + token are set; otherwise `null`.
 */
export function getUpstashRedis(): Redis | null {
  if (redisSingleton !== undefined) {
    return redisSingleton;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisSingleton = null;
    return null;
  }
  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}
