import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  getOrCreateRequestId,
  logStripeWebhook,
  requestIdHeaders,
} from '@/lib/request-log';
import { readUtf8BodyCapped, STRIPE_WEBHOOK_MAX_BYTES } from '@/lib/read-utf8-body-capped';
import { dispatchStripeEvent } from '@/lib/stripe-webhook-dispatch';
import { claimStripeWebhookEvent } from '@/lib/stripe-webhook-idempotency';

/**
 * Stripe webhooks — signature verification, idempotent delivery (`claimStripeWebhookEvent`), and
 * `dispatchStripeEvent` (Clerk metadata, subscription entitlements, invoice snapshots).
 *
 * Dashboard: send these types to this URL — `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
 * `checkout.session.async_payment_failed`, `customer.subscription.created`, `customer.subscription.updated`,
 * `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
 *
 * Returns 200 for verified events so Stripe does not retry indefinitely. **501** if `STRIPE_WEBHOOK_SECRET` is unset.
 * Bodies larger than **`STRIPE_WEBHOOK_MAX_BYTES`** (1 MiB, Stripe's documented ceiling) return **413** without buffering the excess.
 */
export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  const rid = requestIdHeaders(requestId);

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    logStripeWebhook('warn', { event: 'webhook_unconfigured', requestId });
    return NextResponse.json(
      {
        error: 'Stripe webhooks not configured',
        requestId,
        hint: 'Set STRIPE_WEBHOOK_SECRET to your endpoint signing secret',
      },
      { status: 501, headers: rid }
    );
  }

  const apiKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!apiKey) {
    logStripeWebhook('warn', { event: 'stripe_secret_key_missing', requestId });
    return NextResponse.json(
      {
        error: 'STRIPE_SECRET_KEY is required for the Stripe client',
        requestId,
      },
      { status: 503, headers: rid }
    );
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    logStripeWebhook('warn', { event: 'missing_stripe_signature', requestId });
    return NextResponse.json(
      { error: 'Missing Stripe-Signature header', requestId },
      { status: 400, headers: rid }
    );
  }

  const raw = await readUtf8BodyCapped(req, STRIPE_WEBHOOK_MAX_BYTES);
  if (!raw.ok) {
    logStripeWebhook('warn', { event: 'webhook_body_too_large', requestId, maxBytes: STRIPE_WEBHOOK_MAX_BYTES });
    return NextResponse.json(
      { error: 'Webhook payload too large', requestId },
      { status: 413, headers: rid }
    );
  }
  const rawBody = raw.text;

  const stripe = new Stripe(apiKey, {
    typescript: true,
  });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    logStripeWebhook('warn', {
      event: 'signature_verification_failed',
      requestId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Webhook signature verification failed', requestId },
      { status: 400, headers: rid }
    );
  }

  logStripeWebhook('info', {
    event: 'stripe_event_verified',
    requestId,
    stripeEventId: event.id,
    stripeEventType: event.type,
    livemode: event.livemode,
  });

  const firstDelivery = await claimStripeWebhookEvent(event.id);
  if (!firstDelivery) {
    logStripeWebhook('info', {
      event: 'stripe_event_duplicate',
      requestId,
      stripeEventId: event.id,
      stripeEventType: event.type,
    });
    return NextResponse.json(
      {
        received: true,
        duplicate: true,
        requestId,
        stripeEventId: event.id,
        stripeEventType: event.type,
      },
      { headers: rid }
    );
  }

  const { handled, detail } = await dispatchStripeEvent(event, requestId);

  return NextResponse.json(
    {
      received: true,
      handled,
      detail,
      requestId,
      stripeEventId: event.id,
      stripeEventType: event.type,
    },
    { headers: rid }
  );
}

/** Reject non-POST (Stripe only POSTs webhooks). */
export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  const rid = requestIdHeaders(requestId);
  return NextResponse.json({ error: 'Method not allowed', requestId }, { status: 405, headers: rid });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
