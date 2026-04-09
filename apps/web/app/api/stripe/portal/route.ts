import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { STRIPE_PORTAL_POST_MAX_BYTES } from '@/lib/billing-api-limits';
import { isClerkEnabled } from '@/lib/clerk-enabled';
import { consumeBillingApiQuota } from '@/lib/billing-rate-limit';
import { getAppBaseUrl } from '@/lib/stripe-checkout-config';
import { readUtf8BodyCapped } from '@/lib/read-utf8-body-capped';
import {
  getOrCreateRequestId,
  logBillingApi,
  requestIdHeaders,
} from '@/lib/request-log';

function stripeCustomerIdFromClerkPrivate(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object') {
    return undefined;
  }
  const id = (meta as { stripeCustomerId?: unknown }).stripeCustomerId;
  if (typeof id !== 'string' || !id.startsWith('cus_')) {
    return undefined;
  }
  return id;
}

/**
 * Stripe Customer Portal — requires Clerk user with `privateMetadata.stripeCustomerId` (set after Checkout webhook).
 * Drains POST bodies over **`STRIPE_PORTAL_POST_MAX_BYTES`** with **413** (no body is required).
 */
export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  const rid = requestIdHeaders(requestId);

  const capped = await readUtf8BodyCapped(req, STRIPE_PORTAL_POST_MAX_BYTES);
  if (!capped.ok) {
    logBillingApi('warn', {
      event: 'portal_body_too_large',
      requestId,
      maxBytes: STRIPE_PORTAL_POST_MAX_BYTES,
    });
    return NextResponse.json(
      { error: 'Request body too large', requestId },
      { status: 413, headers: rid }
    );
  }

  if (!isClerkEnabled()) {
    logBillingApi('warn', { event: 'portal_clerk_disabled', requestId });
    return NextResponse.json(
      { error: 'Billing requires Clerk to be configured', requestId },
      { status: 503, headers: rid }
    );
  }

  const { userId } = await auth();
  if (!userId) {
    logBillingApi('warn', { event: 'portal_unauthorized', requestId });
    return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401, headers: rid });
  }

  const billingQuota = consumeBillingApiQuota(userId);
  if (!billingQuota.ok) {
    logBillingApi('warn', { event: 'portal_rate_limited', requestId, userId });
    return NextResponse.json(
      { ...billingQuota.body, requestId },
      { status: 429, headers: { ...rid, ...billingQuota.headers } }
    );
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    logBillingApi('warn', { event: 'portal_stripe_secret_missing', requestId });
    return NextResponse.json(
      { error: 'STRIPE_SECRET_KEY is not configured', requestId },
      { status: 503, headers: rid }
    );
  }

  let customerId: string | undefined;
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    customerId = stripeCustomerIdFromClerkPrivate(user.privateMetadata);
  } catch (err) {
    logBillingApi('error', {
      event: 'portal_clerk_lookup_failed',
      requestId,
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Could not load account', requestId },
      { status: 503, headers: rid }
    );
  }

  if (!customerId) {
    logBillingApi('info', { event: 'portal_no_stripe_customer', requestId, userId });
    return NextResponse.json(
      {
        error:
          'No Stripe customer on file yet. Complete a subscription checkout first, then wait a few seconds for webhooks.',
        requestId,
        code: 'no_stripe_customer',
      },
      { status: 400, headers: rid }
    );
  }

  const base = getAppBaseUrl();

  try {
    const stripe = new Stripe(secret, { typescript: true });
    const portalSlot = Math.floor(Date.now() / 30000);
    const idempotencyKey = `portal_${userId}_${customerId}_${portalSlot}`.slice(0, 255);

    const session = await stripe.billingPortal.sessions.create(
      {
        customer: customerId,
        return_url: `${base}/dashboard`,
      },
      { idempotencyKey }
    );

    logBillingApi('info', {
      event: 'portal_session_created',
      requestId,
      userId,
      stripeCustomerId: customerId,
    });

    return NextResponse.json(
      { url: session.url, requestId },
      { headers: { ...rid, ...billingQuota.headers } }
    );
  } catch (err) {
    logBillingApi('error', {
      event: 'portal_stripe_error',
      requestId,
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Could not open billing portal', requestId },
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
