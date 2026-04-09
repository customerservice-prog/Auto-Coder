import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isClerkEnabled } from '@/lib/clerk-enabled';

export default function SignInPage() {
  if (!isClerkEnabled()) {
    redirect('/dashboard');
  }

  return (
    <div className="auth-page">
      <nav className="nav">
        <Link href="/" className="nav-brand-link">
          <span className="nav-logo">🚀</span>
          <span className="nav-name">Auto-Coder</span>
        </Link>
      </nav>
      <main className="auth-main">
        <SignIn fallbackRedirectUrl="/dashboard" signUpUrl="/sign-up" />
      </main>
    </div>
  );
}
