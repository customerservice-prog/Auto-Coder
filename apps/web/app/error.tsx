'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Catches uncaught errors in route segments (not in `layout.tsx` — use `global-error` for that if needed).
 */
export default function ErrorBoundary({
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
        <h1>Something went wrong</h1>
        <p className="error-page-message">
          {error.message?.trim() ||
            'An unexpected error occurred. You can try again or return to the home page.'}
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
