export type AgentErrorBody = {
  error?: string;
  code?: string;
  retryAfterMs?: number;
  limit?: number;
  used?: number;
  requestId?: string;
};

/**
 * Formats `/api/agent` error responses for the dashboard (429 retry hints, subscription gate, etc.).
 */
export function formatAgentApiError(
  res: Pick<Response, 'status' | 'statusText' | 'headers'>,
  body: AgentErrorBody | null
): string {
  const ref =
    body?.requestId?.trim() || res.headers.get('X-Request-Id')?.trim() || '';
  const refSuffix = ref ? ` Reference: ${ref}.` : '';

  const base =
    typeof body?.error === 'string'
      ? body.error
      : body && Object.keys(body).length > 0
        ? JSON.stringify(body)
        : `${res.status} ${res.statusText}`;

  if (res.status === 403 && body?.code === 'pro_required') {
    const msg =
      typeof body?.error === 'string' && body.error.trim()
        ? body.error.trim()
        : 'An active subscription is required to use the assistant.';
    return `${msg} If you just subscribed, wait a few seconds for Stripe to update your account, then refresh and try again.${refSuffix}`;
  }

  if (res.status !== 429) {
    return base + refSuffix;
  }

  const parts = [base];
  const retryHeader = res.headers.get('Retry-After');
  if (retryHeader) {
    const s = Number.parseInt(retryHeader, 10);
    if (Number.isFinite(s) && s > 0) {
      parts.push(`Retry in about ${s}s.`);
    }
  } else if (body?.retryAfterMs != null && body.retryAfterMs > 0) {
    parts.push(`Retry in about ${Math.ceil(body.retryAfterMs / 1000)}s.`);
  }
  if (body?.limit != null && body?.used != null) {
    parts.push(`Daily usage: ${body.used} / ${body.limit}.`);
  }
  parts.push(refSuffix.trim());
  return parts.filter(Boolean).join(' ');
}
