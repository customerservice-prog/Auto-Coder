'use client';

import { useState, type ReactNode } from 'react';
import type { BillingErrorBody } from '@/lib/format-billing-client-error';
import { formatBillingClientAlert } from '@/lib/format-billing-client-error';

type Props = {
  className?: string;
  children?: ReactNode;
};

/**
 * Opens Stripe Customer Portal (`POST /api/stripe/portal`).
 */
export function StripePortalButton({ className, children = 'Manage billing' }: Props) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = (await res.json().catch(() => null)) as
        | ({ url?: string } & BillingErrorBody)
        | null;
      if (!res.ok) {
        window.alert(formatBillingClientAlert(res, data));
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        window.alert('Portal did not return a URL');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={className} disabled={loading} onClick={onClick}>
      {loading ? 'Opening…' : children}
    </button>
  );
}
