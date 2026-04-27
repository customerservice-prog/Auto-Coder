const STORAGE_KEY = 'ac-web-workspace-repo-v1';

export interface WebWorkspaceRepoMeta {
  repoUrl: string;
  repoLabel: string;
  repoNotes: string;
}

const EMPTY: WebWorkspaceRepoMeta = { repoUrl: '', repoLabel: '', repoNotes: '' };

export function loadWebWorkspaceRepoMeta(): WebWorkspaceRepoMeta {
  if (typeof window === 'undefined') return { ...EMPTY };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return { ...EMPTY };
    const o = v as Record<string, unknown>;
    return {
      repoUrl: typeof o.repoUrl === 'string' ? o.repoUrl : '',
      repoLabel: typeof o.repoLabel === 'string' ? o.repoLabel : '',
      repoNotes: typeof o.repoNotes === 'string' ? o.repoNotes : '',
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveWebWorkspaceRepoMeta(meta: WebWorkspaceRepoMeta): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* quota / private mode */
  }
}
