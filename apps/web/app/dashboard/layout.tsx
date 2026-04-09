import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isClerkEnabled } from '@/lib/clerk-enabled';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (isClerkEnabled()) {
    const { userId } = await auth();
    if (!userId) {
      redirect('/sign-in');
    }
  }
  return <>{children}</>;
}
