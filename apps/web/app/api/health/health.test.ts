import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns ok payload without checks by default', async () => {
    const res = await GET(new NextRequest('http://localhost/api/health'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('auto-coder-web');
    expect(typeof body.time).toBe('string');
    expect(body.checks).toBeUndefined();
  });

  it('echoes incoming x-request-id when present', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/health', {
        headers: { 'x-request-id': 'edge-probe-1' },
      })
    );
    expect(res.headers.get('X-Request-Id')).toBe('edge-probe-1');
  });

  it('includes checks when checks=1', async () => {
    const res = await GET(new NextRequest('http://localhost/api/health?checks=1'));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
    const body = await res.json();
    expect(body.checks).toEqual(
      expect.objectContaining({
        clerk: expect.any(Boolean),
        clerkSecret: expect.any(Boolean),
        publicAppUrl: expect.any(Boolean),
        stripeWebhook: expect.any(Boolean),
        stripeApi: expect.any(Boolean),
        stripeCheckoutPrices: expect.any(Boolean),
        stripeClerkSync: expect.any(Boolean),
        billingRateLimit: expect.any(Boolean),
        agentRequiresPro: expect.any(Boolean),
        agentLlmKeys: expect.any(Boolean),
        agentUpstash: expect.any(Boolean),
      })
    );
  });
});
