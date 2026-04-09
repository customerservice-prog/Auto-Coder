import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STRIPE_ENTITLEMENT_TIER_KEY,
  STRIPE_ENTITLEMENT_UPDATED_AT_KEY,
  agentApiRequiresPro,
  normalizeEntitlementTier,
  publicEntitlementPatchFromSubscriptionStatus,
  stripeClerkSyncEnabled,
  tierFromStripeSubscriptionStatus,
} from '@/lib/stripe-entitlements';

describe('tierFromStripeSubscriptionStatus', () => {
  it.each(['active', 'trialing', 'past_due'] as const)('maps %s to pro', (status) => {
    expect(tierFromStripeSubscriptionStatus(status)).toBe('pro');
  });

  it.each(['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'] as const)(
    'maps %s to free',
    (status) => {
      expect(tierFromStripeSubscriptionStatus(status)).toBe('free');
    }
  );

  it('maps undefined / empty to free', () => {
    expect(tierFromStripeSubscriptionStatus(undefined)).toBe('free');
    expect(tierFromStripeSubscriptionStatus(null)).toBe('free');
    expect(tierFromStripeSubscriptionStatus('')).toBe('free');
  });
});

describe('normalizeEntitlementTier', () => {
  it('accepts only exact pro', () => {
    expect(normalizeEntitlementTier('pro')).toBe('pro');
    expect(normalizeEntitlementTier('free')).toBe('free');
    expect(normalizeEntitlementTier(undefined)).toBe('free');
    expect(normalizeEntitlementTier('Pro')).toBe('free');
  });
});

describe('publicEntitlementPatchFromSubscriptionStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-07T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('includes tier and timestamp keys', () => {
    const patch = publicEntitlementPatchFromSubscriptionStatus('active');
    expect(patch[STRIPE_ENTITLEMENT_TIER_KEY]).toBe('pro');
    expect(patch[STRIPE_ENTITLEMENT_UPDATED_AT_KEY]).toBe('2026-04-07T12:00:00.000Z');
  });

  it('uses free tier for canceled', () => {
    const patch = publicEntitlementPatchFromSubscriptionStatus('canceled');
    expect(patch[STRIPE_ENTITLEMENT_TIER_KEY]).toBe('free');
  });
});

describe('agentApiRequiresPro', () => {
  const original = process.env.AGENT_API_REQUIRES_PRO;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.AGENT_API_REQUIRES_PRO;
    } else {
      process.env.AGENT_API_REQUIRES_PRO = original;
    }
  });

  it('is false when unset', () => {
    delete process.env.AGENT_API_REQUIRES_PRO;
    expect(agentApiRequiresPro()).toBe(false);
  });

  it.each(['1', 'true', 'yes', 'TRUE', ' Yes '])('is true for %j', (v) => {
    process.env.AGENT_API_REQUIRES_PRO = v;
    expect(agentApiRequiresPro()).toBe(true);
  });
});

describe('stripeClerkSyncEnabled', () => {
  const original = process.env.STRIPE_SYNC_CLERK_METADATA;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.STRIPE_SYNC_CLERK_METADATA;
    } else {
      process.env.STRIPE_SYNC_CLERK_METADATA = original;
    }
  });

  it('is true when unset', () => {
    delete process.env.STRIPE_SYNC_CLERK_METADATA;
    expect(stripeClerkSyncEnabled()).toBe(true);
  });

  it.each(['0', 'false', 'no', 'NO', ' False '])('is false for %j', (v) => {
    process.env.STRIPE_SYNC_CLERK_METADATA = v;
    expect(stripeClerkSyncEnabled()).toBe(false);
  });
});
