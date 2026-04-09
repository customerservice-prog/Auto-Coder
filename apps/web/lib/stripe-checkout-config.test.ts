import { afterEach, describe, expect, it } from 'vitest';
import {
  getAppBaseUrl,
  hasStripeCheckoutPricesConfigured,
  resolveStripePriceId,
} from '@/lib/stripe-checkout-config';

describe('getAppBaseUrl', () => {
  const orig = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (orig === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = orig;
    }
  });

  it('trims trailing slash from NEXT_PUBLIC_APP_URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/';
    expect(getAppBaseUrl()).toBe('https://example.com');
  });

  it('falls back to localhost when unset', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getAppBaseUrl()).toBe('http://localhost:3000');
  });
});

describe('resolveStripePriceId', () => {
  const pro = process.env.STRIPE_PRO_PRICE_ID;
  const team = process.env.STRIPE_TEAM_PRICE_ID;

  afterEach(() => {
    if (pro === undefined) {
      delete process.env.STRIPE_PRO_PRICE_ID;
    } else {
      process.env.STRIPE_PRO_PRICE_ID = pro;
    }
    if (team === undefined) {
      delete process.env.STRIPE_TEAM_PRICE_ID;
    } else {
      process.env.STRIPE_TEAM_PRICE_ID = team;
    }
  });

  it('prefers explicit priceId', () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_env';
    expect(resolveStripePriceId({ plan: 'pro', priceId: 'price_body' })).toBe('price_body');
  });

  it('uses env per plan', () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
    process.env.STRIPE_TEAM_PRICE_ID = 'price_team';
    expect(resolveStripePriceId({ plan: 'pro' })).toBe('price_pro');
    expect(resolveStripePriceId({ plan: 'team' })).toBe('price_team');
  });

  it('defaults to pro price when plan omitted', () => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro_only';
    expect(resolveStripePriceId({})).toBe('price_pro_only');
  });
});

describe('hasStripeCheckoutPricesConfigured', () => {
  const pro = process.env.STRIPE_PRO_PRICE_ID;
  const team = process.env.STRIPE_TEAM_PRICE_ID;

  afterEach(() => {
    if (pro === undefined) {
      delete process.env.STRIPE_PRO_PRICE_ID;
    } else {
      process.env.STRIPE_PRO_PRICE_ID = pro;
    }
    if (team === undefined) {
      delete process.env.STRIPE_TEAM_PRICE_ID;
    } else {
      process.env.STRIPE_TEAM_PRICE_ID = team;
    }
  });

  it('is false when both unset', () => {
    delete process.env.STRIPE_PRO_PRICE_ID;
    delete process.env.STRIPE_TEAM_PRICE_ID;
    expect(hasStripeCheckoutPricesConfigured()).toBe(false);
  });

  it('is true when either is set', () => {
    delete process.env.STRIPE_TEAM_PRICE_ID;
    process.env.STRIPE_PRO_PRICE_ID = 'price_x';
    expect(hasStripeCheckoutPricesConfigured()).toBe(true);
  });
});
