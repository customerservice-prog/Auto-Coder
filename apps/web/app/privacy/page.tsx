import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy · Auto-Coder',
  description: 'Privacy practices for Auto-Coder.',
};

/** Static legal copy — safe to cache aggressively at the edge. */
export const dynamic = 'force-static';

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <nav className="nav">
        <Link href="/" className="nav-brand-link">
          <span className="nav-logo">🚀</span>
          <span className="nav-name">Auto-Coder</span>
        </Link>
      </nav>
      <main className="legal-main">
        <h1>Privacy</h1>
        <p className="legal-lead">
          This is a starter policy for development. Replace with counsel-reviewed text before capturing real user data
          or processing personal information at scale.
        </p>
        <h2>What we collect</h2>
        <p>
          The web app may process account data via your authentication provider (e.g. Clerk), prompts and pasted context
          you submit to the assistant, and technical logs needed to operate the service. The desktop IDE runs locally
          and writes files only in folders you open.
        </p>
        <h2>How we use it</h2>
        <p>
          Inputs are sent to configured AI providers to generate responses. Rate limits and optional analytics help keep
          the service reliable. Do not paste secrets or regulated data unless your deployment is approved for that use.
        </p>
        <h2>Contact</h2>
        <p>
          Update this section with a contact email or data rights process for your deployment.
        </p>
        <p className="legal-back">
          <Link href="/">← Home</Link>
          {' · '}
          <Link href="/terms">Terms</Link>
        </p>
      </main>
    </div>
  );
}
