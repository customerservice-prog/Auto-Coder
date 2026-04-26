/**
 * Shown while the dashboard layout and page are resolving (e.g. slow network).
 */
export default function DashboardLoading() {
  return (
    <div className="dashboard web-dash-root" aria-busy="true" aria-label="Loading dashboard">
      <header className="ide-titlebar wb-chrome">
        <div className="dash-skel dash-skel-brand" style={{ maxWidth: 200 }} />
        <div className="dash-skel" style={{ width: 72, height: 28 }} />
      </header>
      <div className="wb-app">
        <div className="wb-body">
          <div className="wb-activity-bar" style={{ pointerEvents: 'none' }}>
            <div className="dash-skel" style={{ width: 36, height: 36, borderRadius: 6, margin: 4 }} />
            <div className="dash-skel" style={{ width: 36, height: 36, borderRadius: 6, margin: 4 }} />
          </div>
          <aside className="wb-sidebar">
            <div className="wb-file-tree-header">
              <div className="dash-skel" style={{ width: 80, height: 14, marginBottom: 8 }} />
              <div className="dash-skel" style={{ width: '100%', height: 16 }} />
            </div>
            <div style={{ padding: 12 }}>
              <div className="dash-skel" style={{ width: '90%', height: 14, marginBottom: 8 }} />
              <div className="dash-skel" style={{ width: '75%', height: 14, marginBottom: 8 }} />
              <div className="dash-skel" style={{ width: '85%', height: 14 }} />
            </div>
          </aside>
          <div className="wb-main">
            <div className="wb-tab-bar">
              <div className="dash-skel" style={{ width: 120, height: 22, margin: '6px 8px' }} />
            </div>
            <div className="wb-editor-host" style={{ minHeight: 200 }}>
              <div className="dash-skel" style={{ width: '100%', height: '100%', minHeight: 200 }} />
            </div>
            <div className="wb-bottom">
              <div className="wb-bottom-tabs">
                <div className="dash-skel" style={{ width: 64, height: 18, margin: '4px 8px' }} />
              </div>
              <div className="wb-bottom-body">
                <div className="dash-skel" style={{ width: '100%', height: 48 }} />
              </div>
            </div>
          </div>
          <aside className="wb-composer">
            <div className="dash-skel" style={{ width: '80%', height: 14, margin: 16 }} />
            <div className="dash-skel" style={{ width: '90%', height: 80, margin: '0 16px' }} />
            <div className="dash-skel" style={{ width: '90%', height: 60, margin: 12 }} />
          </aside>
        </div>
        <footer className="wb-status-bar">
          <div className="dash-skel" style={{ width: 120, height: 12, background: 'rgba(255,255,255,0.25)' }} />
        </footer>
      </div>
    </div>
  );
}
