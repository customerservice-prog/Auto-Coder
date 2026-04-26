'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import type { editor } from 'monaco-editor';
import { isClerkEnabled } from '@/lib/clerk-enabled';
import { WebMonacoPane } from '@/components/web-ide/WebMonacoPane';
import { WebCommandPalette, type PaletteItem } from '@/components/web-ide/WebCommandPalette';
import { WebContextMenu, type ContextMenuItem } from '@/components/web-ide/WebContextMenu';
import {
  loadEditorViewStates,
  loadRecentCommandIds,
  loadWorkbenchPersisted,
  recordRecentCommandId,
  saveEditorViewStates,
  saveWorkbenchPersisted,
  type WorkbenchPersisted,
} from '@/components/web-ide/workbench-persist';
import { WebQuickOpen } from '@/components/web-ide/WebQuickOpen';
import { WebKeyboardShortcutsModal } from '@/components/web-ide/WebKeyboardShortcutsModal';
import { WebGoToLine } from '@/components/web-ide/WebGoToLine';
import { WebSearchPanel } from '@/components/web-ide/WebSearchPanel';
import {
  IconAccount,
  IconExplorer,
  IconExtensions,
  IconFile,
  IconFolder,
  IconRunDebug,
  IconSearch,
  IconSettings,
  IconSourceControl,
} from '@/components/web-ide/activity-icons';
import { formatModShortcut as accel } from '@/components/web-ide/keyboard-accel';
import { runWorkbenchLayoutAssertions } from '@/lib/web-dash-ui-spec-assert';
import { problemRowsFromAgentError } from '@/components/web-ide/agent-error-lines';
import {
  AGENT_STREAM_PATH,
  DEFAULT_OPEN_PATH,
  DEMO_BUFFERS,
  DEMO_FILE_TREE,
  WEB_DEMO_PROJECT_NAME,
  formatAgentStreamMd,
  initialExpandedDirs,
  listQuickOpenDemoFiles,
  type WebDemoNode,
} from '@/components/web-ide/demo-workspace';

type ActivityView = 'explorer' | 'search' | 'scm';
type BottomTab = 'output' | 'terminal' | 'problems';

interface OpenBuffer {
  path: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
  pinned: boolean;
}

function buildInitialBuffers(): Record<string, OpenBuffer> {
  const out: Record<string, OpenBuffer> = {};
  for (const [p, b] of Object.entries(DEMO_BUFFERS)) {
    out[p] = { path: p, name: b.name, language: b.language, content: b.content, isDirty: false, pinned: false };
  }
  if (out[DEFAULT_OPEN_PATH]) {
    out[DEFAULT_OPEN_PATH] = { ...out[DEFAULT_OPEN_PATH], pinned: true };
  }
  return out;
}

function collectVisibleFiles(
  nodes: WebDemoNode[],
  expanded: Set<string>,
  out: { path: string; name: string }[] = [],
): { path: string; name: string }[] {
  for (const n of nodes) {
    if (n.type === 'directory') {
      if (expanded.has(n.path) && n.children) collectVisibleFiles(n.children, expanded, out);
    } else {
      out.push({ path: n.path, name: n.name });
    }
  }
  return out;
}

function EditorBreadcrumb({ path }: { path: string }) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <nav className="wb-breadcrumb" aria-label="File path">
      {parts.map((seg, i) => (
        <span key={`${i}-${seg}`} className="wb-breadcrumb-bit">
          {i > 0 ? (
            <span className="wb-breadcrumb-sep" aria-hidden>
              /
            </span>
          ) : null}
          <span className={i === parts.length - 1 ? 'wb-breadcrumb-current' : 'wb-breadcrumb-segment'}>{seg}</span>
        </span>
      ))}
    </nav>
  );
}

function DemoTree(props: {
  nodes: WebDemoNode[];
  depth: number;
  expanded: Set<string>;
  toggleDir: (path: string) => void;
  activeFile: string;
  selectedFile: string | null;
  onFileSelect: (path: string, name: string) => void;
  onFileOpen: (path: string, name: string, opts?: { newTab?: boolean }) => void;
  onFileContextMenu?: (path: string, name: string, e: ReactMouseEvent) => void;
}) {
  const { nodes, depth, expanded, toggleDir, activeFile, selectedFile, onFileSelect, onFileOpen, onFileContextMenu } =
    props;
  return (
    <>
      {nodes.map((node) => (
        <div key={node.path}>
          {node.type === 'directory' ? (
            <>
              <button
                type="button"
                className="wb-tree-row explorer-row"
                style={{ paddingLeft: 1 + depth * 2 }}
                onClick={() => toggleDir(node.path)}
              >
                <span
                  className={`wb-tree-chevron wb-tree-chevron-rot${expanded.has(node.path) ? ' wb-tree-chevron-rot-open' : ''}`}
                  aria-hidden
                >
                  ▶
                </span>
                <span className="wb-tree-icon" aria-hidden>
                  <IconFolder />
                </span>
                <span className="wb-tree-label">{node.name}</span>
              </button>
              {expanded.has(node.path) && node.children ? (
                <DemoTree
                  nodes={node.children}
                  depth={depth + 1}
                  expanded={expanded}
                  toggleDir={toggleDir}
                  activeFile={activeFile}
                  selectedFile={selectedFile}
                  onFileSelect={onFileSelect}
                  onFileOpen={onFileOpen}
                  onFileContextMenu={onFileContextMenu}
                />
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className={`wb-tree-row explorer-row wb-tree-file ${activeFile === node.path ? 'wb-tree-active explorer-row-active' : ''} ${selectedFile === node.path ? 'wb-tree-selected' : ''}`}
              style={{ paddingLeft: 1 + depth * 2 }}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  onFileOpen(node.path, node.name, { newTab: true });
                } else {
                  onFileSelect(node.path, node.name);
                }
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                onFileOpen(node.path, node.name);
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  onFileOpen(node.path, node.name, { newTab: true });
                }
              }}
              onContextMenu={(e) => onFileContextMenu?.(node.path, node.name, e)}
            >
              <span className="wb-tree-chevron wb-tree-chevron-spacer" aria-hidden />
              <span className="wb-tree-icon" aria-hidden>
                <IconFile />
              </span>
              <span className="wb-tree-label">{node.name}</span>
            </button>
          )}
        </div>
      ))}
    </>
  );
}

export interface WebIdeWorkbenchProps {
  composer: ReactNode;
  agentOutput: string;
  agentError: string | null;
  loading: boolean;
  onClearAgentOutput?: () => void;
}

