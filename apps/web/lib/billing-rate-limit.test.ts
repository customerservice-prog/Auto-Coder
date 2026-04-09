import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetBillingRateLimitForTests,
  consumeBillingApiQuota,
  isBillingRateLimitEnabled,
} from '@/lib/billing-rate-limit';

const origMax = process.env.BILLING_API_MAX_PER_WINDOW;
const origMs = process.env.BILLING_API_WINDOW_MS;

describe('consumeBillingApiQuota', () => {
  afterEach(() => {
    __resetBillingRateLimitForTests();
    if (origMax === undefined) {
      delete process.env.BILLING_API_MAX_PER_WINDOW;
    } else {
      process.env.BILLING_API_MAX_PER_WINDOW = origMax;
    }
    if (origMs === undefined) {
      delete process.env.BILLING_API_WINDOW_MS;
    } else {
      process.env.BILLING_API_WINDOW_MS = origMs;
    }
  });

  it('is disabled when BILLING_API_MAX_PER_WINDOW is 0', () => {
    process.env.BILLING_API_MAX_PER_WINDOW = '0';
    for (let i = 0; i < 50; i++) {
      expect(consumeBillingApiQuota('user_1').ok).toBe(true);
    }
  });

  it('returns 429 after exceeding window', () => {
    process.env.BILLING_API_MAX_PER_WINDOW = '3';
    process.env.BILLING_API_WINDOW_MS = '60000';
    expect(consumeBillingApiQuota('user_2').ok).toBe(true);
    expect(consumeBillingApiQuota('user_2').ok).toBe(true);
    expect(consumeBillingApiQuota('user_2').ok).toBe(true);
    const denied = consumeBillingApiQuota('user_2');
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(429);
      expect(denied.headers['Retry-After']).toBeDefined();
    }
  });

  it('isolates users', () => {
    process.env.BILLING_API_MAX_PER_WINDOW = '1';
    expect(consumeBillingApiQuota('user_a').ok).toBe(true);
    expect(consumeBillingApiQuota('user_b').ok).toBe(true);
  });

  it('isBillingRateLimitEnabled follows max window', () => {
    process.env.BILLING_API_MAX_PER_WINDOW = '0';
    expect(isBillingRateLimitEnabled()).toBe(false);
    process.env.BILLING_API_MAX_PER_WINDOW = '5';
    expect(isBillingRateLimitEnabled()).toBe(true);
  });
});
