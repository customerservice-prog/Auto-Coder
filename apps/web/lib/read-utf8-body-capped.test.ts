import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { readUtf8BodyCapped } from '@/lib/read-utf8-body-capped';

function postWithChunks(parts: Uint8Array[]): NextRequest {
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= parts.length) {
        controller.close();
        return;
      }
      controller.enqueue(parts[i++]!);
    },
  });
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: stream,
  });
}

describe('readUtf8BodyCapped', () => {
  it('returns empty string for empty stream', async () => {
    const req = postWithChunks([]);
    const r = await readUtf8BodyCapped(req, 100);
    expect(r).toEqual({ ok: true, text: '' });
  });

  it('decodes UTF-8 across chunks', async () => {
    const enc = new TextEncoder();
    const req = postWithChunks([enc.encode('hel'), enc.encode('lo')]);
    const r = await readUtf8BodyCapped(req, 100);
    expect(r).toEqual({ ok: true, text: 'hello' });
  });

  it('rejects when total exceeds cap', async () => {
    const req = postWithChunks([new Uint8Array(6), new Uint8Array(6)]);
    const r = await readUtf8BodyCapped(req, 10);
    expect(r).toEqual({ ok: false, reason: 'too_large' });
  });

  it('rejects a single chunk over cap', async () => {
    const req = postWithChunks([new Uint8Array(5)]);
    const r = await readUtf8BodyCapped(req, 4);
    expect(r).toEqual({ ok: false, reason: 'too_large' });
  });

  it('accepts length exactly at cap', async () => {
    const req = postWithChunks([new Uint8Array(4)]);
    const r = await readUtf8BodyCapped(req, 4);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text.length).toBe(4);
    }
  });
});