export function WebIdeWorkbench({
  composer,
  agentOutput,
  agentError,
  loading,
  onClearAgentOutput,
}: WebIdeWorkbenchProps) {
  const router = useRouter();
  const [activityView, setActivityView] = useState<ActivityView>('explorer');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedDirs, setExpandedDirs] = useState(initialExpandedDirs);
  const [buffers, setBuffers] = useState<Record<string, OpenBuffer>>(buildInitialBuffers);
  const [openTabs, setOpenTabs] = useState<string[]>([DEFAULT_OPEN_PATH]);
  const [activePath, setActivePath] = useState(DEFAULT_OPEN_PATH);
  const [selectedExplorerPath, setSelectedExplorerPath] = useState<string | null>(DEFAULT_OPEN_PATH);
  const [previewTabPath, setPreviewTabPath] = useState<string | null>(null);
  const previewTabPathRef = useRef<string | null>(null);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [bottomExpanded, setBottomExpanded] = useState(true);
  const [bottomTab, setBottomTab] = useState<BottomTab>('output');
  const [minimapEnabled, setMinimapEnabled] = useState(true);
  const [sidebarW, setSidebarW] = useState(240);
  const [composerW, setComposerW] = useState(310);
  const [bottomH, setBottomH] = useState(158);
  const layoutDragRef = useRef<{ kind: 'sb' | 'comp' | 'panel'; start: number; initial: number } | null>(null);
  const wbAppRef = useRef<HTMLDivElement | null>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const prevAgentErrorRef = useRef<string | null>(null);
  const bottomPanelInitedRef = useRef(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [goToLineOpen, setGoToLineOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [layoutDragging, setLayoutDragging] = useState(false);
  const paletteOpenRef = useRef(false);
  const quickOpenRef = useRef(false);
  const shortcutsOpenRef = useRef(false);
  const goToLineOpenRef = useRef(false);
  const zenModeRef = useRef(false);
  const openTabsRef = useRef(openTabs);
  const activePathRef = useRef(activePath);
  const buffersRef = useRef(buffers);
  const monacoEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorViewsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editorViewStates, setEditorViewStates] = useState<Record<string, editor.ICodeEditorViewState | null>>(() => {
    if (typeof window === 'undefined') return {};
    const raw = loadEditorViewStates();
    if (!raw) return {};
    const out: Record<string, editor.ICodeEditorViewState | null> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v != null && typeof v === 'object') out[k] = v as editor.ICodeEditorViewState;
    }
    return out;
  });
  const explorerTreeRef = useRef<HTMLDivElement | null>(null);
  const closeTabRef = useRef<(path: string, e?: ReactMouseEvent) => void>(() => {});
  const bottomBodyRef = useRef<HTMLDivElement | null>(null);
  paletteOpenRef.current = paletteOpen;
  quickOpenRef.current = quickOpen;
  shortcutsOpenRef.current = shortcutsOpen;
  goToLineOpenRef.current = goToLineOpen;
  zenModeRef.current = zenMode;
  openTabsRef.current = openTabs;
  activePathRef.current = activePath;
  buffersRef.current = buffers;
  previewTabPathRef.current = previewTabPath;

  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      const d = layoutDragRef.current;
      if (!d) return;
      if (d.kind === 'sb') {
        const dx = e.clientX - d.start;
        setSidebarW((w) => Math.min(240, Math.max(156, d.initial + dx)));
      } else if (d.kind === 'comp') {
        const dx = d.start - e.clientX;
        setComposerW((w) => Math.min(320, Math.max(300, d.initial + dx)));
      } else {
        const dy = d.start - e.clientY;
        setBottomH((h) => Math.min(520, Math.max(120, d.initial + dy)));
      }
    };
    const onUp = () => {
      if (layoutDragRef.current) {
        layoutDragRef.current = null;
      }
      setLayoutDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const beginSidebarResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    setLayoutDragging(true);
    layoutDragRef.current = { kind: 'sb', start: e.clientX, initial: sidebarW };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarW]);

  const beginComposerResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    setLayoutDragging(true);
    layoutDragRef.current = { kind: 'comp', start: e.clientX, initial: composerW };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [composerW]);

  const beginPanelResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    setLayoutDragging(true);
    layoutDragRef.current = { kind: 'panel', start: e.clientY, initial: bottomH };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [bottomH]);

  const quickOpenEntries = useMemo(() => listQuickOpenDemoFiles(), []);
  const visibleExplorerFiles = useMemo(
    () => collectVisibleFiles(DEMO_FILE_TREE, expandedDirs),
    [expandedDirs],
  );

  const { rows: problemRows, totalLines: problemTotalLines } = useMemo(
    () => problemRowsFromAgentError(agentError),
    [agentError],
  );

  const activeBuffer = buffers[activePath];

  useEffect(() => {
    if (bottomPanelInitedRef.current) {
      return;
    }
    bottomPanelInitedRef.current = true;
    setBottomH(158);
  }, []);

  useEffect(() => {
    setRecentCommandIds(loadRecentCommandIds());
    const p = loadWorkbenchPersisted();
    if (!p) return;
    if (typeof p.sidebarOpen === 'boolean') setSidebarOpen(p.sidebarOpen);
    if (typeof p.sidebarW === 'number') {
      setSidebarW(Math.min(240, Math.max(156, Math.round(p.sidebarW))));
    }
    if (typeof p.composerW === 'number') {
      setComposerW(Math.min(320, Math.max(300, Math.round(p.composerW))));
    }
    if (typeof p.bottomH === 'number' && p.bottomH >= 120 && p.bottomH <= 520) setBottomH(p.bottomH);
    if (typeof p.bottomExpanded === 'boolean') setBottomExpanded(p.bottomExpanded);
    if (p.activityView === 'explorer' || p.activityView === 'search' || p.activityView === 'scm') {
      setActivityView(p.activityView);
    }
    if (Array.isArray(p.expandedDirs)) {
      setExpandedDirs(new Set(p.expandedDirs.filter((x): x is string => typeof x === 'string')));
    }

    const canResolveTab = (path: string) => path === AGENT_STREAM_PATH || Boolean(DEMO_BUFFERS[path]);
    if (Array.isArray(p.openTabs) && p.openTabs.length > 0) {
      const tabs = p.openTabs.filter(canResolveTab);
      if (tabs.length > 0) {
        setBuffers((prev) => {
          let next = { ...prev };
          for (const tabPath of tabs) {
            if (tabPath === AGENT_STREAM_PATH) continue;
            const kb = DEMO_BUFFERS[tabPath];
            if (kb && !next[tabPath]) {
              next[tabPath] = {
                path: tabPath,
                name: kb.name,
                language: kb.language,
                content: kb.content,
                isDirty: false,
                pinned: false,
              };
            }
          }
          if (Array.isArray(p.pinnedPaths)) {
            for (const pin of p.pinnedPaths) {
              if (next[pin]) next[pin] = { ...next[pin], pinned: true };
            }
          }
          return next;
        });
        setOpenTabs(tabs);
        if (p.activePath && canResolveTab(p.activePath) && tabs.includes(p.activePath)) {
          setActivePath(p.activePath);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const pinnedPaths = Object.entries(buffers)
        .filter(([, b]) => b.pinned)
        .map(([p]) => p);
      const payload: WorkbenchPersisted = {
        openTabs,
        activePath,
        sidebarOpen,
        sidebarW,
        composerW,
        bottomH,
        bottomExpanded,
        activityView,
        expandedDirs: [...expandedDirs],
        pinnedPaths,
      };
      saveWorkbenchPersisted(payload);
    }, 400);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [
    openTabs,
    activePath,
    sidebarOpen,
    sidebarW,
    composerW,
    bottomH,
    bottomExpanded,
    activityView,
    expandedDirs,
    buffers,
  ]);

  useEffect(() => {
    if (editorViewsSaveTimerRef.current) clearTimeout(editorViewsSaveTimerRef.current);
    editorViewsSaveTimerRef.current = setTimeout(() => {
      saveEditorViewStates(editorViewStates as unknown as Record<string, unknown | null>);
    }, 400);
    return () => {
      if (editorViewsSaveTimerRef.current) clearTimeout(editorViewsSaveTimerRef.current);
    };
  }, [editorViewStates]);

  useEffect(() => {
    if (!activeBuffer) {
      monacoEditorRef.current = null;
      setCursorLine(1);
      setCursorCol(1);
    }
  }, [activeBuffer]);

  const onMonacoReady = useCallback((ed: editor.IStandaloneCodeEditor) => {
    monacoEditorRef.current = ed;
  }, []);

  const onCursorPositionChange = useCallback((line: number, column: number) => {
    setCursorLine(line);
    setCursorCol(column);
  }, []);

  const applyGoToLine = useCallback((line: number, column: number) => {
    const ed = monacoEditorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return;
    const maxLine = model.getLineCount();
    const ln = Math.min(Math.max(1, Math.floor(line)), maxLine);
    const maxCol = Math.max(1, model.getLineMaxColumn(ln));
    const col = Math.min(Math.max(1, Math.floor(column)), maxCol);
    ed.setPosition({ lineNumber: ln, column: col });
    ed.revealLineInCenterIfOutsideViewport(ln);
    ed.focus();
  }, []);

  useEffect(() => {
    const doc = formatAgentStreamMd(agentOutput, agentError, loading);
    setBuffers((prev) => {
      const cur = prev[AGENT_STREAM_PATH];
      if (cur?.content === doc) return prev;
      return {
        ...prev,
        [AGENT_STREAM_PATH]: {
          path: AGENT_STREAM_PATH,
          name: 'AGENT_STREAM.md',
          language: 'markdown',
          content: doc,
          isDirty: false,
          pinned: cur?.pinned ?? true,
        },
      };
    });
  }, [agentOutput, agentError, loading]);

  useEffect(() => {
    if (loading) {
      setBottomExpanded(true);
      setBottomTab('output');
    }
  }, [loading]);

  useEffect(() => {
    if (!loading || bottomTab !== 'output' || !bottomExpanded) {
      return;
    }
    const el = bottomBodyRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [agentOutput, loading, bottomTab, bottomExpanded]);

  useEffect(() => {
    if (agentError && agentError !== prevAgentErrorRef.current) {
      setBottomExpanded(true);
      setBottomTab('problems');
    }
    prevAgentErrorRef.current = agentError;
  }, [agentError]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.shiftKey && e.code === 'Slash') {
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen(false);
        setQuickOpen(false);
        setGoToLineOpen(false);
        setShortcutsOpen(true);
        return;
      }

      if (mod && e.key.toLowerCase() === 'p' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen(false);
        setShortcutsOpen(false);
        setGoToLineOpen(false);
        setQuickOpen((o) => !o);
        return;
      }

      if (mod && e.key.toLowerCase() === 'k' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setQuickOpen(false);
        setShortcutsOpen(false);
        setGoToLineOpen(false);
        setPaletteOpen(true);
        return;
      }

      if (paletteOpenRef.current) return;
      if (quickOpenRef.current) return;
      if (shortcutsOpenRef.current) return;
      if (goToLineOpenRef.current) return;

      if (mod && e.key.toLowerCase() === 'w' && !e.shiftKey && !e.altKey) {
        const t = activePathRef.current;
        if (!t) return;
        e.preventDefault();
        e.stopPropagation();
        closeTabRef.current(t);
        return;
      }

      if (mod && e.key === 'Tab') {
        const paths = openTabsRef.current;
        if (paths.length < 2) return;
        e.preventDefault();
        e.stopPropagation();
        const i = paths.indexOf(activePathRef.current);
        const idx = i < 0 ? 0 : i;
        const next = e.shiftKey
          ? paths[(idx - 1 + paths.length) % paths.length]
          : paths[(idx + 1) % paths.length];
        if (next) setActivePath(next);
        return;
      }

      if (zenModeRef.current && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setZenMode(false);
        return;
      }

      if (mod && e.altKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        setZenMode((z) => !z);
        return;
      }

      if (mod && e.altKey && e.key.toLowerCase() === 'm' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        setMinimapEnabled((v) => !v);
        return;
      }

      if (mod && e.key.toLowerCase() === 'g' && !e.shiftKey && !e.altKey) {
        if (!monacoEditorRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        setGoToLineOpen(true);
        return;
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === 'f' && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setSidebarOpen(true);
        setActivityView('search');
        return;
      }

      if (mod && e.key.toLowerCase() === 'f' && !e.shiftKey && !e.altKey) {
        const ed = monacoEditorRef.current;
        if (!ed) return;
        e.preventDefault();
        e.stopPropagation();
        ed.focus();
        void ed.getAction('actions.find')?.run();
        return;
      }

      if (mod && e.key.toLowerCase() === 'h' && !e.shiftKey && !e.altKey) {
        const ed = monacoEditorRef.current;
        if (!ed) return;
        e.preventDefault();
        e.stopPropagation();
        ed.focus();
        void ed.getAction('editor.action.startFindReplaceAction')?.run();
        return;
      }

      if (mod && (e.key === 'PageDown' || e.key === 'PageUp')) {
        const paths = openTabsRef.current;
        if (paths.length < 2) return;
        e.preventDefault();
        e.stopPropagation();
        const i = paths.indexOf(activePathRef.current);
        const idx = i < 0 ? 0 : i;
        const next =
          e.key === 'PageDown'
            ? paths[(idx + 1) % paths.length]
            : paths[(idx - 1 + paths.length) % paths.length];
        if (next) setActivePath(next);
        return;
      }

      if (mod && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const paths = openTabsRef.current;
        const n = parseInt(e.key, 10) - 1;
        if (paths[n]) {
          e.preventDefault();
          e.stopPropagation();
          setActivePath(paths[n]!);
          return;
        }
      }

      if (mod && !e.shiftKey && !e.altKey && monacoEditorRef.current) {
        const ed = monacoEditorRef.current;
        if (e.code === 'Equal' || e.code === 'NumpadAdd') {
          e.preventDefault();
          e.stopPropagation();
          void ed.getAction('editor.action.fontZoomIn')?.run();
          return;
        }
        if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          e.stopPropagation();
          void ed.getAction('editor.action.fontZoomOut')?.run();
          return;
        }
        if (e.code === 'Digit0' || e.code === 'Numpad0') {
          e.preventDefault();
          e.stopPropagation();
          void ed.getAction('editor.action.fontZoomReset')?.run();
          return;
        }
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen(true);
        return;
      }
      if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen(true);
        return;
      }
      if (mod && e.key.toLowerCase() === 'b' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setSidebarOpen((v) => !v);
        return;
      }
      if (mod && e.key === '`' && !e.shiftKey) {
        e.preventDefault();
        setBottomExpanded((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const revealInExplorer = useCallback((path: string) => {
    setActivityView('explorer');
    setSidebarOpen(true);
    const segments = path.split('/').filter(Boolean);
    if (segments.length > 1) {
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        for (let i = 1; i < segments.length; i++) {
          next.add(segments.slice(0, i).join('/'));
        }
        return next;
      });
    }
  }, []);

  const onExplorerFileContextMenu = useCallback(
    (path: string, _name: string, e: ReactMouseEvent) => {
      e.preventDefault();
      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          { id: 'ctx-nf', label: 'New File', disabled: true, onSelect: () => {} },
          { id: 'ctx-nd', label: 'New Folder', disabled: true, onSelect: () => {} },
          { id: 'ctx-rn', label: 'Rename', disabled: true, onSelect: () => {} },
          { id: 'ctx-del', label: 'Delete', disabled: true, onSelect: () => {} },
          {
            id: 'ctx-rev',
            label: 'Reveal in Explorer',
            onSelect: () => {
              revealInExplorer(path);
              setSelectedExplorerPath(path);
            },
          },
        ],
      });
    },
    [revealInExplorer],
  );

  const revealAgentStreamTab = useCallback(() => {
    setOpenTabs((prev) => (prev.includes(AGENT_STREAM_PATH) ? prev : [...prev, AGENT_STREAM_PATH]));
    setActivePath(AGENT_STREAM_PATH);
  }, []);

  const pinTab = useCallback((path: string) => {
    setBuffers((prev) => {
      const b = prev[path];
      if (!b || b.pinned) return prev;
      return { ...prev, [path]: { ...b, pinned: true } };
    });
    setPreviewTabPath((pv) => (pv === path ? null : pv));
  }, []);

  const openFile = useCallback(
    (path: string, name: string, opts?: { newTab?: boolean }) => {
      const newTab = Boolean(opts?.newTab);
      if (path === AGENT_STREAM_PATH) {
        revealAgentStreamTab();
        return;
      }
      const known = DEMO_BUFFERS[path];
      if (!known) return;

      setBuffers((prev) => {
        if (prev[path]) return prev;
        return {
          ...prev,
          [path]: {
            path,
            name,
            language: known.language,
            content: known.content,
            isDirty: false,
            pinned: newTab,
          },
        };
      });

      const prevTabs = openTabsRef.current;
      const prevBufs = buffersRef.current;
      if (prevTabs.includes(path)) {
        setActivePath(path);
        setSelectedExplorerPath(path);
        return;
      }

      let nextTabs: string[];
      let nextPreview: string | null;
      if (newTab) {
        nextTabs = [...prevTabs, path];
        nextPreview = null;
      } else {
        const pv = previewTabPathRef.current;
        const b = pv ? prevBufs[pv] : undefined;
        const canReplace =
          Boolean(pv) &&
          prevTabs.includes(pv!) &&
          Boolean(b) &&
          !b!.pinned &&
          !b!.isDirty &&
          pv !== AGENT_STREAM_PATH;
        if (canReplace && pv) {
          const i = prevTabs.indexOf(pv);
          nextTabs = [...prevTabs];
          nextTabs[i] = path;
          nextPreview = path;
        } else {
          nextTabs = [...prevTabs, path];
          nextPreview = path;
        }
      }

      setOpenTabs(nextTabs);
      setPreviewTabPath(nextPreview);
      setActivePath(path);
      setSelectedExplorerPath(path);
    },
    [revealAgentStreamTab],
  );

  const closeTab = useCallback((path: string, e?: ReactMouseEvent) => {
    e?.stopPropagation();
    if (openTabsRef.current.length <= 1) return;
    if (previewTabPathRef.current === path) setPreviewTabPath(null);
    setOpenTabs((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((p) => p !== path);
      if (activePathRef.current === path) {
        const idx = prev.indexOf(path);
        const fallback = next[Math.max(0, idx - 1)] ?? next[0] ?? '';
        setActivePath(fallback);
      }
      return next;
    });
  }, []);

  closeTabRef.current = closeTab;

  const onTabContextMenu = useCallback(
    (path: string, e: ReactMouseEvent) => {
      e.preventDefault();
      const buf = buffersRef.current[path];
      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            id: 'ctx-pin',
            label: buf?.pinned ? 'Pinned' : 'Pin Tab',
            disabled: Boolean(buf?.pinned),
            onSelect: () => pinTab(path),
          },
          { id: 'ctx-close', label: 'Close', onSelect: () => closeTab(path) },
          {
            id: 'ctx-close-others',
            label: 'Close Others',
            onSelect: () => {
              setPreviewTabPath(null);
              setOpenTabs([path]);
              setActivePath(path);
            },
          },
          {
            id: 'ctx-tab-rev',
            label: 'Reveal in Explorer',
            disabled: !DEMO_BUFFERS[path],
            onSelect: () => {
              if (DEMO_BUFFERS[path]) {
                revealInExplorer(path);
                setSelectedExplorerPath(path);
              }
            },
          },
        ],
      });
    },
    [pinTab, closeTab, revealInExplorer],
  );

  const onSaveViewState = useCallback((p: string, state: editor.ICodeEditorViewState | null) => {
    setEditorViewStates((prev) => ({ ...prev, [p]: state }));
  }, []);

  const onEditorChange = useCallback(
    (value: string) => {
      if (activePath === AGENT_STREAM_PATH) return;
      setBuffers((prev) => {
        const cur = prev[activePath];
        if (!cur) return prev;
        const baseline = DEMO_BUFFERS[activePath]?.content ?? '';
        return {
          ...prev,
          [activePath]: { ...cur, content: value, isDirty: value !== baseline },
        };
      });
    },
    [activePath],
  );

  const focusComposer = useCallback(() => {
    document.querySelector<HTMLTextAreaElement>('[data-composer-mission]')?.focus();
  }, []);

  const handleAfterPaletteRun = useCallback((id: string) => {
    recordRecentCommandId(id);
    setRecentCommandIds(loadRecentCommandIds());
  }, []);

  const paletteItems = useMemo((): PaletteItem[] => {
    const items: PaletteItem[] = [
      {
        id: 'palette-quick-open',
        label: 'File: Quick Open',
        shortcut: accel('Ctrl+P'),
        section: 'Files',
        onSelect: () => setQuickOpen(true),
      },
      {
        id: 'palette-readme',
        label: 'File: Open README.md',
        section: 'Files',
        onSelect: () => openFile(DEFAULT_OPEN_PATH, 'README.md'),
      },
      {
        id: 'palette-plan',
        label: 'File: Open PLAN.md',
        section: 'Files',
        onSelect: () => openFile('web-demo/PLAN.md', 'PLAN.md'),
      },
      {
        id: 'palette-page',
        label: 'File: Open dashboard page.tsx',
        section: 'Files',
        onSelect: () => openFile('web-demo/apps/web/dashboard/page.tsx', 'page.tsx'),
      },
      {
        id: 'palette-go-line',
        label: 'Editor: Go to Line',
        shortcut: accel('Ctrl+G'),
        section: 'Editor',
        onSelect: () => {
          if (monacoEditorRef.current) setGoToLineOpen(true);
        },
      },
      {
        id: 'palette-find',
        label: 'Editor: Find',
        shortcut: accel('Ctrl+F'),
        section: 'Editor',
        onSelect: () => {
          const ed = monacoEditorRef.current;
          if (!ed) return;
          ed.focus();
          void ed.getAction('actions.find')?.run();
        },
      },
      {
        id: 'palette-replace',
        label: 'Editor: Replace',
        shortcut: accel('Ctrl+H'),
        section: 'Editor',
        onSelect: () => {
          const ed = monacoEditorRef.current;
          if (!ed) return;
          ed.focus();
          void ed.getAction('editor.action.startFindReplaceAction')?.run();
        },
      },
      {
        id: 'palette-zoom-reset',
        label: 'Editor: Reset zoom',
        shortcut: accel('Ctrl+0'),
        section: 'Editor',
        onSelect: () => void monacoEditorRef.current?.getAction('editor.action.fontZoomReset')?.run(),
      },
      {
        id: 'palette-zen',
        label: 'View: Toggle Zen Mode',
        shortcut: accel('Ctrl+Alt+Z'),
        section: 'View',
        detail: 'Hide chrome — Esc to exit',
        onSelect: () => setZenMode((z) => !z),
      },
      {
        id: 'palette-minimap',
        label: 'View: Toggle Minimap',
        shortcut: accel('Ctrl+Alt+M'),
        section: 'View',
        onSelect: () => setMinimapEnabled((v) => !v),
      },
      {
        id: 'palette-problems',
        label: 'View: Show Problems',
        section: 'View',
        detail: 'Agent / API errors',
        onSelect: () => {
          setBottomExpanded(true);
          setBottomTab('problems');
        },
      },
      {
        id: 'palette-sidebar',
        label: 'View: Toggle Primary Side Bar',
        shortcut: accel('Ctrl+B'),
        section: 'View',
        onSelect: () => setSidebarOpen((v) => !v),
      },
      {
        id: 'palette-panel',
        label: 'View: Toggle Panel',
        shortcut: accel('Ctrl+`'),
        section: 'View',
        onSelect: () => setBottomExpanded((v) => !v),
      },
      {
        id: 'palette-output-tab',
        label: 'View: Show Output',
        section: 'View',
        detail: 'Bottom panel',
        onSelect: () => {
          setBottomExpanded(true);
          setBottomTab('output');
        },
      },
      {
        id: 'palette-composer',
        label: 'View: Focus Composer',
        section: 'View',
        onSelect: () => focusComposer(),
      },
      {
        id: 'palette-explorer',
        label: 'View: Show Explorer',
        section: 'View',
        onSelect: () => {
          setActivityView('explorer');
          setSidebarOpen(true);
        },
      },
      {
        id: 'palette-search',
        label: 'View: Show Search',
        section: 'View',
        onSelect: () => {
          setActivityView('search');
          setSidebarOpen(true);
        },
      },
      {
        id: 'palette-agent-tab',
        label: 'View: Open Agent stream',
        section: 'View',
        detail: AGENT_STREAM_PATH,
        onSelect: () => revealAgentStreamTab(),
      },
      {
        id: 'palette-shortcuts',
        label: 'Help: Keyboard Shortcuts',
        shortcut: accel('Ctrl+Shift+/'),
        section: 'Help',
        onSelect: () => setShortcutsOpen(true),
      },
      {
        id: 'palette-signin',
        label: 'Account: Open sign in',
        section: 'Account',
        onSelect: () => void router.push('/sign-in'),
      },
    ];
    if (onClearAgentOutput) {
      items.push({
        id: 'palette-clear-agent',
        label: 'Agent: Clear output and errors',
        section: 'Agent',
        onSelect: () => onClearAgentOutput(),
      });
    }
    return items;
  }, [focusComposer, onClearAgentOutput, openFile, revealAgentStreamTab, router]);

  const onTabKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (openTabs.length === 0) return;
      const key = e.key;
      if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
      e.preventDefault();
      const i = openTabs.indexOf(activePath);
      let nextIdx = i < 0 ? 0 : i;
      if (key === 'ArrowRight') nextIdx = Math.min(openTabs.length - 1, nextIdx + 1);
      else if (key === 'ArrowLeft') nextIdx = Math.max(0, nextIdx - 1);
      else if (key === 'Home') nextIdx = 0;
      else if (key === 'End') nextIdx = openTabs.length - 1;
      const p = openTabs[nextIdx];
      if (p) setActivePath(p);
    },
    [openTabs, activePath],
  );

  const statusLabel = useMemo((): ReactNode => {
    if (loading) {
      return <span className="wb-status-stream wb-status-stream-quiet">Agent</span>;
    }
    if (agentError) return 'Error';
    if (agentOutput.trim()) return 'Ready';
    return 'Ready';
  }, [loading, agentError, agentOutput]);

  const goSignIn = useCallback(() => {
    void router.push('/sign-in');
  }, [router]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      runWorkbenchLayoutAssertions(wbAppRef.current);
    });
    return () => cancelAnimationFrame(id);
  }, [
    activityView,
    bottomExpanded,
    bottomH,
    composerW,
    layoutDragging,
    sidebarOpen,
    sidebarW,
    zenMode,
  ]);

  return (
    <div
      ref={wbAppRef}
      className={`wb-app${zenMode ? ' wb-app-zen' : ''}${layoutDragging ? ' wb-app-layout-drag' : ''}`}
    >
      <div className="wb-body">
        <nav className="wb-activity-bar activity-bar" role="toolbar" aria-label="Side bar views">
          <div className="wb-activity-top">
            <button
              type="button"
              className={`wb-activity-btn activity-button ${activityView === 'explorer' ? 'wb-activity-btn-active activity-button-active' : ''}`}
              title={`Explorer (${accel('Ctrl+B')})`}
              aria-pressed={activityView === 'explorer'}
              onClick={() => {
                setActivityView('explorer');
                setSidebarOpen(true);
              }}
            >
              <span className="wb-activity-icon" aria-hidden>
                <IconExplorer />
              </span>
            </button>
            <button
              type="button"
              className={`wb-activity-btn activity-button ${activityView === 'search' ? 'wb-activity-btn-active activity-button-active' : ''}`}
              title={`Search (${accel('Ctrl+Shift+F')})`}
              aria-pressed={activityView === 'search'}
              onClick={() => {
                setActivityView('search');
                setSidebarOpen(true);
              }}
            >
              <span className="wb-activity-icon" aria-hidden>
                <IconSearch />
              </span>
            </button>
            <button
              type="button"
              className={`wb-activity-btn activity-button ${activityView === 'scm' ? 'wb-activity-btn-active activity-button-active' : ''}`}
              title="Source Control"
              aria-pressed={activityView === 'scm'}
              onClick={() => {
                setActivityView('scm');
                setSidebarOpen(true);
              }}
            >
              <span className="wb-activity-icon" aria-hidden>
                <IconSourceControl />
              </span>
            </button>
            <button type="button" className="wb-activity-btn activity-button" disabled title="Run and Debug (desktop)" aria-disabled tabIndex={-1}>
              <span className="wb-activity-icon" aria-hidden>
                <IconRunDebug />
              </span>
            </button>
            <button type="button" className="wb-activity-btn activity-button" disabled title="Extensions (desktop)" aria-disabled tabIndex={-1}>
              <span className="wb-activity-icon" aria-hidden>
                <IconExtensions />
              </span>
            </button>
          </div>
          <div className="wb-activity-spacer" aria-hidden />
          <div className="wb-activity-bottom">
            <button
              type="button"
              className="wb-activity-btn activity-button wb-activity-account"
              title={isClerkEnabled() ? 'Account' : 'Account (enable Clerk in .env)'}
              aria-label="Account"
              onClick={goSignIn}
            >
              <span className="wb-activity-icon" aria-hidden>
                <IconAccount />
              </span>
            </button>
            <button
              type="button"
              className="wb-activity-btn activity-button"
              title={`Keyboard shortcuts (${accel('Ctrl+Shift+/')})`}
              aria-label="Keyboard shortcuts"
              onClick={() => setShortcutsOpen(true)}
            >
              <span className="wb-activity-icon" aria-hidden>
                <IconSettings />
              </span>
            </button>
          </div>
        </nav>

        <div
          className="wb-sidebar-shell"
          style={{
            width: sidebarOpen ? sidebarW + 4 : 0,
            transition: layoutDragging ? 'none' : 'width 120ms ease-out',
            overflow: 'hidden',
            display: 'flex',
            flexShrink: 0,
            minWidth: 0,
          }}
          aria-hidden={!sidebarOpen}
        >
          <aside
            className={`wb-sidebar${activityView === 'explorer' ? ' explorer' : ''}`}
            style={{ width: sidebarW, minWidth: sidebarW, flexShrink: 0 }}
            role="complementary"
            aria-label={
              activityView === 'explorer' ? 'Explorer' : activityView === 'search' ? 'Search' : 'Source control'
            }
          >
              {activityView === 'explorer' ? (
                <div className="wb-file-tree">
                  <div className="wb-sidebar-view-header">
                    <span className="wb-sidebar-heading">Explorer</span>
                    <div className="wb-sidebar-view-actions">
                      <button type="button" className="wb-sidebar-icon-btn" disabled title="Views and more actions">
                        ⋯
                      </button>
                      <button
                        type="button"
                        className="wb-sidebar-icon-btn"
                        title="Hide side bar"
                        aria-label="Hide side bar"
                        onClick={() => setSidebarOpen(false)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="wb-file-tree-sub">
                    <span className="wb-project-name" title={WEB_DEMO_PROJECT_NAME}>
                      {WEB_DEMO_PROJECT_NAME}
                    </span>
                  </div>
                  <div className="wb-open-editors">
                    <div className="wb-open-editors-label">Open editors</div>
                    <ul className="wb-open-editors-list">
                      {openTabs.map((path) => {
                        const buf = buffers[path];
                        const label = buf?.name ?? path;
                        const dirty = buf?.isDirty;
                        return (
                          <li key={path}>
                            <div
                              className={`wb-open-editor-row ${path === activePath ? 'wb-open-editor-row-active' : ''}`}
                            >
                              <button
                                type="button"
                                className="wb-open-editor-main"
                                onClick={() => {
                                  setActivePath(path);
                                  if (DEMO_BUFFERS[path]) setSelectedExplorerPath(path);
                                }}
                              >
                                <span className="wb-open-editor-icon" aria-hidden>
                                  <IconFile />
                                </span>
                                <span className="wb-open-editor-name">
                                  {dirty ? <span className="wb-open-editor-dirty">● </span> : null}
                                  {label}
                                </span>
                              </button>
                              <button
                                type="button"
                                className="wb-open-editor-close"
                                aria-label={`Close ${label}`}
                                tabIndex={-1}
                                onClick={(ev) => closeTab(path, ev)}
                              >
                                ×
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div
                    className="wb-file-tree-scroll"
                    ref={explorerTreeRef}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (activityView !== 'explorer') return;
                      const list = visibleExplorerFiles;
                      if (list.length === 0) return;
                      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        let idx = list.findIndex((f) => f.path === selectedExplorerPath);
                        if (idx < 0) idx = 0;
                        else
                          idx =
                            e.key === 'ArrowDown'
                              ? Math.min(list.length - 1, idx + 1)
                              : Math.max(0, idx - 1);
                        const row = list[idx];
                        if (row) setSelectedExplorerPath(row.path);
                        return;
                      }
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const row = list.find((f) => f.path === selectedExplorerPath) ?? list[0];
                        if (row) openFile(row.path, row.name);
                      }
                    }}
                  >
                    <DemoTree
                      nodes={DEMO_FILE_TREE}
                      depth={0}
                      expanded={expandedDirs}
                      toggleDir={toggleDir}
                      activeFile={activePath}
                      selectedFile={selectedExplorerPath}
                      onFileSelect={(path, _name) => setSelectedExplorerPath(path)}
                      onFileOpen={openFile}
                      onFileContextMenu={onExplorerFileContextMenu}
                    />
                  </div>
                </div>
              ) : activityView === 'search' ? (
                <div className="wb-search-sidebar">
                  <div className="wb-sidebar-view-header">
                    <span className="wb-sidebar-heading">Search</span>
                    <div className="wb-sidebar-view-actions">
                      <button type="button" className="wb-sidebar-icon-btn" disabled>
                        ⋯
                      </button>
                      <button
                        type="button"
                        className="wb-sidebar-icon-btn"
                        title="Hide side bar"
                        aria-label="Hide side bar"
                        onClick={() => setSidebarOpen(false)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <WebSearchPanel onOpenFile={openFile} />
                </div>
              ) : (
                <div className="wb-scm-panel">
                  <div className="wb-sidebar-view-header">
                    <span className="wb-sidebar-heading">Source control</span>
                    <div className="wb-sidebar-view-actions">
                      <button type="button" className="wb-sidebar-icon-btn" disabled>
                        ⋯
                      </button>
                      <button
                        type="button"
                        className="wb-sidebar-icon-btn"
                        title="Hide side bar"
                        aria-label="Hide side bar"
                        onClick={() => setSidebarOpen(false)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="wb-scm-hint">Source control is not available in this shell.</p>
                </div>
              )}
            </aside>
          <div
            className="wb-resize-v wb-resize-v-sidebar"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize side bar"
            onMouseDown={beginSidebarResize}
          />
        </div>

        <div className="wb-main" role="main">
          <div
            className="wb-tab-bar"
            role={openTabs.length ? 'tablist' : undefined}
            aria-label="Open editors"
            onKeyDown={onTabKeyDown}
          >
            {openTabs.map((path) => {
              const buf = buffers[path];
              const label = buf?.name ?? path;
              const dirty = buf?.isDirty ? '● ' : '';
              const isPreview = Boolean(previewTabPath === path && !buf?.pinned);
              return (
                <div
                  key={path}
                  role="tab"
                  tabIndex={path === activePath ? 0 : -1}
                  aria-selected={path === activePath}
                  className={`wb-tab ${path === activePath ? 'wb-tab-active' : ''}${isPreview ? ' wb-tab-preview' : ''}`}
                  onClick={() => {
                    setActivePath(path);
                    if (DEMO_BUFFERS[path]) setSelectedExplorerPath(path);
                  }}
                  onDoubleClick={(ev) => {
                    ev.preventDefault();
                    pinTab(path);
                  }}
                  onAuxClick={(ev) => {
                    if (ev.button === 1) {
                      ev.preventDefault();
                      closeTab(path, ev);
                    }
                  }}
                  onContextMenu={(ev) => onTabContextMenu(path, ev)}
                >
                  <span className="wb-tab-file-icon" aria-hidden>
                    <IconFile />
                  </span>
                  <span className="wb-tab-name">
                    {dirty}
                    {label}
                  </span>
                  <button
                    type="button"
                    className="wb-tab-close"
                    tabIndex={-1}
                    aria-label={`Close ${label}`}
                    onClick={(ev) => closeTab(path, ev)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {activeBuffer ? <EditorBreadcrumb path={activePath} /> : null}

          <div className="wb-editor-stack">
            <div className="wb-editor-host">
              {activeBuffer ? (
                <WebMonacoPane
                  path={activeBuffer.path}
                  language={activeBuffer.language}
                  value={activeBuffer.content}
                  readOnly={activeBuffer.path === AGENT_STREAM_PATH}
                  minimapEnabled={minimapEnabled}
                  savedViewState={editorViewStates[activeBuffer.path] ?? null}
                  onSaveViewState={onSaveViewState}
                  onChange={onEditorChange}
                  onEditorReady={onMonacoReady}
                  onCursorPositionChange={onCursorPositionChange}
                />
              ) : (
                <div className="wb-welcome">
                  <p className="wb-welcome-lead">No editor open</p>
                  <p className="wb-welcome-hint muted">
                    {accel('Ctrl+P')} · {accel('Ctrl+K')}
                  </p>
                </div>
              )}
            </div>

            {bottomExpanded ? (
              <div
                className="wb-resize-h"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize bottom panel"
                onMouseDown={beginPanelResize}
              />
            ) : null}

            {bottomExpanded ? (
              <div
                className="wb-bottom bottom-panel"
                style={{ flex: `0 0 ${bottomH}px`, minHeight: 52, maxHeight: 'min(50vh, 400px)' }}
                role="region"
                aria-label="Panel"
              >
                <div className="wb-bottom-tabs bottom-tabs">
                  <button
                    type="button"
                    className={`wb-bottom-tab bottom-tab ${bottomTab === 'output' ? 'wb-bottom-tab-active bottom-tab-active' : ''}`}
                    onClick={() => setBottomTab('output')}
                  >
                    Output
                  </button>
                  <button
                    type="button"
                    className={`wb-bottom-tab bottom-tab ${bottomTab === 'terminal' ? 'wb-bottom-tab-active bottom-tab-active' : ''}`}
                    onClick={() => setBottomTab('terminal')}
                  >
                    Terminal
                  </button>
                  <button
                    type="button"
                    className={`wb-bottom-tab bottom-tab ${bottomTab === 'problems' ? 'wb-bottom-tab-active bottom-tab-active' : ''} ${agentError ? 'wb-bottom-tab-warn' : ''}`}
                    onClick={() => setBottomTab('problems')}
                  >
                    Problems
                    {problemTotalLines > 0 ? (
                      <span className="wb-bottom-tab-badge">
                        {problemTotalLines > 99 ? '99+' : problemTotalLines}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="wb-bottom-collapse"
                    title={`Hide panel (${accel('Ctrl+`')})`}
                    aria-label="Hide panel"
                    onClick={() => setBottomExpanded(false)}
                  >
                    ▾
                  </button>
                </div>
                <div className="wb-bottom-body" ref={bottomBodyRef}>
                  {bottomTab === 'output' ? (
                    <>
                      {agentError ? <div className="wb-output-error">{agentError}</div> : null}
                      {agentOutput ? (
                        <pre className="wb-output-pre">{agentOutput}</pre>
                      ) : (
                        <p className="wb-output-empty">{loading ? 'Receiving…' : 'No output.'}</p>
                      )}
                    </>
                  ) : bottomTab === 'problems' ? (
                    <div className="wb-problems" role="region" aria-label="Problems">
                      {problemRows.length > 0 ? (
                        <ul className="wb-problems-list">
                          {problemRows.map((msg, i) => (
                            <li key={`${i}-${msg.slice(0, 24)}`} className="wb-problem-row">
                              <span className="wb-problem-icon" aria-hidden>
                                ✕
                              </span>
                              <div className="wb-problem-body">
                                <div className="wb-problem-msg">{msg}</div>
                                {i === 0 ? (
                                  <div className="wb-problem-src">agent</div>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="wb-problems-empty">No problems detected.</p>
                      )}
                    </div>
                  ) : (
                    <div className="wb-terminal-placeholder">
                      <p>No integrated terminal.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="wb-bottom-restore"
                onClick={() => setBottomExpanded(true)}
                title={`Show panel (${accel('Ctrl+`')})`}
              >
                Output / Terminal ▴
              </button>
            )}
          </div>
        </div>

        <div
          className="wb-resize-v"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize composer"
          onMouseDown={beginComposerResize}
        />
        <aside className="wb-composer composer" style={{ width: composerW }} aria-label="Composer">
          {composer}
        </aside>
      </div>

      <footer className="wb-status-bar statusbar" role="contentinfo">
        <div className="wb-status-left">
          <button
            type="button"
            className="wb-status-btn wb-status-icononly"
            title={`Toggle primary side bar (${accel('Ctrl+B')})`}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ☰
          </button>
          <span className="wb-status-item wb-status-remote" title="Remote (demo)">
            ⟨⟩
          </span>
          <span className="wb-status-item wb-status-branch" title="Git branch (demo)">
            <span className="wb-status-branch-icon" aria-hidden>
              ⑂
            </span>
            main
          </span>
          {problemTotalLines > 0 ? (
            <button
              type="button"
              className="wb-status-item wb-status-errors"
              title="Show problems"
              onClick={() => {
                setBottomExpanded(true);
                setBottomTab('problems');
              }}
            >
              <span aria-hidden>✕</span> {problemTotalLines > 99 ? '99+' : problemTotalLines}
            </button>
          ) : (
            <span className="wb-status-item wb-status-errors wb-status-errors-clear" title="No problems">
              <span aria-hidden>✕</span> 0
            </span>
          )}
          <span className="wb-status-sep-bar" aria-hidden />
          <span className="wb-status-project">{WEB_DEMO_PROJECT_NAME}</span>
          {activeBuffer ? (
            <span className="wb-status-file" title={activeBuffer.path}>
              {activeBuffer.name}
              {activeBuffer.isDirty ? ' ●' : ''}
            </span>
          ) : null}
        </div>
        <div className="wb-status-center">
          <span className="wb-status-agent" role="status">
            {statusLabel}
          </span>
        </div>
        <div className="wb-status-right">
          <span className="wb-status-editor-meta" aria-label="Editor status">
            <span className="wb-status-ln">
              Ln {cursorLine}, Col {cursorCol}
            </span>
            <span className="wb-status-sep" aria-hidden>
              {' '}
              ·{' '}
            </span>
            <span className="wb-status-encoding">UTF-8</span>
            <span className="wb-status-sep" aria-hidden>
              {' '}
              ·{' '}
            </span>
            <span className="wb-status-eol">LF</span>
            <span className="wb-status-sep" aria-hidden>
              {' '}
              ·{' '}
            </span>
            <span className="wb-status-lang">{activeBuffer?.language ?? 'Plain Text'}</span>
          </span>
        </div>
      </footer>

      <WebCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
        recentIds={recentCommandIds}
        onAfterRun={handleAfterPaletteRun}
      />
      <WebQuickOpen
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        entries={quickOpenEntries}
        onPick={(path, name, opts) => openFile(path, name, { newTab: Boolean(opts?.openInNewTab) })}
      />
      <WebKeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <WebGoToLine
        open={goToLineOpen}
        onClose={() => setGoToLineOpen(false)}
        defaultLine={cursorLine}
        defaultColumn={cursorCol}
        onSubmit={applyGoToLine}
      />
      {zenMode ? (
        <button type="button" className="wb-zen-exit" onClick={() => setZenMode(false)} title="Exit zen mode">
          Exit zen · Esc
        </button>
      ) : null}
      <WebContextMenu
        open={Boolean(ctxMenu)}
        x={ctxMenu?.x ?? 0}
        y={ctxMenu?.y ?? 0}
        items={ctxMenu?.items ?? []}
        onClose={() => setCtxMenu(null)}
      />
    </div>
  );
}
