import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { isClerkEnabled } from '@/lib/clerk-enabled';
import './globals.css';

function resolveMetadataBase(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    return new URL('http://localhost:3000');
  }
  try {
    return new URL(raw.replace(/\/$/, ''));
  } catch {
    return new URL('http://localhost:3000');
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: 'Auto-Coder — Autonomous AI IDE',
  description: 'The AI-powered IDE that plans, executes, tests, and self-heals. Beyond Cursor.',
  keywords: ['AI IDE', 'autonomous coding', 'AI code editor', 'cursor alternative'],
  openGraph: {
    title: 'Auto-Coder — Autonomous AI IDE',
    description: 'The AI that codes for you. Beyond Cursor.',
    type: 'website',
    siteName: 'Auto-Coder',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auto-Coder — Autonomous AI IDE',
    description: 'The AI that codes for you. Beyond Cursor.',
  },
  appleWebApp: {
    capable: true,
    title: 'Auto-Coder',
    statusBarStyle: 'black-translucent',
  },
  /** Avoid auto-linkifying strings that look like phone numbers in Safari. */
  formatDetection: {
    telephone: false,
  },
  /** Default crawl policy; `app/robots.ts` still controls `robots.txt` (e.g. `/api/`, `/dashboard`). */
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#0d1117',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const inner = (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );

  if (!isClerkEnabled()) {
    return inner;
  }

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!.trim();
  return <ClerkProvider publishableKey={publishableKey}>{inner}</ClerkProvider>;
}
