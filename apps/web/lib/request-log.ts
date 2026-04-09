import { randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';

const REQUEST_ID_HEADERS = ['x-request-id', 'x-correlation-id', 'cf-ray', 'x-vercel-id'];

/**
 * Prefer an incoming edge/proxy id; otherwise generate a UUID.
 */
export function getOrCreateRequestId(req: NextRequest): string {
  for (const name of REQUEST_ID_HEADERS) {
    const v = req.headers.get(name)?.trim();
    if (v) {
      return v.slice(0, 128);
    }
  }
  return randomUUID();
}

type LogLevel = 'info' | 'warn' | 'error';

/**
 * When `AGENT_API_DEBUG` is `1` or `true`, `/api/agent` logs include Clerk session/org ids
 * (helpful in staging; avoid in untrusted log sinks in production).
 */
export function isAgentApiDebug(): boolean {
  const v = process.env.AGENT_API_DEBUG?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export type ClerkAuthForLogs = {
  userId: string | null;
  sessionId?: string | null;
  orgId?: string | null;
  orgRole?: string | null;
};

/** Extra correlation fields merged into agent logs (empty unless `isAgentApiDebug()`). */
export function clerkCorrelationFields(a: ClerkAuthForLogs): Record<string, unknown> {
  if (!isAgentApiDebug()) {
    return {};
  }
  return {
    clerkSessionId: a.sessionId ?? undefined,
    clerkOrgId: a.orgId ?? undefined,
    clerkOrgRole: a.orgRole ?? undefined,
  };
}

/**
 * One JSON line per event (works with Vercel/AWS/structured log drains).
 */
export function logAgentApi(level: LogLevel, fields: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    service: 'auto-coder-web',
    component: 'api/agent',
    level,
    ...fields,
  });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Standard headers for authenticated / sensitive API responses.
 * `Cache-Control: no-store` avoids stale JSON or streams behind shared caches.
 */
export function requestIdHeaders(requestId: string): Record<string, string> {
  return {
    'X-Request-Id': requestId,
    'Cache-Control': 'no-store',
  };
}

/**
 * Structured logs for `POST /api/stripe/webhook`.
 */
export function logStripeWebhook(level: LogLevel, fields: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    service: 'auto-coder-web',
    component: 'api/stripe/webhook',
    level,
    ...fields,
  });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/** Structured logs for billing routes (`POST /api/stripe/checkout`, `POST /api/stripe/portal`). */
export function logBillingApi(level: LogLevel, fields: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    service: 'auto-coder-web',
    component: 'api/stripe/billing',
    level,
    ...fields,
  });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}
