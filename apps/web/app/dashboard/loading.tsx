/**
 * Shown while the dashboard layout and page are resolving (e.g. slow network).
 */
export default function DashboardLoading() {
  return (
    <div className="dashboard">
      <nav className="dash-nav dash-loading-nav" aria-busy="true" aria-label="Loading dashboard">
        <div className="dash-skel dash-skel-brand" />
        <div className="dash-skel-row">
          <div className="dash-skel dash-skel-btn" />
          <div className="dash-skel dash-skel-avatar" />
        </div>
      </nav>
      <main className="dash-main">
        <div className="dash-skel dash-skel-title" />
        <div className="dash-skel dash-skel-sub" />
        <div className="dash-loading-form">
          <div className="dash-skel dash-skel-field" />
          <div className="dash-skel dash-skel-textarea" />
          <div className="dash-skel dash-skel-textarea dash-skel-short" />
          <div className="dash-skel dash-skel-submit" />
        </div>
      </main>
    </div>
  );
}
