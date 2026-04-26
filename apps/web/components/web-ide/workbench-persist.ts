const KEY = 'ac-workbench-v2';

export type PersistedActivityView = 'explorer' | 'search' | 'scm';

export interface WorkbenchPersisted {
  openTabs: string[];
  activePath: string;
  sidebarOpen: boolean;
  sidebarW: number;
  composerW: number;
  bottomH: number;
  bottomExpanded: boolean;
  activityView: PersistedActivityView;
  expandedDirs: string[];
  /** Paths user pinned in the tab bar */
  pinnedPaths: string[];
}

export function loadWorkbenchPersisted(): Partial<WorkbenchPersisted> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<WorkbenchPersisted>;
    if (!v || typeof v !== 'object') return null;
    return v;
  } catch {
    return null;
  }
}

export function saveWorkbenchPersisted(state: WorkbenchPersisted): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode */
  }
}

const RECENT_CMD_KEY = 'ac-palette-recent-v1';

export function loadRecentCommandIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_CMD_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function recordRecentCommandId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cur = loadRecentCommandIds().filter((x) => x !== id);
    cur.unshift(id);
    localStorage.setItem(RECENT_CMD_KEY, JSON.stringify(cur.slice(0, 12)));
  } catch {
    /* ignore */
  }
}
