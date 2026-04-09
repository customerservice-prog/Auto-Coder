import { clerkClient } from '@clerk/nextjs/server';
import type Stripe from 'stripe';
import StripeSdk from 'stripe';
import {
  publicEntitlementPatchFromSubscriptionStatus,
  stripeClerkSyncEnabled,
  tierFromStripeSubscriptionStatus,
} from '@/lib/stripe-entitlements';
import { logStripeWebhook } from '@/lib/request-log';

export type StripeDispatchResult = {
  handled: boolean;
  detail: string;
};

function stripeClient(): StripeSdk | null {
  const k = process.env.STRIPE_SECRET_KEY?.trim();
  if (!k) {
    return null;
  }
  return new StripeSdk(k, { typescript: true });
}

function customerId(c: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | undefined {
  if (!c) {
    return undefined;
  }
  return typeof c === 'string' ? c : c.id;
}

function subscriptionRefId(
  sub: string | Stripe.Subscription | null | undefined
): string | undefined {
  if (!sub) {
    return undefined;
  }
  return typeof sub === 'string' ? sub : sub.id;
}

/**
 * Resolve Clerk `user_…` id from Checkout Session.
 * When creating Checkout, set `client_reference_id: userId` or `metadata.clerk_user_id`.
 */
function resolveClerkUserIdFromCheckout(session: Stripe.Checkout.Session): string | null {
  const raw =
    session.client_reference_id?.trim() ||
    session.metadata?.clerk_user_id?.trim() ||
    session.metadata?.clerkUserId?.trim();
  if (!raw || !raw.startsWith('user_')) {
    return null;
  }
  return raw;
}

/** From `subscription_data.metadata` on Checkout (see `/api/stripe/checkout`). */
function resolveClerkUserIdFromSubscription(sub: Stripe.Subscription): string | null {
  const raw = sub.metadata?.clerk_user_id?.trim() ?? sub.metadata?.clerkUserId?.trim();
  if (!raw || !raw.startsWith('user_')) {
    return null;
  }
  return raw;
}

async function mirrorClerkUserOnStripeCustomer(
  stripe: StripeSdk,
  customerId: string,
  clerkUserId: string,
  requestId: string
): Promise<void> {
  try {
    await stripe.customers.update(customerId, {
      metadata: { clerk_user_id: clerkUserId },
    });
    logStripeWebhook('info', {
      event: 'stripe_customer_metadata_clerk_linked',
      requestId,
      customerId,
      clerkUserId,
    });
  } catch (err) {
    logStripeWebhook('warn', {
      event: 'stripe_customer_metadata_failed',
      requestId,
      customerId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function clerkUserIdFromStripeCustomer(
  stripe: StripeSdk,
  customerId: string,
  requestId: string
): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    logStripeWebhook('info', {
      event: 'stripe_customer_deleted',
      requestId,
      customerId,
    });
    return null;
  }
  const raw = customer.metadata?.clerk_user_id?.trim();
  if (!raw || !raw.startsWith('user_')) {
    return null;
  }
  return raw;
}

async function checkoutSessionCompleted(
  event: Stripe.Event,
  requestId: string
): Promise<StripeDispatchResult> {
  const session = event.data.object as Stripe.Checkout.Session;
  const cust = customerId(session.customer);
  logStripeWebhook('info', {
    event: 'stripe_checkout_session_completed',
    requestId,
    stripeEventType: event.type,
    stripeEventId: event.id,
    sessionId: session.id,
    mode: session.mode,
    customerId: cust,
    paymentStatus: session.payment_status,
  });

  if (!stripeClerkSyncEnabled()) {
    return { handled: false, detail: 'clerk_sync_disabled' };
  }

  const clerkUserId = resolveClerkUserIdFromCheckout(session);
  if (!clerkUserId) {
    logStripeWebhook('info', {
      event: 'stripe_checkout_no_clerk_user',
      requestId,
      sessionId: session.id,
      hint: 'Set client_reference_id or metadata.clerk_user_id to the Clerk user id',
    });
    return { handled: false, detail: 'no_clerk_user' };
  }

  if (!cust) {
    logStripeWebhook('warn', {
      event: 'stripe_checkout_no_customer',
      requestId,
      sessionId: session.id,
    });
    return { handled: false, detail: 'no_stripe_customer' };
  }

  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(clerkUserId, {
      privateMetadata: {
        stripeCustomerId: cust,
        stripeCheckoutSessionId: session.id,
        stripeCheckoutCompletedAt: new Date().toISOString(),
      },
    });
    logStripeWebhook('info', {
      event: 'stripe_clerk_private_metadata_updated',
      requestId,
      clerkUserId,
      stripeCustomerId: cust,
      sessionId: session.id,
    });

    const stripe = stripeClient();
    if (stripe) {
      await mirrorClerkUserOnStripeCustomer(stripe, cust, clerkUserId, requestId);
    }

    return { handled: true, detail: 'clerk_stripe_linked' };
  } catch (err) {
    logStripeWebhook('error', {
      event: 'stripe_clerk_sync_failed',
      requestId,
      clerkUserId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { handled: false, detail: 'clerk_sync_failed' };
  }
}

async function checkoutSessionAsyncPaymentFailed(
  event: Stripe.Event,
  requestId: string
): Promise<StripeDispatchResult> {
  const session = event.data.object as Stripe.Checkout.Session;
  logStripeWebhook('warn', {
    event: 'stripe_checkout_async_payment_failed',
    requestId,
    stripeEventType: event.type,
    stripeEventId: event.id,
    sessionId: session.id,
    mode: session.mode,
    customerId: customerId(session.customer),
    paymentStatus: session.payment_status,
  });
  return { handled: false, detail: 'async_payment_failed_logged' };
}

async function subscriptionLifecycle(
  event: Stripe.Event,
  requestId: string
): Promise<StripeDispatchResult> {
  const sub = event.data.object as Stripe.Subscription;
  const cust = customerId(sub.customer);
  logStripeWebhook('info', {
    event: 'stripe_subscription_lifecycle',
    requestId,
    stripeEventId: event.id,
    stripeEventType: event.type,
    subscriptionId: sub.id,
    status: sub.status,
    customerId: cust,
  });

  if (!stripeClerkSyncEnabled() || !cust) {
    return { handled: false, detail: cust ? 'clerk_sync_disabled' : 'no_stripe_customer' };
  }

  const stripe = stripeClient();
  if (!stripe) {
    return { handled: false, detail: 'no_stripe_client' };
  }

  let clerkUserId: string | null;
  try {
    clerkUserId = await clerkUserIdFromStripeCustomer(stripe, cust, requestId);
  } catch (err) {
    logStripeWebhook('error', {
      event: 'stripe_customer_lookup_failed',
      requestId,
      customerId: cust,
      message: err instanceof Error ? err.message : String(err),
    });
    return { handled: false, detail: 'customer_lookup_failed' };
  }

  if (!clerkUserId) {
    const fromSub = resolveClerkUserIdFromSubscription(sub);
    if (fromSub) {
      clerkUserId = fromSub;
      logStripeWebhook('info', {
        event: 'stripe_subscription_clerk_from_subscription_metadata',
        requestId,
        customerId: cust,
        subscriptionId: sub.id,
      });
      await mirrorClerkUserOnStripeCustomer(stripe, cust, clerkUserId, requestId);
    }
  }

  if (!clerkUserId) {
    logStripeWebhook('info', {
      event: 'stripe_subscription_no_clerk_user',
      requestId,
      customerId: cust,
      hint: 'Complete checkout with sync first, or set customer.metadata.clerk_user_id / subscription.metadata.clerk_user_id',
    });
    return { handled: false, detail: 'no_clerk_user' };
  }

  try {
    const clerk = await clerkClient();
    const entitlementPublic = publicEntitlementPatchFromSubscriptionStatus(sub.status);
    await clerk.users.updateUserMetadata(clerkUserId, {
      privateMetadata: {
        stripeSubscriptionId: sub.id,
        stripeSubscriptionStatus: sub.status,
        stripeSubscriptionEvent: event.type,
        stripeSubscriptionUpdatedAt: new Date().toISOString(),
      },
      publicMetadata: entitlementPublic,
    });
    logStripeWebhook('info', {
      event: 'stripe_clerk_subscription_metadata_updated',
      requestId,
      clerkUserId,
      subscriptionId: sub.id,
      status: sub.status,
      stripeEntitlementTier: tierFromStripeSubscriptionStatus(sub.status),
    });
    return { handled: true, detail: 'clerk_subscription_synced' };
  } catch (err) {
    logStripeWebhook('error', {
      event: 'stripe_clerk_subscription_sync_failed',
      requestId,
      clerkUserId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { handled: false, detail: 'clerk_sync_failed' };
  }
}

async function invoiceLifecycle(
  event: Stripe.Event,
  requestId: string
): Promise<StripeDispatchResult> {
  const inv = event.data.object as Stripe.Invoice;
  const cust = customerId(inv.customer);
  logStripeWebhook('info', {
    event: 'stripe_invoice',
    requestId,
    stripeEventId: event.id,
    invoiceId: inv.id,
    billingReason: inv.billing_reason,
    customerId: cust,
    amountDue: inv.amount_due,
    amountPaid: inv.amount_paid,
    status: inv.status,
    stripeEventType: event.type,
  });

  if (!stripeClerkSyncEnabled() || !cust) {
    return { handled: false, detail: cust ? 'clerk_sync_disabled' : 'no_stripe_customer' };
  }

  const stripe = stripeClient();
  if (!stripe) {
    return { handled: false, detail: 'no_stripe_client' };
  }

  let clerkUserId: string | null;
  try {
    clerkUserId = await clerkUserIdFromStripeCustomer(stripe, cust, requestId);
  } catch (err) {
    logStripeWebhook('error', {
      event: 'stripe_invoice_customer_lookup_failed',
      requestId,
      customerId: cust,
      message: err instanceof Error ? err.message : String(err),
    });
    return { handled: false, detail: 'customer_lookup_failed' };
  }

  if (!clerkUserId) {
    logStripeWebhook('info', {
      event: 'stripe_invoice_no_clerk_user',
      requestId,
      customerId: cust,
      hint: 'Complete checkout with sync first, or set customer.metadata.clerk_user_id',
    });
    return { handled: false, detail: 'no_clerk_user' };
  }

  const subId = subscriptionRefId(inv.subscription);

  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(clerkUserId, {
      privateMetadata: {
        stripeLastInvoiceId: inv.id,
        stripeLastInvoiceStatus: inv.status ?? null,
        stripeLastInvoiceEvent: event.type,
        stripeLastInvoiceBillingReason: inv.billing_reason ?? null,
        stripeLastInvoiceAmountDue: inv.amount_due,
        stripeLastInvoiceAmountPaid: inv.amount_paid,
        stripeLastInvoiceCurrency: inv.currency ?? null,
        stripeLastInvoiceSubscriptionId: subId ?? null,
        stripeLastInvoiceUpdatedAt: new Date().toISOString(),
      },
    });
    logStripeWebhook('info', {
      event: 'stripe_clerk_invoice_metadata_updated',
      requestId,
      clerkUserId,
      invoiceId: inv.id,
      status: inv.status,
      stripeEventType: event.type,
    });
    return { handled: true, detail: 'clerk_invoice_synced' };
  } catch (err) {
    logStripeWebhook('error', {
      event: 'stripe_clerk_invoice_sync_failed',
      requestId,
      clerkUserId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { handled: false, detail: 'clerk_sync_failed' };
  }
}

/**
 * Route verified Stripe events — extend with entitlements, invoice-driven access, etc.
 */
export async function dispatchStripeEvent(
  event: Stripe.Event,
  requestId: string
): Promise<StripeDispatchResult> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return checkoutSessionCompleted(event, requestId);
    case 'checkout.session.async_payment_failed':
      return checkoutSessionAsyncPaymentFailed(event, requestId);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return subscriptionLifecycle(event, requestId);
    case 'invoice.paid':
    case 'invoice.payment_failed':
      return invoiceLifecycle(event, requestId);
    default:
      logStripeWebhook('info', {
        event: 'stripe_event_unhandled',
        requestId,
        stripeEventId: event.id,
        stripeEventType: event.type,
      });
      return { handled: false, detail: 'unhandled' };
  }
}
