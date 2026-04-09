/**
 * Shared helpers for creating Stripe Checkout Sessions from the web app.
 */

export type CheckoutPlanKey = 'pro' | 'team';

export function getAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}

/**
 * Resolves a Stripe Price id from explicit body or env (`STRIPE_PRO_PRICE_ID` / `STRIPE_TEAM_PRICE_ID`).
 */
/** At least one hosted-checkout price id is set (Pro or Team). */
export function hasStripeCheckoutPricesConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_PRO_PRICE_ID?.trim() || process.env.STRIPE_TEAM_PRICE_ID?.trim()
  );
}

export function resolveStripePriceId(opts: {
  plan?: CheckoutPlanKey;
  priceId?: string;
}): string | undefined {
  const explicit = opts.priceId?.trim();
  if (explicit) {
    return explicit;
  }
  if (opts.plan === 'team') {
    const id = process.env.STRIPE_TEAM_PRICE_ID?.trim();
    return id || undefined;
  }
  const id = process.env.STRIPE_PRO_PRICE_ID?.trim();
  return id || undefined;
}
