import type { NextRequest } from 'next/server';

/** Stripe documents a ~1MB cap on webhook payloads; stay aligned to avoid abuse. */
export const STRIPE_WEBHOOK_MAX_BYTES = 1024 * 1024;

export type CappedUtf8BodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'too_large' };

const decoder = new TextDecoder('utf-8', { fatal: false });

/**
 * Read a POST body as UTF-8 without retaining more than `maxBytes` total (streaming).
 * Returns `too_large` as soon as the running total exceeds the cap.
 */
export async function readUtf8BodyCapped(
  req: NextRequest,
  maxBytes: number
): Promise<CappedUtf8BodyResult> {
  if (!req.body) {
    return { ok: true, text: '' };
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value?.byteLength) {
        continue;
      }
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) {
    return { ok: true, text: '' };
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }

  return { ok: true, text: decoder.decode(merged) };
}
