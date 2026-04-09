import { type NextRequest, NextResponse } from 'next/server';
import { hasAgentLlmApiKeysConfigured } from '@/lib/agent-llm-env';
import { isBillingRateLimitEnabled } from '@/lib/billing-rate-limit';
import { getOrCreateRequestId, requestIdHeaders } from '@/lib/request-log';
import { hasStripeCheckoutPricesConfigured } from '@/lib/stripe-checkout-config';
import { agentApiRequiresPro, stripeClerkSyncEnabled } from '@/lib/stripe-entitlements';

/**
 * Liveness for load balancers and deploy pipelines. No auth, no secrets.
 * Uses **`requestIdHeaders`** ( **`X-Request-Id`** + **`Cache-Control: no-store`** ) like other API routes.
 * Optional **`?checks=1`**: booleans only (whether expected env vars are set) — useful after deploy; does not expose values.
 */
export async function GET(req: NextRequest) {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const ref =
    (sha && sha.length >= 7 ? sha.slice(0, 7) : undefined) ||
    process.env.npm_package_version ||
    undefined;

  const deep = req.nextUrl.searchParams.get('checks') === '1';
  const headers = requestIdHeaders(getOrCreateRequestId(req));

  return NextResponse.json(
    {
      ok: true,
      service: 'auto-coder-web',
      time: new Date().toISOString(),
      ...(ref ? { revision: ref } : {}),
      ...(deep
        ? {
            checks: {
              clerk: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()),
              clerkSecret: Boolean(process.env.CLERK_SECRET_KEY?.trim()),
              publicAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
              stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
              stripeApi: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
              stripeCheckoutPrices: hasStripeCheckoutPricesConfigured(),
              stripeClerkSync: stripeClerkSyncEnabled(),
              billingRateLimit: isBillingRateLimitEnabled(),
              agentRequiresPro: agentApiRequiresPro(),
              agentLlmKeys: hasAgentLlmApiKeysConfigured(),
              agentUpstash: Boolean(
                process.env.UPSTASH_REDIS_REST_URL?.trim() &&
                  process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
              ),
            },
          }
        : {}),
    },
    { headers }
  );
}

export const dynamic = 'force-dynamic';
