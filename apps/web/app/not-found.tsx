import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="error-page">
      <div className="error-page-inner">
        <h1>Page not found</h1>
        <p className="error-page-message">
          The page you are looking for does not exist or the link may be outdated.
        </p>
        <div className="error-page-actions">
          <Link href="/">
            <button type="button" className="btn-primary">
              Back to home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
