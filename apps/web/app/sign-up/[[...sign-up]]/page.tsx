import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isClerkEnabled } from '@/lib/clerk-enabled';

export default function SignUpPage() {
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
        <SignUp fallbackRedirectUrl="/dashboard" signInUrl="/sign-in" />
      </main>
    </div>
  );
}
