import { describe, expect, it } from 'vitest';
import { formatAgentApiError } from '@/lib/agent-error-format';

function mockRes(
  partial: Partial<Pick<Response, 'status' | 'statusText' | 'headers'>> & {
    headerMap?: Record<string, string>;
  }
): Pick<Response, 'status' | 'statusText' | 'headers'> {
  const headers = new Headers(partial.headerMap);
  return {
    status: partial.status ?? 500,
    statusText: partial.statusText ?? 'Error',
    headers: partial.headers ?? headers,
  };
}

describe('formatAgentApiError', () => {
  it('adds Stripe sync hint for pro_required', () => {
    const text = formatAgentApiError(
      mockRes({ status: 403, statusText: 'Forbidden' }),
      {
        code: 'pro_required',
        error: 'An active subscription is required to use the assistant.',
        requestId: 'req_1',
      }
    );
    expect(text).toContain('Stripe to update');
    expect(text).toContain('Reference: req_1');
  });

  it('uses default copy when pro_required has empty error', () => {
    const text = formatAgentApiError(mockRes({ status: 403 }), { code: 'pro_required' });
    expect(text).toContain('An active subscription is required');
    expect(text).toContain('Stripe');
  });

  it('passes through generic errors', () => {
    expect(formatAgentApiError(mockRes({ status: 401 }), { error: 'Unauthorized' })).toBe(
      'Unauthorized'
    );
  });

  it('adds 429 retry hints from body', () => {
    const text = formatAgentApiError(mockRes({ status: 429, statusText: 'Too Many' }), {
      error: 'Slow down',
      retryAfterMs: 5000,
      limit: 10,
      used: 10,
    });
    expect(text).toContain('Slow down');
    expect(text).toContain('Retry in about 5s');
    expect(text).toContain('Daily usage: 10 / 10');
  });
});
