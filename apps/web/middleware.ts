import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
);

export default clerkConfigured
  ? clerkMiddleware()
  : function passthrough() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    '/((?!.+\\.[\\w]+$|_next).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
