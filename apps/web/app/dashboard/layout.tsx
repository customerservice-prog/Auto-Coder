import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isClerkEnabled } from '@/lib/clerk-enabled';

/** Monaco / browser-only deps must not run during `next build` static prerender. */
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (isClerkEnabled()) {
    const { userId } = await auth();
    if (!userId) {
      redirect('/sign-in');
    }
  }
  return <>{children}</>;
}
