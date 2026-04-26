import { DashboardClient } from './dashboard-client';

/** Server segment config — must live outside `'use client'` so `next build` skips static prerender of /dashboard. */
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return <DashboardClient />;
}
