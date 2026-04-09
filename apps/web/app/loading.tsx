/**
 * Root route shell while `app/page.tsx` and shared layout are resolving.
 */
export default function RootLoading() {
  return (
    <div className="landing landing-loading">
      <nav className="nav landing-loading-nav" aria-busy="true" aria-label="Loading site">
        <div className="dash-skel landing-skel-brand" />
        <div className="nav-actions">
          <div className="dash-skel landing-skel-nav-btn" />
          <div className="dash-skel landing-skel-nav-cta" />
        </div>
      </nav>
      <main className="hero">
        <div className="dash-skel landing-skel-hero-badge" />
        <div className="dash-skel landing-skel-hero-title" />
        <div className="dash-skel landing-skel-hero-sub" />
        <div className="landing-skel-cta-row">
          <div className="dash-skel landing-skel-cta-primary" />
          <div className="dash-skel landing-skel-cta-secondary" />
        </div>
        <div className="landing-skel-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dash-skel landing-skel-card" />
          ))}
        </div>
      </main>
    </div>
  );
}
