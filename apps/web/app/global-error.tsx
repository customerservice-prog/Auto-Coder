'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Catches errors in the root `layout.tsx` (e.g. ClerkProvider). Must define `<html>` and `<body>`.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/global-error
 */
export default function GlobalError({
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
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="error-page">
          <div className="error-page-inner">
            <h1>Application error</h1>
            <p className="error-page-message">
              {error.message?.trim() ||
                'The app could not render. This often indicates a configuration issue (for example, missing or invalid Clerk keys).'}
            </p>
            {error.digest ? <p className="error-page-digest">Reference: {error.digest}</p> : null}
            <div className="error-page-actions">
              <button type="button" className="btn-primary" onClick={() => reset()}>
                Try again
              </button>
              <a href="/" className="error-page-home-link">
                Back to home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
