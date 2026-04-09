'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/** Dashboard segment errors (e.g. streaming / client failures) without affecting the rest of the site. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="error-page">
      <div className="error-page-inner">
        <h1>Web assistant had a problem</h1>
        <p className="error-page-message">
          {error.message?.trim() || 'Something went wrong loading the assistant. Try again or return home.'}
        </p>
        {error.digest ? <p className="error-page-digest">Reference: {error.digest}</p> : null}
        <div className="error-page-actions">
          <button type="button" className="btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/">
            <button type="button" className="btn-outline">
              Back to home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
