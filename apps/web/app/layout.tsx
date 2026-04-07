import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Auto-Coder — Autonomous AI IDE',
  description: 'The AI-powered IDE that plans, executes, tests, and self-heals. Beyond Cursor.',
  keywords: ['AI IDE', 'autonomous coding', 'AI code editor', 'cursor alternative'],
  openGraph: {
    title: 'Auto-Coder — Autonomous AI IDE',
    description: 'The AI that codes for you. Beyond Cursor.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
