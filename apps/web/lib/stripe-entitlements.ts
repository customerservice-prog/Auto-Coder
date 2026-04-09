/**
 * Maps Stripe Billing subscription status → a coarse app tier on Clerk publicMetadata.
 * publicMetadata is readable in the browser; keep Stripe ids in privateMetadata only.
 */

export const STRIPE_ENTITLEMENT_TIER_KEY = 'stripeEntitlementTier' as const;
export const STRIPE_ENTITLEMENT_UPDATED_AT_KEY = 'stripeEntitlementUpdatedAt' as const;

export type StripeEntitlementTier = 'free' | 'pro';

/**
 * Statuses where the customer should retain product access (incl. dunning / past_due).
 * @see https://docs.stripe.com/api/subscriptions/object#subscription_object-status
 */
const PRO_SUBSCRIPTION_STATUSES = new Set<string>(['active', 'trialing', 'past_due']);

export function tierFromStripeSubscriptionStatus(
  status: string | null | undefined
): StripeEntitlementTier {
  if (status && PRO_SUBSCRIPTION_STATUSES.has(status)) {
    return 'pro';
  }
  return 'free';
}

export function normalizeEntitlementTier(value: unknown): StripeEntitlementTier {
  return value === 'pro' ? 'pro' : 'free';
}

export function publicEntitlementPatchFromSubscriptionStatus(
  status: string | null | undefined
): Record<string, string> {
  const tier = tierFromStripeSubscriptionStatus(status);
  const now = new Date().toISOString();
  return {
    [STRIPE_ENTITLEMENT_TIER_KEY]: tier,
    [STRIPE_ENTITLEMENT_UPDATED_AT_KEY]: now,
  };
}

export function agentApiRequiresPro(): boolean {
  const v = process.env.AGENT_API_REQUIRES_PRO?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Mirrors webhook handlers: Stripe → Clerk metadata sync is on unless explicitly disabled. */
export function stripeClerkSyncEnabled(): boolean {
  const v = process.env.STRIPE_SYNC_CLERK_METADATA?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') {
    return false;
  }
  return true;
}
