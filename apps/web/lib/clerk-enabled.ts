function clerkDisabledByFlag(): boolean {
  const v = process.env.NEXT_PUBLIC_CLERK_DISABLED?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** Template keys from `.env.example` load Clerk.js but sign-in never works — treat as off. */
function isPlaceholderClerkPublishableKey(key: string): boolean {
  const k = key.trim();
  if (!k) return true;
  if (/your-key-here|pk_test_your|sk_test_your|changeme|example\.com/i.test(k)) {
    return true;
  }
  // Real Clerk publishable keys are long JWT-like strings; placeholders are short.
  if (k.startsWith('pk_test_') && k.length < 32) {
    return true;
  }
  return false;
}

export function isClerkEnabled(): boolean {
  if (clerkDisabledByFlag()) {
    return false;
  }
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!pk || isPlaceholderClerkPublishableKey(pk)) {
    return false;
  }
  return true;
}
