'use client';

import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
} from 'react';
import { isClerkEnabled } from '@/lib/clerk-enabled';

export function SignedOutGate({ children }: { children: ReactNode }) {
  if (!isClerkEnabled()) return <>{children}</>;
  return <SignedOut>{children}</SignedOut>;
}

export function SignedInGate({ children }: { children: ReactNode }) {
  if (!isClerkEnabled()) return null;
  return <SignedIn>{children}</SignedIn>;
}

export function SignInControl({ children }: { children: ReactNode }) {
  const router = useRouter();
  if (!isClerkEnabled()) {
    const only = Children.only(children);
    if (isValidElement<{ onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void }>(only)) {
      return cloneElement(only, {
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
          only.props.onClick?.(e);
          router.push('/dashboard');
        },
      });
    }
    return <>{children}</>;
  }
  return <SignInButton mode="modal">{children}</SignInButton>;
}

export function AccountMenu() {
  if (!isClerkEnabled()) {
    return (
      <Link href="/" className="nav-brand-link ide-local-home">
        Home
      </Link>
    );
  }
  return <UserButton afterSignOutUrl="/" />;
}
