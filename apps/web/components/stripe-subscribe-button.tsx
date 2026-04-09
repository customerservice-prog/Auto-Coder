'use client';

import { useState, type ReactNode } from 'react';
import type { BillingErrorBody } from '@/lib/format-billing-client-error';
import { formatBillingClientAlert } from '@/lib/format-billing-client-error';

type Plan = 'pro' | 'team';

type Props = {
  plan: Plan;
  className?: string;
  children: ReactNode;
};

/**
 * Starts hosted Stripe Checkout (`POST /api/stripe/checkout`) and redirects the browser.
 */
export function StripeSubscribeButton({ plan, className, children }: Props) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
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
        window.alert('Checkout did not return a URL');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={className} disabled={loading} onClick={onClick}>
      {loading ? 'Redirecting…' : children}
    </button>
  );
}
