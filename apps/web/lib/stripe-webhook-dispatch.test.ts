import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  logStripeWebhook: vi.fn(),
  updateUserMetadata: vi.fn(),
  customersRetrieve: vi.fn(),
  customersUpdate: vi.fn(),
  StripeConstructor: vi.fn(),
}));

vi.mock('@/lib/request-log', () => ({
  logStripeWebhook: hoisted.logStripeWebhook,
}));

vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: vi.fn(async () => ({
    users: { updateUserMetadata: hoisted.updateUserMetadata },
  })),
}));

vi.mock('stripe', () => ({
  default: hoisted.StripeConstructor,
}));

import { dispatchStripeEvent } from '@/lib/stripe-webhook-dispatch';

/** Minimal event shape for tests (avoids constructing full Stripe.Event objects). */
function asStripeEvent(payload: {
  id: string;
  type: string;
  livemode?: boolean;
  data: { object: Record<string, unknown> };
}): Parameters<typeof dispatchStripeEvent>[0] {
  return payload as Parameters<typeof dispatchStripeEvent>[0];
}

describe('dispatchStripeEvent', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.STRIPE_SYNC_CLERK_METADATA = '1';
    hoisted.StripeConstructor.mockImplementation(() => ({
      customers: {
        retrieve: hoisted.customersRetrieve,
        update: hoisted.customersUpdate,
      },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SYNC_CLERK_METADATA;
  });

  it('returns unhandled for unknown event types', async () => {
    const r = await dispatchStripeEvent(
      asStripeEvent({
        id: 'evt_1',
        type: 'charge.succeeded',
        data: { object: {} },
      }),
      'req-1'
    );
    expect(r).toEqual({ handled: false, detail: 'unhandled' });
  });

  it('logs async checkout payment failure and does not call Clerk', async () => {
    const r = await dispatchStripeEvent(
      asStripeEvent({
        id: 'evt_fail',
        type: 'checkout.session.async_payment_failed',
        data: {
          object: {
            id: 'cs_fail',
            mode: 'subscription',
            customer: 'cus_x',
            payment_status: 'unpaid',
          },
        },
      }),
      'req-1'
    );
    expect(r).toEqual({ handled: false, detail: 'async_payment_failed_logged' });
    expect(hoisted.updateUserMetadata).not.toHaveBeenCalled();
  });

  it('checkout.session.completed: no Clerk id on session skips sync', async () => {
    const r = await dispatchStripeEvent(
      asStripeEvent({
        id: 'evt_co',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_1',
            mode: 'subscription',
            customer: 'cus_1',
            payment_status: 'paid',
            client_reference_id: null,
            metadata: {},
          },
        },
      }),
      'req-1'
    );
    expect(r.detail).toBe('no_clerk_user');
    expect(hoisted.updateUserMetadata).not.toHaveBeenCalled();
  });

  it('checkout.session.async_payment_succeeded: links Clerk user and mirrors metadata on customer', async () => {
    hoisted.updateUserMetadata.mockResolvedValue(undefined);
    hoisted.customersUpdate.mockResolvedValue({});

    const r = await dispatchStripeEvent(
      asStripeEvent({
        id: 'evt_async_ok',
        type: 'checkout.session.async_payment_succeeded',
        data: {
          object: {
            id: 'cs_2',
            mode: 'subscription',
            customer: 'cus_2',
            payment_status: 'paid',
            client_reference_id: 'user_async_ok',
            metadata: {},
          },
        },
      }),
      'req-1'
    );

    expect(r).toEqual({ handled: true, detail: 'clerk_stripe_linked' });
    expect(hoisted.updateUserMetadata).toHaveBeenCalledWith(
      'user_async_ok',
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          stripeCustomerId: 'cus_2',
          stripeCheckoutSessionId: 'cs_2',
        }),
      })
    );
    expect(hoisted.customersUpdate).toHaveBeenCalledWith('cus_2', {
      metadata: { clerk_user_id: 'user_async_ok' },
    });
  });

  it('respects STRIPE_SYNC_CLERK_METADATA=0 for checkout', async () => {
    process.env.STRIPE_SYNC_CLERK_METADATA = '0';

    const r = await dispatchStripeEvent(
      asStripeEvent({
        id: 'evt_off',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_3',
            mode: 'subscription',
            customer: 'cus_3',
            payment_status: 'paid',
            client_reference_id: 'user_off',
            metadata: {},
          },
        },
      }),
      'req-1'
    );

    expect(r.detail).toBe('clerk_sync_disabled');
    expect(hoisted.updateUserMetadata).not.toHaveBeenCalled();
  });

  it('subscription.updated: resolves Clerk user from customer metadata', async () => {
    hoisted.customersRetrieve.mockResolvedValue({
      deleted: false,
      metadata: { clerk_user_id: 'user_sub_meta' },
    });
    hoisted.updateUserMetadata.mockResolvedValue(undefined);

    const r = await dispatchStripeEvent(
      asStripeEvent({
        id: 'evt_sub',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_1',
            status: 'active',
            customer: 'cus_10',
            metadata: {},
          },
        },
      }),
      'req-1'
    );

    expect(r).toEqual({ handled: true, detail: 'clerk_subscription_synced' });
    expect(hoisted.customersUpdate).not.toHaveBeenCalled();
    expect(hoisted.updateUserMetadata).toHaveBeenCalledWith(
      'user_sub_meta',
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          stripeSubscriptionId: 'sub_1',
          stripeSubscriptionStatus: 'active',
        }),
        publicMetadata: expect.any(Object),
      })
    );
  });

  it('subscription.created: falls back to subscription metadata and mirrors customer', async () => {
    hoisted.customersRetrieve.mockResolvedValue({
      deleted: false,
      metadata: {},
    });
    hoisted.customersUpdate.mockResolvedValue({});
    hoisted.updateUserMetadata.mockResolvedValue(undefined);

    const r = await dispatchStripeEvent(
      asStripeEvent({
        id: 'evt_sub_create',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_2',
            status: 'active',
            customer: 'cus_11',
            metadata: { clerk_user_id: 'user_from_sub' },
          },
        },
      }),
      'req-1'
    );

    expect(r).toEqual({ handled: true, detail: 'clerk_subscription_synced' });
    expect(hoisted.customersUpdate).toHaveBeenCalledWith('cus_11', {
      metadata: { clerk_user_id: 'user_from_sub' },
    });
  });

  it('invoice.paid: writes invoice snapshot to Clerk', async () => {
    hoisted.customersRetrieve.mockResolvedValue({
      deleted: false,
      metadata: { clerk_user_id: 'user_inv' },
    });
    hoisted.updateUserMetadata.mockResolvedValue(undefined);

    const r = await dispatchStripeEvent(
      asStripeEvent({
        id: 'evt_inv',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_1',
            customer: 'cus_inv',
            subscription: 'sub_inv',
            billing_reason: 'subscription_cycle',
            amount_due: 0,
            amount_paid: 1000,
            status: 'paid',
            currency: 'usd',
          },
        },
      }),
      'req-1'
    );

    expect(r).toEqual({ handled: true, detail: 'clerk_invoice_synced' });
    expect(hoisted.updateUserMetadata).toHaveBeenCalledWith(
      'user_inv',
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          stripeLastInvoiceId: 'in_1',
          stripeLastInvoiceSubscriptionId: 'sub_inv',
        }),
      })
    );
  });
});
