import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { FileNode } from '../types/file-tree';
import { desktopAccel } from '../desktopAccel';

interface FileTreeProps {
  nodes: FileNode[];
  onFileOpen: (node: FileNode) => void;
  activeFile: string;
  projectPath: string;
  onRefresh?: () => void | Promise<void>;
}

const FILE_ICONS: Record<string, string> = {
  '.ts': '📘',
  '.tsx': '⚛️',
  '.js': '📙',
  '.jsx': '⚛️',
  '.py': '🐍',
  '.go': '🐹',
  '.rs': '🦀',
  '.css': '🎨',
  '.scss': '🎨',
  '.json': '📋',
  '.md': '📄',
  '.html': '🌐',
  '.yaml': '⚙️',
  '.yml': '⚙️',
  '.env': '🔐',
  '.gitignore': '🙈',
};

function getFileIcon(node: FileNode): string {
  if (node.type === 'directory') return '📁';
  return FILE_ICONS[node.ext || ''] || '📄';
}

function collectInitiallyExpanded(list: FileNode[], depth: number, out: Set<string>) {
  for (const n of list) {
    if (n.type === 'directory') {
      if (depth < 2) out.add(n.path);
      collectInitiallyExpanded(n.children ?? [], depth + 1, out);
    }
  }
}

function pathExistsInNodes(path: string, list: FileNode[]): boolean {
  for (const n of list) {
    if (n.path === path) return true;
    if (n.children && pathExistsInNodes(path, n.children)) return true;
  }
  return false;
}

function visibleFlatten(nodes: FileNode[], expanded: Set<string>): FileNode[] {
  const out: FileNode[] = [];
  function walk(list: FileNode[]) {
    for (const n of list) {
      out.push(n);
      if (n.type === 'directory' && expanded.has(n.path) && n.children?.length) {
        walk(n.children);
      }
    }
  }
  walk(nodes);
  return out;
}

/** Parent directory path, or `null` (roots / drive-only). */
function parentDirPath(filePath: string): string | null {
  const trimmed = filePath.replace(/[/\\]+$/, '');
  const lastSlash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (lastSlash < 0) return null;
  if (lastSlash === 0) return trimmed.slice(0, 1) || null;
  return trimmed.slice(0, lastSlash);
}

function findVisibleAncestorPath(filePath: string, visible: FileNode[]): string | null {
  let p = parentDirPath(filePath);
  while (p) {
    if (visible.some((n) => n.path === p)) return p;
    p = parentDirPath(p);
  }
  return null;
}

