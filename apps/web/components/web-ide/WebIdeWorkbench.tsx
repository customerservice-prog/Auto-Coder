'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { editor } from 'monaco-editor';
import { isClerkEnabled } from '@/lib/clerk-enabled';
import { WebMonacoPane } from '@/components/web-ide/WebMonacoPane';
import { WebCommandPalette, type PaletteItem } from '@/components/web-ide/WebCommandPalette';
import { WebQuickOpen } from '@/components/web-ide/WebQuickOpen';
import { WebKeyboardShortcutsModal } from '@/components/web-ide/WebKeyboardShortcutsModal';
import { WebGoToLine } from '@/components/web-ide/WebGoToLine';
import { formatModShortcut as accel } from '@/components/web-ide/keyboard-accel';
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

type ActivityView = 'explorer' | 'search';
type BottomTab = 'output' | 'terminal' | 'problems';

interface OpenBuffer {
  path: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
}

function buildInitialBuffers(): Record<string, OpenBuffer> {
  const out: Record<string, OpenBuffer> = {};
  for (const [p, b] of Object.entries(DEMO_BUFFERS)) {
    out[p] = { path: p, name: b.name, language: b.language, content: b.content, isDirty: false };
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
  onFileOpen: (path: string, name: string) => void;
}) {
  const { nodes, depth, expanded, toggleDir, activeFile, onFileOpen } = props;
  return (
    <>
      {nodes.map((node) => (
        <div key={node.path}>
          {node.type === 'directory' ? (
            <>
              <button
                type="button"
                className="wb-tree-row"
                style={{ paddingLeft: 8 + depth * 12 }}
                onClick={() => toggleDir(node.path)}
              >
                <span className="wb-tree-chevron" aria-hidden>
                  {expanded.has(node.path) ? '▼' : '▶'}
                </span>
                <span className="wb-tree-icon" aria-hidden>
                  📁
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
                  onFileOpen={onFileOpen}
                />
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className={`wb-tree-row wb-tree-file ${activeFile === node.path ? 'wb-tree-active' : ''}`}
              style={{ paddingLeft: 8 + depth * 12 }}
              onClick={() => onFileOpen(node.path, node.name)}
            >
              <span className="wb-tree-chevron wb-tree-chevron-spacer" aria-hidden />
              <span className="wb-tree-icon" aria-hidden>
                📄
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
  const [bottomExpanded, setBottomExpanded] = useState(true);
  const [bottomTab, setBottomTab] = useState<BottomTab>('output');
  const [minimapEnabled, setMinimapEnabled] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const prevAgentErrorRef = useRef<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [goToLineOpen, setGoToLineOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const paletteOpenRef = useRef(false);
  const quickOpenRef = useRef(false);
  const shortcutsOpenRef = useRef(false);
  const goToLineOpenRef = useRef(false);
  const zenModeRef = useRef(false);
  const openTabsRef = useRef(openTabs);
  const activePathRef = useRef(activePath);
  const monacoEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  paletteOpenRef.current = paletteOpen;
  quickOpenRef.current = quickOpen;
  shortcutsOpenRef.current = shortcutsOpen;
  goToLineOpenRef.current = goToLineOpen;
  zenModeRef.current = zenMode;
  openTabsRef.current = openTabs;
  activePathRef.current = activePath;

  const quickOpenEntries = useMemo(() => listQuickOpenDemoFiles(), []);

  const { rows: problemRows, totalLines: problemTotalLines } = useMemo(
    () => problemRowsFromAgentError(agentError),
    [agentError],
  );

  const activeBuffer = buffers[activePath];

  useEffect(() => {
    setCursorLine(1);
    setCursorCol(1);
  }, [activePath]);

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

      if (paletteOpenRef.current) return;
      if (quickOpenRef.current) return;
      if (shortcutsOpenRef.current) return;
      if (goToLineOpenRef.current) return;

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

  const revealAgentStreamTab = useCallback(() => {
    setOpenTabs((prev) => (prev.includes(AGENT_STREAM_PATH) ? prev : [...prev, AGENT_STREAM_PATH]));
    setActivePath(AGENT_STREAM_PATH);
  }, []);

  const openFile = useCallback(
    (path: string, name: string) => {
      if (path === AGENT_STREAM_PATH) {
        revealAgentStreamTab();
        return;
      }
      const known = DEMO_BUFFERS[path];
      setBuffers((prev) => {
        if (prev[path]) return prev;
        if (!known) return prev;
        return {
          ...prev,
          [path]: {
            path,
            name,
            language: known.language,
            content: known.content,
            isDirty: false,
          },
        };
      });
      setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setActivePath(path);
    },
    [revealAgentStreamTab],
  );

  const closeTab = useCallback(
    (path: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setOpenTabs((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((p) => p !== path);
        if (activePath === path) {
          const idx = prev.indexOf(path);
          const fallback = next[Math.max(0, idx - 1)] ?? next[0] ?? '';
          setActivePath(fallback);
        }
        return next;
      });
    },
    [activePath],
  );

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

  const paletteItems = useMemo((): PaletteItem[] => {
    const items: PaletteItem[] = [
      {
        id: 'palette-quick-open',
        label: 'File: Quick Open',
        shortcut: accel('Ctrl+P'),
        onSelect: () => setQuickOpen(true),
      },
      {
        id: 'palette-go-line',
        label: 'Editor: Go to Line',
        shortcut: accel('Ctrl+G'),
        onSelect: () => {
          if (monacoEditorRef.current) setGoToLineOpen(true);
        },
      },
      {
        id: 'palette-find',
        label: 'Editor: Find',
        shortcut: accel('Ctrl+F'),
        onSelect: () => {
          const ed = monacoEditorRef.current;
          if (!ed) return;
          ed.focus();
          void ed.getAction('actions.find')?.run();
        },
      },
      {
        id: 'palette-shortcuts',
        label: 'Help: Keyboard Shortcuts',
        shortcut: accel('Ctrl+Shift+/'),
        onSelect: () => setShortcutsOpen(true),
      },
      {
        id: 'palette-zen',
        label: 'View: Toggle Zen Mode',
        shortcut: accel('Ctrl+Alt+Z'),
        detail: 'Hide chrome — Esc to exit',
        onSelect: () => setZenMode((z) => !z),
      },
      {
        id: 'palette-zoom-reset',
        label: 'Editor: Reset zoom',
        shortcut: accel('Ctrl+0'),
        onSelect: () => void monacoEditorRef.current?.getAction('editor.action.fontZoomReset')?.run(),
      },
      {
        id: 'palette-minimap',
        label: 'View: Toggle Minimap',
        shortcut: accel('Ctrl+Alt+M'),
        onSelect: () => setMinimapEnabled((v) => !v),
      },
      {
        id: 'palette-problems',
        label: 'View: Show Problems',
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
        onSelect: () => setSidebarOpen((v) => !v),
      },
      {
        id: 'palette-panel',
        label: 'View: Toggle Panel',
        shortcut: accel('Ctrl+`'),
        onSelect: () => setBottomExpanded((v) => !v),
      },
      {
        id: 'palette-output-tab',
        label: 'View: Show Output',
        detail: 'Bottom panel',
        onSelect: () => {
          setBottomExpanded(true);
          setBottomTab('output');
        },
      },
      {
        id: 'palette-composer',
        label: 'View: Focus Composer',
        onSelect: () => focusComposer(),
      },
      {
        id: 'palette-agent-tab',
        label: 'View: Open Agent stream',
        detail: AGENT_STREAM_PATH,
        onSelect: () => revealAgentStreamTab(),
      },
      {
        id: 'palette-readme',
        label: 'File: Open README.md',
        onSelect: () => openFile(DEFAULT_OPEN_PATH, 'README.md'),
      },
      {
        id: 'palette-plan',
        label: 'File: Open PLAN.md',
        onSelect: () => openFile('web-demo/PLAN.md', 'PLAN.md'),
      },
      {
        id: 'palette-page',
        label: 'File: Open dashboard page.tsx',
        onSelect: () => openFile('web-demo/apps/web/dashboard/page.tsx', 'page.tsx'),
      },
      {
        id: 'palette-explorer',
        label: 'View: Show Explorer',
        onSelect: () => {
          setActivityView('explorer');
          setSidebarOpen(true);
        },
      },
      {
        id: 'palette-search',
        label: 'View: Show Search',
        onSelect: () => {
          setActivityView('search');
          setSidebarOpen(true);
        },
      },
      {
        id: 'palette-signin',
        label: 'Account: Open sign in',
        onSelect: () => void router.push('/sign-in'),
      },
    ];
    if (onClearAgentOutput) {
      items.push({
        id: 'palette-clear-agent',
        label: 'Agent: Clear output and errors',
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

  const statusLabel = useMemo(() => {
    if (loading) return '◐ Web agent streaming…';
    if (agentError) return '✗ Request error';
    if (agentOutput.trim()) return '✓ Output ready';
    return '● Ready';
  }, [loading, agentError, agentOutput]);

  const goSignIn = useCallback(() => {
    void router.push('/sign-in');
  }, [router]);

  return (
    <div className={`wb-app${zenMode ? ' wb-app-zen' : ''}`}>
      <div className="wb-body">
        <nav className="wb-activity-bar" role="toolbar" aria-label="Side bar views">
          <div className="wb-activity-top">
            <button
              type="button"
              className={`wb-activity-btn ${activityView === 'explorer' ? 'wb-activity-btn-active' : ''}`}
              title={`Explorer (${accel('Ctrl+B')})`}
              aria-pressed={activityView === 'explorer'}
              onClick={() => {
                setActivityView('explorer');
                setSidebarOpen(true);
              }}
            >
              <span className="wb-activity-icon" aria-hidden>
                📂
              </span>
            </button>
            <button
              type="button"
              className={`wb-activity-btn ${activityView === 'search' ? 'wb-activity-btn-active' : ''}`}
              title={`Search (${accel('Ctrl+Shift+F')})`}
              aria-pressed={activityView === 'search'}
              onClick={() => {
                setActivityView('search');
                setSidebarOpen(true);
              }}
            >
              <span className="wb-activity-icon" aria-hidden>
                🔍
              </span>
            </button>
            <button type="button" className="wb-activity-btn" disabled title="Run (soon)" aria-disabled tabIndex={-1}>
              <span className="wb-activity-icon" aria-hidden>
                ▶
              </span>
            </button>
            <button type="button" className="wb-activity-btn" disabled title="Extensions (soon)" aria-disabled tabIndex={-1}>
              <span className="wb-activity-icon" aria-hidden>
                🧩
              </span>
            </button>
          </div>
          <div className="wb-activity-bottom">
            <button
              type="button"
              className="wb-activity-btn wb-activity-account"
              title={isClerkEnabled() ? 'Sign in' : 'Sign in (enable Clerk in .env)'}
              aria-label="Sign in"
              onClick={goSignIn}
            >
              <span className="wb-activity-icon" aria-hidden>
                👤
              </span>
            </button>
          </div>
        </nav>

        {sidebarOpen ? (
          <aside className="wb-sidebar" role="complementary" aria-label={activityView === 'explorer' ? 'Explorer' : 'Search'}>
            {activityView === 'explorer' ? (
              <div className="wb-file-tree">
                <div className="wb-file-tree-header">
                  <div className="wb-file-tree-titles">
                    <h2 className="wb-sidebar-heading">Explorer</h2>
                    <span className="wb-project-name">{WEB_DEMO_PROJECT_NAME}</span>
                  </div>
                </div>
                <div className="wb-file-tree-scroll">
                  <DemoTree
                    nodes={DEMO_FILE_TREE}
                    depth={0}
                    expanded={expandedDirs}
                    toggleDir={toggleDir}
                    activeFile={activePath}
                    onFileOpen={openFile}
                  />
                </div>
              </div>
            ) : (
              <div className="wb-search-panel">
                <h2 className="wb-sidebar-heading">Search</h2>
                <p className="wb-search-hint">
                  Workspace search ships with the desktop indexer. Use{' '}
                  <strong>{accel('Ctrl+F')}</strong> in the editor for the current file, or run{' '}
                  <strong>Editor: Find</strong> from the command palette. This view opens with{' '}
                  <strong>{accel('Ctrl+Shift+F')}</strong>. Open the <Link href="/">marketing site</Link> for product
                  context.
                </p>
              </div>
            )}
          </aside>
        ) : null}

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
              return (
                <div
                  key={path}
                  role="tab"
                  tabIndex={path === activePath ? 0 : -1}
                  aria-selected={path === activePath}
                  className={`wb-tab ${path === activePath ? 'wb-tab-active' : ''}`}
                  onClick={() => setActivePath(path)}
                >
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
                  onChange={onEditorChange}
                  onEditorReady={onMonacoReady}
                  onCursorPositionChange={onCursorPositionChange}
                />
              ) : (
                <div className="wb-welcome">
                  <h1>Auto-Coder</h1>
                  <p>Open a file from the Explorer to get started.</p>
                </div>
              )}
            </div>

            {bottomExpanded ? (
              <div className="wb-bottom" role="region" aria-label="Panel">
                <div className="wb-bottom-tabs">
                  <button
                    type="button"
                    className={`wb-bottom-tab ${bottomTab === 'output' ? 'wb-bottom-tab-active' : ''}`}
                    onClick={() => setBottomTab('output')}
                  >
                    Output
                  </button>
                  <button
                    type="button"
                    className={`wb-bottom-tab ${bottomTab === 'terminal' ? 'wb-bottom-tab-active' : ''}`}
                    onClick={() => setBottomTab('terminal')}
                  >
                    Terminal
                  </button>
                  <button
                    type="button"
                    className={`wb-bottom-tab ${bottomTab === 'problems' ? 'wb-bottom-tab-active' : ''} ${agentError ? 'wb-bottom-tab-warn' : ''}`}
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
                <div className="wb-bottom-body">
                  {bottomTab === 'output' ? (
                    <>
                      {agentError ? <div className="wb-output-error">{agentError}</div> : null}
                      {agentOutput ? (
                        <pre className="wb-output-pre">{agentOutput}</pre>
                      ) : (
                        <p className="wb-output-empty">
                          {loading ? 'Streaming…' : 'Composer responses and logs appear here.'}
                        </p>
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
                                  <div className="wb-problem-src">Composer · POST /api/agent</div>
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
                      <p>
                        Integrated terminal runs in the <strong>desktop</strong> app (node-pty + xterm). On the web,
                        use your system terminal against the same repo.
                      </p>
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

        <aside className="wb-composer" aria-label="Composer">
          {composer}
        </aside>
      </div>

      <footer className="wb-status-bar" role="contentinfo">
        <div className="wb-status-left">
          <button
            type="button"
            className="wb-status-btn"
            title={`Toggle sidebar (${accel('Ctrl+B')})`}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ☰
          </button>
          <span className="wb-status-project">📁 {WEB_DEMO_PROJECT_NAME}</span>
          {activeBuffer ? (
            <span className="wb-status-file" title={activeBuffer.path}>
              📄 {activeBuffer.name}
              {activeBuffer.isDirty ? ' •' : ''}
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
            <span className="wb-status-lang">{activeBuffer?.language ?? '—'}</span>
          </span>
          <button
            type="button"
            className="wb-status-btn"
            title="Quick open"
            onClick={() => setQuickOpen(true)}
          >
            {accel('Ctrl+P')}
          </button>
          <button
            type="button"
            className="wb-status-btn"
            title="Keyboard shortcuts"
            onClick={() => setShortcutsOpen(true)}
          >
            ?
          </button>
          <button
            type="button"
            className="wb-status-btn"
            title="Command palette"
            onClick={() => setPaletteOpen(true)}
          >
            {accel('Ctrl+Shift+P')}
          </button>
          <button type="button" className="wb-status-btn" onClick={() => setBottomExpanded((v) => !v)}>
            {accel('Ctrl+`')} Panel
          </button>
          <span className="wb-status-meta">Web IDE</span>
        </div>
      </footer>

      <WebCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
      <WebQuickOpen
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        entries={quickOpenEntries}
        onPick={(path, name) => openFile(path, name)}
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
    </div>
  );
}
