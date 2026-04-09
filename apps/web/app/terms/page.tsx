import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms · Auto-Coder',
  description: 'Terms of use for Auto-Coder.',
};

/** Static legal copy — safe to cache aggressively at the edge. */
export const dynamic = 'force-static';

export default function TermsPage() {
  return (
    <div className="legal-page">
      <nav className="nav">
        <Link href="/" className="nav-brand-link">
          <span className="nav-logo">🚀</span>
          <span className="nav-name">Auto-Coder</span>
        </Link>
      </nav>
      <main className="legal-main">
        <h1>Terms of use</h1>
        <p className="legal-lead">
          Starter terms placeholder. Replace with advice from qualified counsel before offering a paid or public product.
        </p>
        <h2>Software</h2>
        <p>
          Auto-Coder is provided under the license terms supplied with your copy of the software. You are responsible
          for compliance with third-party APIs (model providers, auth, payments) and for your users’ data.
        </p>
        <h2>AI output</h2>
        <p>
          Generated suggestions may be incorrect or unsafe. You review and test before relying on them in production.
          You are responsible for license compliance in your own codebase.
        </p>
        <h2>Limitation of liability</h2>
        <p>
          To the extent permitted by law, the software is provided as-is without warranties. Limitation and venue
          clauses should be tailored for your jurisdiction and product.
        </p>
        <p className="legal-back">
          <Link href="/">← Home</Link>
          {' · '}
          <Link href="/privacy">Privacy</Link>
        </p>
      </main>
    </div>
  );
}
