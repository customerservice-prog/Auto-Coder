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

/** Monaco `saveViewState()` JSON per file path — survives full reload */
const EDITOR_VIEWS_KEY = 'ac-editor-views-v1';
const EDITOR_VIEWS_MAX_BYTES = 450_000;

export function loadEditorViewStates(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(EDITOR_VIEWS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return v as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function saveEditorViewStates(views: Record<string, unknown | null>): void {
  if (typeof window === 'undefined') return;
  try {
    const pruned: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(views)) {
      if (val != null && typeof val === 'object') pruned[k] = val as Record<string, unknown>;
    }
    let json = JSON.stringify(pruned);
    while (json.length > EDITOR_VIEWS_MAX_BYTES && Object.keys(pruned).length > 1) {
      const keys = Object.keys(pruned);
      delete pruned[keys[keys.length - 1]!];
      json = JSON.stringify(pruned);
    }
    localStorage.setItem(EDITOR_VIEWS_KEY, json);
  } catch {
    /* quota */
  }
}