function TreeNode(props: {
  node: FileNode;
  depth: number;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
  onFileOpen: (node: FileNode) => void;
  activeFile: string;
  focusPath: string | null;
  defaultTabStopPath: string | null;
  onRowFocus: (path: string) => void;
}) {
  const { node, depth, expandedDirs, toggleDir, onFileOpen, activeFile, focusPath, defaultTabStopPath, onRowFocus } =
    props;
  const isExpanded = expandedDirs.has(node.path);
  const isActive = node.path === activeFile;
  const tabIdx =
    (focusPath !== null ? focusPath === node.path : node.path === defaultTabStopPath) ? 0 : -1;
  const level = Math.min(depth + 1, 20);

  if (node.type === 'directory') {
    return (
      <div role="none">
        <button
          type="button"
          role="treeitem"
          aria-expanded={isExpanded}
          aria-level={level}
          data-tree-path={node.path}
          tabIndex={tabIdx}
          className="tree-item tree-dir"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onFocus={() => onRowFocus(node.path)}
          onClick={() => toggleDir(node.path)}
        >
          <span className="tree-arrow" aria-hidden>
            {isExpanded ? '▾' : '▸'}
          </span>
          <span className="tree-icon" aria-hidden>
            📁
          </span>
          <span className="tree-label">{node.name}</span>
        </button>
        {isExpanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              onFileOpen={onFileOpen}
              activeFile={activeFile}
              focusPath={focusPath}
              defaultTabStopPath={defaultTabStopPath}
              onRowFocus={onRowFocus}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      role="treeitem"
      aria-level={level}
      aria-selected={isActive}
      data-tree-path={node.path}
      tabIndex={tabIdx}
      className={`tree-item tree-file ${isActive ? 'active' : ''}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onFocus={() => onRowFocus(node.path)}
      onClick={() => onFileOpen(node)}
    >
      <span className="tree-icon" aria-hidden>
        {getFileIcon(node)}
      </span>
      <span className="tree-label">{node.name}</span>
    </button>
  );
}

export function FileTree({ nodes, onFileOpen, activeFile, projectPath, onRefresh }: FileTreeProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => {
    const s = new Set<string>();
    collectInitiallyExpanded(nodes, 0, s);
    return s;
  });
  /** `null` = user has not moved roving focus yet; first visible row stays the lone Tab stop. */
  const [focusPath, setFocusPath] = useState<string | null>(null);

  useEffect(() => {
    setExpandedDirs((prev) => {
      const next = new Set<string>();
      for (const p of prev) {
        if (pathExistsInNodes(p, nodes)) next.add(p);
      }
      if (nodes.length && next.size === 0) {
        collectInitiallyExpanded(nodes, 0, next);
      }
      return next;
    });
  }, [nodes]);

  const visible = useMemo(() => visibleFlatten(nodes, expandedDirs), [nodes, expandedDirs]);
  const defaultTabStopPath = visible[0]?.path ?? null;

  useEffect(() => {
    setFocusPath((prev) => {
      if (!prev) return null;
      return visible.some((n) => n.path === prev) ? prev : null;
    });
  }, [visible]);

  useEffect(() => {
    const target = focusPath ?? defaultTabStopPath;
    if (!target) return;
    const el = document.querySelector<HTMLElement>(`[data-tree-path="${CSS.escape(target)}"]`);
    if (!el) return;
    if (!document.activeElement?.closest('.file-tree-content')) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  }, [focusPath, defaultTabStopPath, expandedDirs]);

  const onRowFocus = useCallback((path: string) => {
    setFocusPath(path);
  }, []);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const onContentKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!visible.length) return;
      const path = (document.activeElement as HTMLElement | null)?.dataset?.treePath;
      if (!path) return;
      const i = visible.findIndex((n) => n.path === path);
      if (i < 0) return;
      const node = visible[i]!;
      const k = e.key;

      if (k === 'ArrowDown') {
        e.preventDefault();
        if (i < visible.length - 1) setFocusPath(visible[i + 1]!.path);
        return;
      }
      if (k === 'ArrowUp') {
        e.preventDefault();
        if (i > 0) setFocusPath(visible[i - 1]!.path);
        return;
      }
      if (k === 'Home') {
        e.preventDefault();
        setFocusPath(visible[0]!.path);
        return;
      }
      if (k === 'End') {
        e.preventDefault();
        setFocusPath(visible[visible.length - 1]!.path);
        return;
      }
      if (k === 'ArrowRight' && node.type === 'directory') {
        e.preventDefault();
        if (!expandedDirs.has(node.path)) {
          setExpandedDirs((prev) => new Set(prev).add(node.path));
        }
        return;
      }
      if (k === 'ArrowLeft') {
        e.preventDefault();
        if (node.type === 'directory' && expandedDirs.has(node.path)) {
          setExpandedDirs((prev) => {
            const next = new Set(prev);
            next.delete(node.path);
            return next;
          });
          return;
        }
        const anc = findVisibleAncestorPath(node.path, visible);
        if (anc) setFocusPath(anc);
        return;
      }
    },
    [visible, expandedDirs]
  );

  if (!projectPath) {
    return (
      <div className="file-tree-empty" role="region" aria-labelledby="explorer-no-project-heading">
        <h2 className="file-tree-empty-heading" id="explorer-no-project-heading">
          No project open
        </h2>
        <p className="hint">
          Use <strong>File → Open Folder…</strong> ({desktopAccel('openFolder')})
        </p>
      </div>
    );
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <div className="file-tree-header-titles">
          <h2 className="sidebar-section-heading" id="sidebar-explorer-heading">
            Explorer
          </h2>
          <span className="project-name" title={projectPath}>
            {projectPath.split('/').pop() || projectPath.split('\\').pop()}
          </span>
        </div>
        {onRefresh ? (
          <button
            type="button"
            className="file-tree-refresh"
            title="Refresh Explorer"
            aria-label="Refresh Explorer"
            onClick={() => void onRefresh()}
          >
            ↻
          </button>
        ) : null}
      </div>
      {nodes.length === 0 ? (
        <div className="file-tree-content">
          <div className="file-tree-empty" role="region" aria-labelledby="explorer-empty-folder-heading">
            <h2 className="file-tree-empty-heading" id="explorer-empty-folder-heading">
              No files in this folder
            </h2>
            <p className="hint">
              <strong>{desktopAccel('openFile')}</strong> to open a file, or add files on disk and use{' '}
              <strong>Refresh Explorer</strong> (↻ above).
            </p>
          </div>
        </div>
      ) : (
        <div
          className="file-tree-content"
          role="tree"
          aria-labelledby="sidebar-explorer-heading"
          onKeyDown={onContentKeyDown}
        >
          {nodes.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              onFileOpen={onFileOpen}
              activeFile={activeFile}
              focusPath={focusPath}
              defaultTabStopPath={defaultTabStopPath}
              onRowFocus={onRowFocus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
