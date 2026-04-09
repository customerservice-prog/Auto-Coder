'use client';

import { useEffect, useState } from 'react';

/**
 * Shows a dismissible-style message when returning from Stripe Checkout cancel; strips `?checkout=canceled` from the URL.
 */
export function CheckoutCanceledBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'canceled') {
      return;
    }
    setVisible(true);
    params.delete('checkout');
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <p className="landing-notice landing-notice-warn" role="status">
      Checkout was canceled. You can subscribe anytime from the plans below.
    </p>
  );
}
