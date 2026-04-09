/**
 * Skeleton while legal/policy pages load.
 */
export function LegalLoadingShell({ label }: { label: string }) {
  return (
    <div className="legal-page">
      <nav className="nav legal-loading-nav" aria-busy="true" aria-label={label}>
        <div className="dash-skel legal-skel-brand" />
      </nav>
      <main className="legal-main">
        <div className="dash-skel legal-skel-h1" />
        <div className="dash-skel legal-skel-lead" />
        <div className="dash-skel legal-skel-h2" />
        <div className="dash-skel legal-skel-p" />
        <div className="dash-skel legal-skel-p legal-skel-p-short" />
        <div className="dash-skel legal-skel-h2" />
        <div className="dash-skel legal-skel-p" />
        <div className="dash-skel legal-skel-p legal-skel-p-short" />
      </main>
    </div>
  );
}
