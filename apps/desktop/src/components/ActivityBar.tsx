import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { desktopAccel } from '../desktopAccel';

export type ActivityView = 'explorer' | 'search';

const TOOLBAR_IDS = ['activity-bar-explorer', 'activity-bar-search', 'activity-bar-account'] as const;
const N_FOCUSABLE = TOOLBAR_IDS.length;

interface ActivityBarProps {
  active: ActivityView;
  onSelect: (view: ActivityView) => void;
  onSignIn: () => void;
}

export function ActivityBar({ active, onSelect, onSignIn }: ActivityBarProps) {
  const [focusIdx, setFocusIdx] = useState(0);
  const skipProgrammaticFocus = useRef(true);

  useEffect(() => {
    if (skipProgrammaticFocus.current) {
      skipProgrammaticFocus.current = false;
      return;
    }
    document.getElementById(TOOLBAR_IDS[focusIdx])?.focus();
  }, [focusIdx]);

  const onToolbarKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'Home' && k !== 'End') return;
    e.preventDefault();
    if (k === 'Home') {
      setFocusIdx(0);
      return;
    }
    if (k === 'End') {
      setFocusIdx(N_FOCUSABLE - 1);
      return;
    }
    if (k === 'ArrowDown') {
      setFocusIdx((i) => (i + 1) % N_FOCUSABLE);
      return;
    }
    setFocusIdx((i) => (i - 1 + N_FOCUSABLE) % N_FOCUSABLE);
  }, []);

  return (
    <div
      className="activity-bar"
      role="toolbar"
      aria-label="Side bar views"
      aria-orientation="vertical"
      onKeyDown={onToolbarKeyDown}
    >
      <div className="activity-bar-top">
        <button
          id={TOOLBAR_IDS[0]}
          type="button"
          tabIndex={focusIdx === 0 ? 0 : -1}
          className={`activity-btn ${active === 'explorer' ? 'active' : ''}`}
          title={`Explorer (${desktopAccel('toggleExplorer')})`}
          aria-label={`Explorer, shortcut ${desktopAccel('toggleExplorer')}`}
          aria-pressed={active === 'explorer'}
          onFocus={() => setFocusIdx(0)}
          onClick={() => onSelect('explorer')}
        >
          <span className="activity-icon" aria-hidden="true">
            📂
          </span>
        </button>
        <button
          id={TOOLBAR_IDS[1]}
          type="button"
          tabIndex={focusIdx === 1 ? 0 : -1}
          className={`activity-btn ${active === 'search' ? 'active' : ''}`}
          title={`Search (${desktopAccel('toggleSearch')})`}
          aria-label={`Search, shortcut ${desktopAccel('toggleSearch')}`}
          aria-pressed={active === 'search'}
          onFocus={() => setFocusIdx(1)}
          onClick={() => onSelect('search')}
        >
          <span className="activity-icon" aria-hidden="true">
            🔍
          </span>
        </button>
        <button
          type="button"
          className="activity-btn"
          title="Run and Debug (soon)"
          aria-label="Run and Debug (coming soon)"
          disabled
          tabIndex={-1}
        >
          <span className="activity-icon" aria-hidden="true">
            ▶
          </span>
        </button>
        <button
          type="button"
          className="activity-btn"
          title="Extensions (soon)"
          aria-label="Extensions (coming soon)"
          disabled
          tabIndex={-1}
        >
          <span className="activity-icon" aria-hidden="true">
            🧩
          </span>
        </button>
      </div>
      <div className="activity-bar-bottom">
        <button
          id={TOOLBAR_IDS[2]}
          type="button"
          tabIndex={focusIdx === 2 ? 0 : -1}
          className="activity-btn activity-account"
          title="Sign in"
          aria-label="Sign in to Auto-Coder Web"
          onFocus={() => setFocusIdx(2)}
          onClick={onSignIn}
        >
          <span className="activity-icon" aria-hidden="true">
            👤
          </span>
        </button>
      </div>
    </div>
  );
}
