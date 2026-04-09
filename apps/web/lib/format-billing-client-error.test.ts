import { describe, expect, it } from 'vitest';
import { formatBillingClientAlert } from '@/lib/format-billing-client-error';

function mockResponse(
  status: number,
  headers: Record<string, string> = {}
): Pick<Response, 'status' | 'headers'> {
  return {
    status,
    headers: new Headers(headers),
  };
}

describe('formatBillingClientAlert', () => {
  it('uses server error string when present', () => {
    const msg = formatBillingClientAlert(mockResponse(400), {
      error: 'No Stripe Price id',
      requestId: 'rid-1',
    });
    expect(msg).toBe('No Stripe Price id Reference: rid-1.');
  });

  it('falls back to status when body has no error', () => {
    expect(formatBillingClientAlert(mockResponse(503), null)).toBe('Request failed (503).');
  });

  it('appends requestId when only that is present', () => {
    const msg = formatBillingClientAlert(mockResponse(502), { requestId: 'abc' });
    expect(msg).toBe('Request failed (502). Reference: abc.');
  });

  it('413 payload too large', () => {
    const msg = formatBillingClientAlert(mockResponse(413), {
      error: 'Request body too large',
      requestId: 'rid-big',
    });
    expect(msg).toBe('Request body too large Reference: rid-big.');
  });

  it('ignores blank requestId', () => {
    const msg = formatBillingClientAlert(mockResponse(400), {
      error: 'Bad',
      requestId: '   ',
    });
    expect(msg).toBe('Bad');
  });

  it('429: prefers Retry-After header seconds', () => {
    const msg = formatBillingClientAlert(mockResponse(429, { 'Retry-After': '42' }), {
      error: 'Too many billing requests. Try again shortly.',
      retryAfterMs: 999_000,
      requestId: 'rid-retry',
    });
    expect(msg).toContain('Try again in about 42s');
    expect(msg).toContain('Reference: rid-retry');
  });

  it('429: uses retryAfterMs from body when header missing', () => {
    const msg = formatBillingClientAlert(mockResponse(429), {
      error: 'Rate limited',
      retryAfterMs: 5000,
    });
    expect(msg).toContain('Try again in about 5s');
  });

  it('429: omits timer hint when retry unknown', () => {
    const msg = formatBillingClientAlert(mockResponse(429), { error: 'Slow down' });
    expect(msg).toBe('Slow down');
    expect(msg).not.toContain('Try again in');
  });
});
