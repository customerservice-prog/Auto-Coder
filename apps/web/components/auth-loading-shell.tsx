/**
 * Skeleton while Clerk `SignIn` / `SignUp` embeds load.
 */
export function AuthLoadingShell({ label }: { label: string }) {
  return (
    <div className="auth-page">
      <nav className="nav auth-loading-nav" aria-busy="true" aria-label={label}>
        <div className="dash-skel auth-skel-brand" />
      </nav>
      <main className="auth-main">
        <div className="dash-skel auth-skel-clerk" />
      </main>
    </div>
  );
}
