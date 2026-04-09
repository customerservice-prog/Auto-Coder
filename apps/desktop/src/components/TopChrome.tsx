import { MenuBar } from './MenuBar';
import type { MenuAction } from '../menu-config';

interface TopChromeProps {
  title: string;
  onMenuAction: (action: MenuAction) => void;
  menuActionDisabled?: (action: MenuAction) => boolean;
  onSignIn: () => void;
}

/**
 * Cursor-style top row: application menus, centered title, sign-in (custom title bar).
 */
export function TopChrome({ title, onMenuAction, menuActionDisabled, onSignIn }: TopChromeProps) {
  return (
    <header className="chrome-top">
      <div className="chrome-drag-strip" aria-hidden />
      <div className="chrome-row">
        <div className="chrome-menu-wrap">
          <MenuBar onAction={onMenuAction} actionDisabled={menuActionDisabled} />
        </div>
        <div className="chrome-title">{title}</div>
        <div className="chrome-actions">
          <span className="chrome-pill" aria-hidden="true">
            Agents
          </span>
          <button
            type="button"
            className="chrome-sign-in"
            onClick={onSignIn}
            aria-label="Sign in to Auto-Coder Web"
          >
            Sign in
          </button>
        </div>
      </div>
    </header>
  );
}
