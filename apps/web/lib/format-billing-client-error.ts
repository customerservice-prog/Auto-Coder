/**
 * User-visible copy for failed billing API calls from the browser (incl. 429 + Retry-After).
 */

export type BillingErrorBody = {
  error?: string;
  retryAfterMs?: number;
  requestId?: string;
};

export function formatBillingClientAlert(res: Response, body: BillingErrorBody | null): string {
  const ref = body?.requestId?.trim();
  const refPart = ref ? ` Reference: ${ref}.` : '';

  const fallback = `Request failed (${res.status}).`;
  const base = typeof body?.error === 'string' && body.error.trim() ? body.error.trim() : fallback;

  if (res.status !== 429) {
    return base + refPart;
  }

  const headerSec = res.headers.get('Retry-After');
  const fromHeader =
    headerSec != null ? Number.parseInt(headerSec, 10) : Number.NaN;
  const fromBody =
    body?.retryAfterMs != null && body.retryAfterMs > 0
      ? Math.ceil(body.retryAfterMs / 1000)
      : Number.NaN;
  const sec = Number.isFinite(fromHeader) && fromHeader > 0 ? fromHeader : fromBody;

  if (Number.isFinite(sec) && sec > 0) {
    return `${base} Try again in about ${sec}s.${refPart}`;
  }

  return base + refPart;
}
