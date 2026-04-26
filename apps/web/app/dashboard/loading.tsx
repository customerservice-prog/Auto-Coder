/**
 * Shown while the dashboard layout and page are resolving (e.g. slow network).
 */
export default function DashboardLoading() {
  return (
    <div className="dashboard web-dash-root" aria-busy="true" aria-label="Loading dashboard">
      <header className="ide-titlebar wb-chrome topbar">
        <div className="dash-skel dash-skel-brand" style={{ maxWidth: 200 }} />
        <div className="dash-skel" style={{ width: 72, height: 28 }} />
      </header>
      <div className="wb-app">
        <div className="wb-body">
          <div className="wb-activity-bar activity-bar" style={{ pointerEvents: 'none' }}>
            <div className="dash-skel" style={{ width: 44, height: 34, borderRadius: 0, margin: 0 }} />
            <div className="dash-skel" style={{ width: 44, height: 34, borderRadius: 0, margin: 0 }} />
          </div>
          <aside className="wb-sidebar explorer">
            <div className="wb-file-tree-header">
              <div className="dash-skel" style={{ width: 80, height: 12, marginBottom: 6 }} />
              <div className="dash-skel" style={{ width: '100%', height: 14 }} />
            </div>
            <div style={{ padding: 6 }}>
              <div className="dash-skel" style={{ width: '90%', height: 12, marginBottom: 6 }} />
              <div className="dash-skel" style={{ width: '75%', height: 12, marginBottom: 6 }} />
              <div className="dash-skel" style={{ width: '85%', height: 12 }} />
            </div>
          </aside>
          <div className="wb-main">
            <div className="wb-tab-bar">
              <div className="dash-skel" style={{ width: 120, height: 20, margin: '2px 6px' }} />
            </div>
            <div className="wb-editor-host" style={{ minHeight: 200 }}>
              <div className="dash-skel" style={{ width: '100%', height: '100%', minHeight: 200 }} />
            </div>
            <div className="wb-bottom bottom-panel">
              <div className="wb-bottom-tabs bottom-tabs">
                <div className="dash-skel" style={{ width: 56, height: 16, margin: '3px 6px' }} />
              </div>
              <div className="wb-bottom-body">
                <div className="dash-skel" style={{ width: '100%', height: 36 }} />
              </div>
            </div>
          </div>
          <aside className="wb-composer composer" style={{ width: 320 }} aria-hidden>
            <div className="dash-skel" style={{ width: '70%', height: 10, margin: '6px 8px 0' }} />
            <div
              className="dash-skel"
              style={{ flex: '1 1 0', alignSelf: 'stretch', minHeight: 40, margin: '4px 8px' }}
            />
            <div className="dash-skel" style={{ width: '100%', height: 22, margin: '0 0 4px' }} />
          </aside>
        </div>
        <footer className="wb-status-bar statusbar">
          <div className="dash-skel" style={{ width: 120, height: 10, background: 'rgba(255,255,255,0.12)' }} />
        </footer>
      </div>
    </div>
  );
}
