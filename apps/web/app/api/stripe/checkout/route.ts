import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { z } from 'zod';
import {
  STRIPE_CHECKOUT_POST_MAX_BYTES,
  STRIPE_PRICE_ID_MAX_CHARS,
} from '@/lib/billing-api-limits';
import { isClerkEnabled } from '@/lib/clerk-enabled';
import { consumeBillingApiQuota } from '@/lib/billing-rate-limit';
import { readUtf8BodyCapped } from '@/lib/read-utf8-body-capped';
import { getAppBaseUrl, resolveStripePriceId } from '@/lib/stripe-checkout-config';
import {
  getOrCreateRequestId,
  logBillingApi,
  requestIdHeaders,
} from '@/lib/request-log';

const BodySchema = z
  .object({
    plan: z.enum(['pro', 'team']).optional(),
    priceId: z.string().min(3).max(STRIPE_PRICE_ID_MAX_CHARS).optional(),
  })
  .strict();

function checkoutAutomaticTaxEnabled(): boolean {
  const v = process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Creates a hosted Stripe Checkout Session (subscription). Requires Clerk.
 * Sets `client_reference_id` and `metadata.clerk_user_id` for webhook linking.
 * Bodies over **`STRIPE_CHECKOUT_POST_MAX_BYTES`** return **413**.
 */
export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  const rid = requestIdHeaders(requestId);

  const capped = await readUtf8BodyCapped(req, STRIPE_CHECKOUT_POST_MAX_BYTES);
  if (!capped.ok) {
    logBillingApi('warn', {
      event: 'checkout_body_too_large',
      requestId,
      maxBytes: STRIPE_CHECKOUT_POST_MAX_BYTES,
    });
    return NextResponse.json(
      { error: 'Request body too large', requestId },
      { status: 413, headers: rid }
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = capped.text.trim() === '' ? {} : JSON.parse(capped.text);
  } catch {
    parsedJson = {};
  }

  if (!isClerkEnabled()) {
    logBillingApi('warn', { event: 'checkout_clerk_disabled', requestId });
    return NextResponse.json(
      { error: 'Billing requires Clerk to be configured', requestId },
      { status: 503, headers: rid }
    );
  }

  const { userId } = await auth();
  if (!userId) {
    logBillingApi('warn', { event: 'checkout_unauthorized', requestId });
    return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401, headers: rid });
  }

  const billingQuota = consumeBillingApiQuota(userId);
  if (!billingQuota.ok) {
    logBillingApi('warn', { event: 'checkout_rate_limited', requestId, userId });
    return NextResponse.json(
      { ...billingQuota.body, requestId },
      { status: 429, headers: { ...rid, ...billingQuota.headers } }
    );
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    logBillingApi('warn', { event: 'checkout_stripe_secret_missing', requestId });
    return NextResponse.json(
      { error: 'STRIPE_SECRET_KEY is not configured', requestId },
      { status: 503, headers: rid }
    );
  }

  const parsed = BodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', requestId, issues: parsed.error.flatten() },
      { status: 400, headers: rid }
    );
  }

  const priceId = resolveStripePriceId({
    plan: parsed.data.plan,
    priceId: parsed.data.priceId,
  });

  if (!priceId) {
    return NextResponse.json(
      {
        error:
          'No Stripe Price id — set STRIPE_PRO_PRICE_ID (or STRIPE_TEAM_PRICE_ID / pass priceId)',
        requestId,
      },
      { status: 400, headers: rid }
    );
  }

  const base = getAppBaseUrl();

  let customerEmail: string | undefined;
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const primaryId = user.primaryEmailAddressId;
    const addr = primaryId
      ? user.emailAddresses.find((e) => e.id === primaryId)
      : user.emailAddresses[0];
    const emailStr = addr?.emailAddress?.trim();
    if (emailStr) {
      customerEmail = emailStr;
    }
  } catch (err) {
    logBillingApi('warn', {
      event: 'checkout_clerk_email_lookup_failed',
      requestId,
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const stripe = new Stripe(secret, { typescript: true });
    /** 30s buckets: double-submit / rapid retries reuse the same Checkout session (Stripe idempotency window is 24h). */
    const idempotencySlot = Math.floor(Date.now() / 30000);
    const idempotencyKey = `checkout_${userId}_${priceId}_${idempotencySlot}`.slice(0, 255);

    const automaticTax = checkoutAutomaticTaxEnabled();
    if (automaticTax) {
      logBillingApi('info', {
        event: 'checkout_automatic_tax_enabled',
        requestId,
        userId,
      });
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${base}/dashboard?checkout=success`,
        cancel_url: `${base}/?checkout=canceled`,
        client_reference_id: userId,
        metadata: { clerk_user_id: userId },
        subscription_data: {
          metadata: { clerk_user_id: userId },
        },
        allow_promotion_codes: true,
        ...(customerEmail ? { customer_email: customerEmail } : {}),
        ...(automaticTax
          ? {
              automatic_tax: { enabled: true },
              billing_address_collection: 'required',
              tax_id_collection: { enabled: true },
            }
          : {}),
      },
      { idempotencyKey }
    );

    if (!session.url) {
      logBillingApi('error', {
        event: 'checkout_no_url',
        requestId,
        userId,
        sessionId: session.id,
      });
      return NextResponse.json(
        { error: 'Checkout session missing redirect URL', requestId },
        { status: 500, headers: rid }
      );
    }

    logBillingApi('info', {
      event: 'checkout_session_created',
      requestId,
      userId,
      plan: parsed.data.plan ?? 'pro',
      sessionId: session.id,
    });

    return NextResponse.json(
      { url: session.url, sessionId: session.id, requestId },
      { headers: { ...rid, ...billingQuota.headers } }
    );
  } catch (err) {
    logBillingApi('error', {
      event: 'checkout_stripe_error',
      requestId,
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Could not start checkout', requestId },
      { status: 502, headers: rid }
    );
  }
}

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  const rid = requestIdHeaders(requestId);
  return NextResponse.json({ error: 'Method not allowed', requestId }, { status: 405, headers: rid });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
