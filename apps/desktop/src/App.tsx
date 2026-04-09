import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { editor } from 'monaco-editor';
import { Editor } from './components/Editor';
import { ChatPanel } from './components/ChatPanel';
import { FileTree } from './components/FileTree';
import { TerminalPanel } from './components/TerminalPanel';
import { StatusBar, type StatusFileContext } from './components/StatusBar';
import { TopChrome } from './components/TopChrome';
import { ActivityBar, type ActivityView } from './components/ActivityBar';
import { MENU_ACTIONS_NEEDING_ACTIVE_EDITOR, type MenuAction } from './menu-config';
import { MonacoIds, runEditorAction } from './monaco-commands';
import { desktopAccel } from './desktopAccel';
import { isAppShortcutSuppressed, isQuitOrReloadShortcutSuppressed } from './shortcut-context';
import type { FileNode } from './types/file-tree';
import './App.css';

const WEB_SIGN_IN_URL =
  import.meta.env.VITE_WEB_SIGN_IN_URL?.trim() || 'http://localhost:3000/sign-in';

export type { FileNode };

export interface AgentStatus {
  status: 'idle' | 'planning' | 'executing' | 'testing' | 'done' | 'error';
  message: string;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
}

function getLanguage(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescriptreact',
    '.js': 'javascript', '.jsx': 'javascriptreact',
    '.py': 'python', '.go': 'go', '.rs': 'rust',
    '.css': 'css', '.scss': 'scss',
    '.json': 'json', '.md': 'markdown',
    '.html': 'html', '.yaml': 'yaml', '.yml': 'yaml',
  };
  return map[ext] || 'plaintext';
}

function fileNameFromPath(p: string): string {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

/** Parent directory for Explorer / project root when the user opens a single file first. */
function dirnameFromPath(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  if (i <= 0) return '';
  return p.slice(0, i);
}

function extFromName(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i) : '';
}

function isUntitledPath(path: string): boolean {
  return path.startsWith('untitled:');
}

function formatIpcError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function displayPathRelativeToProject(filePath: string, projectRoot: string): string {
  const norm = (s: string) => s.replace(/\\/g, '/').replace(/\/+$/, '');
  const f = norm(filePath);
  const r = norm(projectRoot);
  if (!r) return filePath;
  const prefix = r.endsWith('/') ? r : `${r}/`;
  const win = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent);
  const fc = win ? f.toLowerCase() : f;
  const rc = win ? r.toLowerCase() : r;
  const pc = win ? prefix.toLowerCase() : prefix;
  if (fc === rc) return fileNameFromPath(filePath);
  if (fc.startsWith(pc)) return f.slice(prefix.length);
  return filePath;
}

/** Match an open editor tab path to whatever `ai-core` sends (relative or absolute, mixed slashes). */
function agentPathMatchesOpenFile(openPath: string, agentFilePath: string, projectRoot: string): boolean {
  const o = openPath.replace(/\\/g, '/');
  const rel = agentFilePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel) return false;
  const win = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent);
  const eq = (a: string, b: string) => (win ? a.toLowerCase() === b.toLowerCase() : a === b);
  if (eq(o, rel)) return true;
  if (o.endsWith(rel)) {
    const i = o.length - rel.length;
    if (i === 0 || o[i - 1] === '/') return true;
  }
  if (projectRoot) {
    const r = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '');
    const combined = `${r}/${rel}`.replace(/\/{2,}/g, '/');
    if (eq(o, combined)) return true;
  }
  return false;
}

export default function App() {
  const [projectPath, setProjectPath] = useState<string>('');
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ status: 'idle', message: '' });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarMode, setSidebarMode] = useState<ActivityView>('explorer');
  const [chatOpen, setChatOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [indexedChunks, setIndexedChunks] = useState(0);
  const [chatMissionDraft, setChatMissionDraft] = useState<{ id: number; text: string } | null>(null);
  const monacoRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const pendingTabFocusPathRef = useRef<string | null>(null);
  const untitledSeq = useRef(1);
  const openFilesRef = useRef<OpenFile[]>([]);
  openFilesRef.current = openFiles;
  const activeFileRef = useRef('');
  activeFileRef.current = activeFile;
  const projectPathRef = useRef('');
  /** After the user confirms discarding dirty buffers for **File → Close Window** / **Exit**, allow one close without a second `beforeunload` prompt. */
  const allowUnloadAfterDiscardRef = useRef(false);
  useEffect(() => {
    projectPathRef.current = projectPath;
  }, [projectPath]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowUnloadAfterDiscardRef.current) {
        allowUnloadAfterDiscardRef.current = false;
        return;
      }
      if (openFilesRef.current.some((f) => f.isDirty)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const handleOpenFolder = useCallback(async () => {
    if (!window.autocoder) return;
    try {
      const folder = await window.autocoder.openFolder();
      if (folder) {
        setProjectPath(folder);
        const tree = await window.autocoder.getFileTree(folder);
        setFileTree(tree);
        window.autocoder
          .indexCodebase(folder)
          .then((count) => setIndexedChunks(count))
          .catch((err) => {
            window.alert(`Could not index workspace.\n\n${formatIpcError(err)}`);
          });
      }
    } catch (err) {
      window.alert(`Could not open folder.\n\n${formatIpcError(err)}`);
    }
  }, []);

  const refreshFileTree = useCallback(async () => {
    if (!window.autocoder || !projectPath) return;
    try {
      const tree = await window.autocoder.getFileTree(projectPath);
      setFileTree(tree);
    } catch (err) {
      window.alert(`Could not refresh file tree.\n\n${formatIpcError(err)}`);
    }
  }, [projectPath]);

  /** After the first file is on disk (open or save), align Explorer, indexer, and main `currentProjectPath`. */
  const syncProjectAfterNewDiskPath = useCallback(
    async (fileOrFolderPath: string) => {
      if (!window.autocoder) return;
      const parent = dirnameFromPath(fileOrFolderPath);
      if (!parent) return;
      if (!projectPathRef.current) {
        projectPathRef.current = parent;
        setProjectPath(parent);
        try {
          const tree = await window.autocoder.getFileTree(parent);
          setFileTree(tree);
        } catch (err) {
          window.alert(`Could not load file tree.\n\n${formatIpcError(err)}`);
        }
        window.autocoder
          .indexCodebase(parent)
          .then((count) => setIndexedChunks(count))
          .catch((err) => {
            window.alert(`Could not index workspace.\n\n${formatIpcError(err)}`);
          });
      } else {
        void refreshFileTree();
      }
    },
    [refreshFileTree]
  );

  // Listen for agent events from Electron main process
  useEffect(() => {
    if (!window.autocoder) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleTreeRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void refreshFileTree();
      }, 400);
    };

    const unsubStatus = window.autocoder.onAgentStatus(({ status, message }) => {
      setAgentStatus({ status: status as AgentStatus['status'], message });
    });

    const unsubFileChange = window.autocoder.onAgentFileChange(
      ({ filePath, content, reloadSuggested }) => {
        if (reloadSuggested && window.autocoder) {
          void (async () => {
            const prev = openFilesRef.current;
            const next = await Promise.all(
              prev.map(async (f) => {
                if (!agentPathMatchesOpenFile(f.path, filePath, projectPath)) return f;
                try {
                  const text = await window.autocoder!.readFile(f.path);
                  return { ...f, content: text, isDirty: false };
                } catch {
                  return f;
                }
              })
            );
            setOpenFiles(next);
            scheduleTreeRefresh();
          })();
          return;
        }
        setOpenFiles((prev) =>
          prev.map((f) =>
            agentPathMatchesOpenFile(f.path, filePath, projectPath)
              ? { ...f, content, isDirty: false }
              : f
          )
        );
        scheduleTreeRefresh();
      }
    );

    const unsubIndex = window.autocoder.onIndexComplete(({ total }) => {
      setIndexedChunks(total);
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubStatus();
      unsubFileChange();
      unsubIndex();
    };
  }, [projectPath, refreshFileTree]);

  const handleOpenFile = useCallback(async (node: FileNode) => {
    if (node.type !== 'file' || !window.autocoder) return;

    if (openFilesRef.current.some((f) => f.path === node.path)) {
      setActiveFile(node.path);
      return;
    }

    let content: string;
    try {
      content = await window.autocoder.readFile(node.path);
    } catch (err) {
      window.alert(`Could not read file.\n\n${formatIpcError(err)}`);
      return;
    }
    const newFile: OpenFile = {
      path: node.path,
      name: node.name,
      content,
      isDirty: false,
      language: getLanguage(node.ext || ''),
    };

    setOpenFiles(prev => [...prev, newFile]);
    setActiveFile(node.path);
  }, []);

  const handleNewTextFile = useCallback(() => {
    const n = untitledSeq.current++;
    const path = `untitled:${n}`;
    const name = `Untitled-${n}`;
    setOpenFiles((prev) => [...prev, { path, name, content: '', isDirty: false, language: 'plaintext' }]);
    setActiveFile(path);
  }, []);

  const handleOpenFileDialog = useCallback(async () => {
    if (!window.autocoder) return;
    const hint =
      activeFile && !isUntitledPath(activeFile) ? dirnameFromPath(activeFile) : undefined;
    const fp = await window.autocoder.openFileDialog(hint);
    if (!fp) return;
    if (openFilesRef.current.some((f) => f.path === fp)) {
      setActiveFile(fp);
      await syncProjectAfterNewDiskPath(fp);
      return;
    }
    let content: string;
    try {
      content = await window.autocoder.readFile(fp);
    } catch (err) {
      window.alert(`Could not read file.\n\n${formatIpcError(err)}`);
      return;
    }
    const name = fileNameFromPath(fp);
    const ext = extFromName(name);
    setOpenFiles((prev) => {
      if (prev.some((f) => f.path === fp)) return prev;
      return [...prev, { path: fp, name, content, isDirty: false, language: getLanguage(ext) }];
    });
    setActiveFile(fp);
    await syncProjectAfterNewDiskPath(fp);
  }, [activeFile, syncProjectAfterNewDiskPath]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!activeFile || value === undefined) return;
    setOpenFiles(prev => prev.map(f =>
      f.path === activeFile ? { ...f, content: value, isDirty: true } : f
    ));
  }, [activeFile]);

  const handleSave = useCallback(async () => {
    const file = openFiles.find((f) => f.path === activeFile);
    if (!file || !window.autocoder) return;
    try {
      if (isUntitledPath(file.path)) {
        const target = await window.autocoder.saveFileAs(
          projectPath
            ? { defaultFileName: file.name, directoryHint: projectPath }
            : file.name
        );
        if (!target) return;
        await window.autocoder.writeFile(target, file.content);
        const name = fileNameFromPath(target);
        const ext = extFromName(name);
        setOpenFiles((prev) =>
          prev.map((f) =>
            f.path === file.path ? { ...f, path: target, name, isDirty: false, language: getLanguage(ext) } : f
          )
        );
        setActiveFile(target);
        await syncProjectAfterNewDiskPath(target);
        return;
      }
      await window.autocoder.writeFile(file.path, file.content);
      setOpenFiles((prev) => prev.map((f) => (f.path === activeFile ? { ...f, isDirty: false } : f)));
    } catch (err) {
      window.alert(`Could not save file.\n\n${formatIpcError(err)}`);
    }
  }, [openFiles, activeFile, projectPath, syncProjectAfterNewDiskPath]);

  const handleSaveAs = useCallback(async () => {
    const file = openFiles.find((f) => f.path === activeFile);
    if (!file || !window.autocoder) return;
    const defaultName = isUntitledPath(file.path) ? file.name : fileNameFromPath(file.path);
    try {
      const target = await window.autocoder.saveFileAs(
        projectPath ? { defaultFileName: defaultName, directoryHint: projectPath } : defaultName
      );
      if (!target) return;
      await window.autocoder.writeFile(target, file.content);
      const name = fileNameFromPath(target);
      const ext = extFromName(name);
      setOpenFiles((prev) => {
        const next = prev
          .filter((f) => f.path !== target || f.path === file.path)
          .map((f) =>
            f.path === file.path ? { ...f, path: target, name, isDirty: false, language: getLanguage(ext) } : f
          );
        return next;
      });
      setActiveFile(target);
      await syncProjectAfterNewDiskPath(target);
    } catch (err) {
      window.alert(`Could not save file.\n\n${formatIpcError(err)}`);
    }
  }, [openFiles, activeFile, projectPath, syncProjectAfterNewDiskPath]);

  const handleSaveAll = useCallback(async () => {
    if (!window.autocoder) return;
    const dirtyOnDisk = openFiles.filter((f) => f.isDirty && !isUntitledPath(f.path));
    try {
      for (const f of dirtyOnDisk) {
        await window.autocoder.writeFile(f.path, f.content);
      }
      setOpenFiles((prev) =>
        prev.map((f) => (f.isDirty && !isUntitledPath(f.path) ? { ...f, isDirty: false } : f))
      );
    } catch (err) {
      window.alert(`Could not save all files.\n\n${formatIpcError(err)}`);
    }
  }, [openFiles]);

  const handleSignIn = useCallback(async () => {
    await window.autocoder?.openExternal(WEB_SIGN_IN_URL);
  }, []);

  const handleCloseFile = useCallback((filePath: string): boolean => {
    const victim = openFilesRef.current.find((f) => f.path === filePath);
    if (victim?.isDirty) {
      const ok = window.confirm(`Discard unsaved changes to "${victim.name}"?`);
      if (!ok) return false;
    }
    setOpenFiles((prev) => {
      const remaining = prev.filter((f) => f.path !== filePath);
      if (activeFile === filePath) {
        setActiveFile(remaining[remaining.length - 1]?.path || '');
      }
      return remaining;
    });
    return true;
  }, [activeFile]);

  const handleCloseAllEditors = useCallback((): boolean => {
    const files = openFilesRef.current;
    if (!files.length) return true;
    const dirty = files.filter((f) => f.isDirty);
    if (dirty.length) {
      const msg =
        dirty.length === files.length
          ? `Discard unsaved changes in all ${dirty.length} open tab(s) and close them?`
          : `Close all ${files.length} tabs? ${dirty.length} have unsaved changes — discard those edits?`;
      if (!window.confirm(msg)) return false;
    }
    setOpenFiles([]);
    setActiveFile('');
    return true;
  }, []);

  const menuActionDisabled = useCallback(
    (a: MenuAction) => {
      if (a === 'closeEditor') return !activeFile;
      if (a === 'closeAllEditors') return openFiles.length === 0;
      if (a === 'save' || a === 'saveAs') return !activeFile;
      if (a === 'saveAll') {
        return !openFiles.some((f) => f.isDirty && !isUntitledPath(f.path));
      }
      if (a === 'refreshExplorer') return !projectPath;
      if (a === 'copyActiveFilePath') return !activeFile || isUntitledPath(activeFile);
      if (a === 'revealInFolder') {
        return !projectPath && (!activeFile || isUntitledPath(activeFile));
      }
      if (MENU_ACTIONS_NEEDING_ACTIVE_EDITOR.has(a)) return !activeFile;
      return false;
    },
    [activeFile, openFiles, projectPath]
  );

  const handleCloseFileRef = useRef(handleCloseFile);
  handleCloseFileRef.current = handleCloseFile;
  const refocusTabBarAfterCloseRef = useRef(false);

  const confirmDiscardUnsaved = useCallback((actionPhrase: string): boolean => {
    const dirty = openFilesRef.current.filter((f) => f.isDirty);
    if (!dirty.length) return true;
    const label =
      dirty.length === 1
        ? `You have unsaved changes in "${dirty[0].name}".`
        : `You have unsaved changes in ${dirty.length} files.`;
    return window.confirm(`${label} ${actionPhrase}`);
  }, []);

  const requestCloseWindow = useCallback(() => {
    if (!confirmDiscardUnsaved('Close the window and discard them?')) return;
    allowUnloadAfterDiscardRef.current = true;
    void window.autocoder?.closeWindow();
  }, [confirmDiscardUnsaved]);

  const requestQuit = useCallback(() => {
    if (!confirmDiscardUnsaved('Quit and discard them?')) return;
    allowUnloadAfterDiscardRef.current = true;
    void window.autocoder?.quitApp();
  }, [confirmDiscardUnsaved]);

  const requestReloadWindow = useCallback(() => {
    if (openFilesRef.current.some((f) => f.isDirty)) {
      if (!confirmDiscardUnsaved('Reload the window and discard unsaved changes?')) return;
      allowUnloadAfterDiscardRef.current = true;
    }
    void window.autocoder?.reloadWindow();
  }, [confirmDiscardUnsaved]);

  const handleCopyActiveFilePath = useCallback(async () => {
    if (!activeFile || isUntitledPath(activeFile)) {
      window.alert('Save the file to disk before copying its path.');
      return;
    }
    try {
      await navigator.clipboard.writeText(activeFile);
    } catch {
      window.alert('Could not copy to the clipboard.');
    }
  }, [activeFile]);

  const handleRevealInFolder = useCallback(async () => {
    if (!window.autocoder) return;
    let target = '';
    if (activeFile && !isUntitledPath(activeFile)) target = activeFile;
    else if (projectPath) target = projectPath;
    else {
      window.alert('Open a saved file or project folder first.');
      return;
    }
    const ok = await window.autocoder.revealInFolder(target);
    if (!ok) window.alert('Could not open that location in the file manager.');
  }, [activeFile, projectPath]);

  const cycleEditorTab = useCallback((backward: boolean) => {
    const paths = openFilesRef.current.map((f) => f.path);
    if (paths.length < 2) return;
    const idx = paths.indexOf(activeFileRef.current);
    const i = idx < 0 ? 0 : idx;
    setActiveFile(
      backward ? paths[(i - 1 + paths.length) % paths.length] : paths[(i + 1) % paths.length]
    );
  }, []);

  const focusTabByPath = useCallback((path: string) => {
    const root = tabListRef.current;
    if (!root) return;
    const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(path) : path.replace(/"/g, '\\"');
    const el = root.querySelector(`[data-tab-path="${esc}"]`) as HTMLElement | null;
    el?.focus();
  }, []);

  const skipToEditorWorkspace = useCallback((e: ReactMouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const activeTab = tabListRef.current?.querySelector<HTMLElement>('[role="tab"][tabindex="0"]');
    if (activeTab) {
      activeTab.focus();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => monacoRef.current?.focus());
      });
      return;
    }
    document.getElementById('main-editor')?.focus();
  }, []);

  useEffect(() => {
    const pending = pendingTabFocusPathRef.current;
    if (pending == null || pending !== activeFile) return;
    pendingTabFocusPathRef.current = null;
    const raf = requestAnimationFrame(() => focusTabByPath(pending));
    return () => cancelAnimationFrame(raf);
  }, [activeFile, focusTabByPath]);

  useEffect(() => {
    if (!refocusTabBarAfterCloseRef.current) return;
    refocusTabBarAfterCloseRef.current = false;
    if (!activeFile) return;
    const raf = requestAnimationFrame(() => focusTabByPath(activeFile));
    return () => cancelAnimationFrame(raf);
  }, [activeFile, focusTabByPath]);

  const onEditorTabListKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    const files = openFilesRef.current;
    if (files.length === 0) return;
    const key = e.key;
    if (key === 'Delete' || key === 'Backspace') {
      const tabEl = (e.target as HTMLElement).closest?.('[data-tab-path]');
      const pathAttr = tabEl?.getAttribute('data-tab-path');
      if (!pathAttr || !files.some((f) => f.path === pathAttr)) return;
      e.preventDefault();
      refocusTabBarAfterCloseRef.current = true;
      if (!handleCloseFileRef.current(pathAttr)) {
        refocusTabBarAfterCloseRef.current = false;
      }
      return;
    }
    if (key === 'Enter' || key === ' ') {
      const tabEl = (e.target as HTMLElement).closest?.('[data-tab-path]');
      const pathAttr = tabEl?.getAttribute('data-tab-path');
      if (pathAttr && pathAttr !== activeFileRef.current) {
        e.preventDefault();
        pendingTabFocusPathRef.current = pathAttr;
        setActiveFile(pathAttr);
      }
      return;
    }
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    e.preventDefault();
    const ae = activeFileRef.current;
    let idx = files.findIndex((f) => f.path === ae);
    if (idx < 0) idx = 0;
    let nextIdx = idx;
    if (key === 'ArrowRight') nextIdx = Math.min(files.length - 1, idx + 1);
    else if (key === 'ArrowLeft') nextIdx = Math.max(0, idx - 1);
    else if (key === 'Home') nextIdx = 0;
    else if (key === 'End') nextIdx = files.length - 1;
    if (nextIdx === idx) return;
    const nextPath = files[nextIdx]!.path;
    pendingTabFocusPathRef.current = nextPath;
    setActiveFile(nextPath);
  }, []);

  const handleInlineAiToChat = useCallback((prefill: string) => {
    setChatOpen(true);
    setChatMissionDraft({ id: Date.now(), text: prefill });
  }, []);

  const handleChatMissionDraftConsumed = useCallback(() => {
    setChatMissionDraft(null);
  }, []);

  const handleMenuAction = useCallback(
    (action: MenuAction) => {
      switch (action) {
        case 'newTextFile':
          handleNewTextFile();
          break;
        case 'openFile':
          void handleOpenFileDialog();
          break;
        case 'openFolder':
          void handleOpenFolder();
          break;
        case 'refreshExplorer':
          void refreshFileTree();
          break;
        case 'revealInFolder':
          void handleRevealInFolder();
          break;
        case 'copyActiveFilePath':
          void handleCopyActiveFilePath();
          break;
        case 'save':
          void handleSave();
          break;
        case 'saveAs':
          void handleSaveAs();
          break;
        case 'saveAll':
          void handleSaveAll();
          break;
        case 'closeEditor':
          if (activeFile) handleCloseFile(activeFile);
          break;
        case 'closeAllEditors':
          handleCloseAllEditors();
          break;
        case 'closeWindow':
          requestCloseWindow();
          break;
        case 'quit':
          requestQuit();
          break;
        case 'toggleExplorer':
          setSidebarMode('explorer');
          setSidebarOpen(true);
          break;
        case 'togglePrimarySidebar':
          setSidebarOpen((p) => !p);
          break;
        case 'toggleSearch':
          setSidebarMode('search');
          setSidebarOpen(true);
          break;
        case 'toggleTerminalPanel':
        case 'newTerminal':
          setTerminalOpen(true);
          break;
        case 'toggleChat':
          setChatOpen((p) => !p);
          break;
        case 'toggleDevTools':
          void window.autocoder?.toggleDevTools();
          break;
        case 'reloadWindow':
          requestReloadWindow();
          break;
        case 'openSignIn':
          void handleSignIn();
          break;
        case 'about':
          window.alert('Auto-Coder desktop v0.1.0\nAutonomous AI IDE');
          break;
        case 'undo':
          runEditorAction(monacoRef.current, ...MonacoIds.undo);
          break;
        case 'redo':
          runEditorAction(monacoRef.current, ...MonacoIds.redo);
          break;
        case 'cut':
          runEditorAction(monacoRef.current, ...MonacoIds.cut);
          break;
        case 'copy':
          runEditorAction(monacoRef.current, ...MonacoIds.copy);
          break;
        case 'paste':
          runEditorAction(monacoRef.current, ...MonacoIds.paste);
          break;
        case 'find':
          runEditorAction(monacoRef.current, ...MonacoIds.find);
          break;
        case 'replace':
          runEditorAction(monacoRef.current, ...MonacoIds.replace);
          break;
        case 'toggleLineComment':
          runEditorAction(monacoRef.current, ...MonacoIds.lineComment);
          break;
        case 'toggleBlockComment':
          runEditorAction(monacoRef.current, ...MonacoIds.blockComment);
          break;
        case 'selectAll':
          runEditorAction(monacoRef.current, ...MonacoIds.selectAll);
          break;
        case 'expandSelection':
          runEditorAction(monacoRef.current, ...MonacoIds.expandSelection);
          break;
        case 'shrinkSelection':
          runEditorAction(monacoRef.current, ...MonacoIds.shrinkSelection);
          break;
        case 'copyLineUp':
          runEditorAction(monacoRef.current, ...MonacoIds.copyLineUp);
          break;
        case 'copyLineDown':
          runEditorAction(monacoRef.current, ...MonacoIds.copyLineDown);
          break;
        case 'moveLineUp':
          runEditorAction(monacoRef.current, ...MonacoIds.moveLineUp);
          break;
        case 'moveLineDown':
          runEditorAction(monacoRef.current, ...MonacoIds.moveLineDown);
          break;
        case 'addCursorAbove':
          runEditorAction(monacoRef.current, ...MonacoIds.addCursorAbove);
          break;
        case 'addCursorBelow':
          runEditorAction(monacoRef.current, ...MonacoIds.addCursorBelow);
          break;
        case 'addNextOccurrence':
          runEditorAction(monacoRef.current, ...MonacoIds.addNextOccurrence);
          break;
        case 'toggleWordWrap':
          runEditorAction(monacoRef.current, ...MonacoIds.wordWrap);
          break;
        case 'zoomIn':
          runEditorAction(monacoRef.current, ...MonacoIds.zoomIn);
          break;
        case 'zoomOut':
          runEditorAction(monacoRef.current, ...MonacoIds.zoomOut);
          break;
        case 'resetZoom':
          runEditorAction(monacoRef.current, ...MonacoIds.zoomReset);
          break;
        case 'goToLine':
          runEditorAction(monacoRef.current, ...MonacoIds.gotoLine);
          break;
        case 'goToSymbolEditor':
          runEditorAction(monacoRef.current, ...MonacoIds.goToSymbolEditor);
          break;
        default:
          break;
      }
    },
    [
      handleNewTextFile,
      handleOpenFileDialog,
      handleOpenFolder,
      refreshFileTree,
      handleRevealInFolder,
      handleCopyActiveFilePath,
      handleSave,
      handleSaveAs,
      handleSaveAll,
      handleCloseFile,
      handleCloseAllEditors,
      activeFile,
      handleSignIn,
      requestCloseWindow,
      requestQuit,
      requestReloadWindow,
    ]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        if (isAppShortcutSuppressed(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) void handleSaveAs();
        else if (e.altKey) void handleSaveAll();
        else void handleSave();
      }
      if (mod && e.altKey && e.key.toLowerCase() === 'o' && !e.shiftKey) {
        e.preventDefault();
        void handleOpenFolder();
      }
      if (mod && e.key.toLowerCase() === 'o' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        void handleOpenFileDialog();
      }
      if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        handleNewTextFile();
      }
      if (mod && e.key.toLowerCase() === 'q' && !e.shiftKey && !e.altKey) {
        if (isQuitOrReloadShortcutSuppressed(e.target)) return;
        e.preventDefault();
        requestQuit();
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
        if (isAppShortcutSuppressed(e.target)) return;
        e.preventDefault();
        setSidebarMode('explorer');
        setSidebarOpen(true);
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        if (isAppShortcutSuppressed(e.target)) return;
        e.preventDefault();
        setSidebarMode('search');
        setSidebarOpen(true);
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        if (isAppShortcutSuppressed(e.target)) return;
        if (!monacoRef.current) return;
        e.preventDefault();
        runEditorAction(monacoRef.current, ...MonacoIds.goToSymbolEditor);
      }
      if (mod && e.key.toLowerCase() === 'g' && !e.shiftKey && !e.altKey) {
        if (isAppShortcutSuppressed(e.target)) return;
        if (!monacoRef.current) return;
        e.preventDefault();
        runEditorAction(monacoRef.current, ...MonacoIds.gotoLine);
      }
      if (!e.ctrlKey && !e.metaKey && e.altKey && !e.shiftKey && e.code === 'KeyZ') {
        if (isAppShortcutSuppressed(e.target)) return;
        if (!monacoRef.current) return;
        e.preventDefault();
        runEditorAction(monacoRef.current, ...MonacoIds.wordWrap);
      }
      if (mod && e.code === 'Backquote') {
        if (isAppShortcutSuppressed(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) setTerminalOpen(true);
        else setTerminalOpen((p) => !p);
      }
      if (mod && e.key.toLowerCase() === 'l' && !e.shiftKey && !e.altKey) {
        if (isAppShortcutSuppressed(e.target)) return;
        e.preventDefault();
        setChatOpen((p) => !p);
      }
      if (mod && e.key.toLowerCase() === 'w' && !e.shiftKey) {
        if (isAppShortcutSuppressed(e.target)) return;
        if (!activeFile) return;
        e.preventDefault();
        handleCloseFile(activeFile);
      }
      if (mod && e.key === 'Tab') {
        if (isAppShortcutSuppressed(e.target)) return;
        if (openFilesRef.current.length < 2) return;
        e.preventDefault();
        cycleEditorTab(e.shiftKey);
      }
      if (mod && (e.key === 'PageDown' || e.key === 'PageUp')) {
        if (isAppShortcutSuppressed(e.target)) return;
        if (openFilesRef.current.length < 2) return;
        e.preventDefault();
        cycleEditorTab(e.key === 'PageUp');
      }
      if (mod && e.altKey && e.key.toLowerCase() === 'r') {
        if (isQuitOrReloadShortcutSuppressed(e.target)) return;
        e.preventDefault();
        requestReloadWindow();
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'i' && !e.altKey) {
        if (isAppShortcutSuppressed(e.target)) return;
        e.preventDefault();
        void window.autocoder?.toggleDevTools();
      }
      if (
        mod &&
        !e.altKey &&
        !e.shiftKey &&
        (e.code === 'Equal' || e.code === 'NumpadAdd') &&
        monacoRef.current
      ) {
        if (isAppShortcutSuppressed(e.target)) return;
        e.preventDefault();
        runEditorAction(monacoRef.current, ...MonacoIds.zoomIn);
      }
      if (
        mod &&
        !e.altKey &&
        !e.shiftKey &&
        (e.code === 'Minus' || e.code === 'NumpadSubtract') &&
        monacoRef.current
      ) {
        if (isAppShortcutSuppressed(e.target)) return;
        e.preventDefault();
        runEditorAction(monacoRef.current, ...MonacoIds.zoomOut);
      }
      if (
        mod &&
        !e.altKey &&
        !e.shiftKey &&
        (e.code === 'Digit0' || e.code === 'Numpad0') &&
        monacoRef.current
      ) {
        if (isAppShortcutSuppressed(e.target)) return;
        e.preventDefault();
        runEditorAction(monacoRef.current, ...MonacoIds.zoomReset);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    handleSave,
    handleSaveAs,
    handleSaveAll,
    handleOpenFolder,
    handleOpenFileDialog,
    handleNewTextFile,
    activeFile,
    handleCloseFile,
    cycleEditorTab,
    requestReloadWindow,
    requestQuit,
  ]);

  /** Capture phase so Monaco does not consume Ctrl/Cmd+B (VS Code–style primary side bar). */
  useEffect(() => {
    const onB = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.key.toLowerCase() !== 'b' || e.shiftKey || e.altKey) return;
      if (isAppShortcutSuppressed(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      setSidebarOpen((p) => !p);
    };
    window.addEventListener('keydown', onB, true);
    return () => window.removeEventListener('keydown', onB, true);
  }, []);

  const handleRunAgent = useCallback(async (mission: string) => {
    if (!window.autocoder || !projectPath) return;
    setAgentStatus({ status: 'planning', message: 'Starting mission...' });
    try {
      const result = await window.autocoder.runAgent(mission, projectPath);
      const n = result.filesChanged.length;
      if (result.success) {
        setAgentStatus({ status: 'done', message: `Done! ${n} files changed` });
      } else {
        setAgentStatus({
          status: 'error',
          message: result.error?.trim() || `Mission finished with errors (${n} files touched).`,
        });
      }
      // Refresh file tree
      const tree = await window.autocoder.getFileTree(projectPath);
      setFileTree(tree);
    } catch (err) {
      setAgentStatus({ status: 'error', message: formatIpcError(err) });
    }
  }, [projectPath]);

  const activeFileData = openFiles.find(f => f.path === activeFile);

  const mainEditorPanelLabel = useMemo(() => {
    if (!activeFileData) return 'Editor';
    return `Editor, ${activeFileData.name}${activeFileData.isDirty ? ', modified' : ''}`;
  }, [activeFileData]);

  const statusFileContext = useMemo((): StatusFileContext | null => {
    if (!activeFile || !activeFileData) return null;
    if (isUntitledPath(activeFile)) {
      return { display: activeFileData.name, fullPath: null, isUntitled: true };
    }
    const full = activeFile;
    const display = projectPath ? displayPathRelativeToProject(full, projectPath) : fileNameFromPath(full);
    return { display, fullPath: full, isUntitled: false };
  }, [activeFile, activeFileData, projectPath]);

  const chromeTitle = useMemo(() => {
    if (activeFile) {
      const file = openFiles.find((f) => f.path === activeFile);
      const name = file?.name ?? fileNameFromPath(activeFile);
      return `${name}${file?.isDirty ? ' •' : ''} — Auto-Coder`;
    }
    if (projectPath) return `${fileNameFromPath(projectPath)} — Auto-Coder`;
    return 'Auto-Coder — Autonomous AI IDE';
  }, [activeFile, openFiles, projectPath]);

  useEffect(() => {
    document.title = chromeTitle;
    void window.autocoder?.setWindowTitle(chromeTitle);
  }, [chromeTitle]);

  useEffect(() => {
    if (!activeFileData) {
      monacoRef.current = null;
    }
  }, [activeFileData]);

  return (
    <div className="app">
      <a
        href="#main-editor"
        className="skip-link"
        aria-label="Skip to editor workspace"
        onClick={skipToEditorWorkspace}
      >
        Skip to editor
      </a>
      <TopChrome
        title={chromeTitle}
        onMenuAction={handleMenuAction}
        menuActionDisabled={menuActionDisabled}
        onSignIn={handleSignIn}
      />

      <div className="app-body">
        <ActivityBar active={sidebarMode} onSelect={setSidebarMode} onSignIn={handleSignIn} />

        {sidebarOpen && (
          <div
            className="sidebar"
            role="complementary"
            aria-label={sidebarMode === 'explorer' ? 'Explorer' : 'Search'}
          >
            {sidebarMode === 'explorer' ? (
              <FileTree
                key={projectPath || '__no_project__'}
                nodes={fileTree}
                onFileOpen={handleOpenFile}
                activeFile={activeFile}
                projectPath={projectPath}
                onRefresh={refreshFileTree}
              />
            ) : (
              <div className="sidebar-search-panel" role="region" aria-labelledby="sidebar-search-heading">
                <h2 className="file-tree-header sidebar-section-heading" id="sidebar-search-heading">
                  Search
                </h2>
                <p className="sidebar-search-hint">
                  Workspace-wide search is on the roadmap. Use <strong>{desktopAccel('find')}</strong> in the
                  editor for the current file. Sign in on the web app for cloud features.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Main Editor Area */}
        <div className="main-area" role="main" aria-label="Editor workspace">
          {/* Tab Bar */}
          <div
            ref={tabListRef}
            className="tab-bar"
            role={openFiles.length > 0 ? 'tablist' : undefined}
            aria-label={openFiles.length > 0 ? 'Open editors' : undefined}
            aria-orientation={openFiles.length > 0 ? 'horizontal' : undefined}
            aria-hidden={openFiles.length === 0 ? true : undefined}
            onKeyDown={openFiles.length > 0 ? onEditorTabListKeyDown : undefined}
          >
            {openFiles.map((file) => {
              const tabPathHint =
                !isUntitledPath(file.path) && projectPath
                  ? displayPathRelativeToProject(file.path, projectPath)
                  : file.path;
              return (
                <div
                  key={file.path}
                  data-tab-path={file.path}
                  role="tab"
                  tabIndex={file.path === activeFile ? 0 : -1}
                  aria-selected={file.path === activeFile}
                  aria-controls="main-editor"
                  title={
                    isUntitledPath(file.path)
                      ? `${file.name} (not on disk)${file.isDirty ? ' — modified' : ''}`
                      : `${tabPathHint}${file.isDirty ? ' — modified' : ''}`
                  }
                  aria-label={
                    isUntitledPath(file.path)
                      ? `${file.name}${file.isDirty ? ', modified' : ''}, not saved to disk`
                      : `${file.name}, ${tabPathHint}${file.isDirty ? ', modified' : ''}`
                  }
                  className={`tab ${file.path === activeFile ? 'active' : ''}`}
                  onClick={() => setActiveFile(file.path)}
                >
                  <span className="tab-name" aria-hidden="true">
                    {file.isDirty ? '● ' : ''}
                    {file.name}
                  </span>
                  <button
                    type="button"
                    className="tab-close"
                    tabIndex={-1}
                    aria-label={`Close ${file.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseFile(file.path);
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {/* Editor */}
          <div
            className="editor-container"
            id="main-editor"
            role="tabpanel"
            aria-label={mainEditorPanelLabel}
            tabIndex={-1}
          >
            {activeFileData ? (
              <Editor
                file={activeFileData}
                onChange={handleEditorChange}
                onSave={handleSave}
                onSaveAs={handleSaveAs}
                onSaveAll={handleSaveAll}
                onCloseEditor={() => {
                  if (activeFile) handleCloseFile(activeFile);
                }}
                onCycleTab={cycleEditorTab}
                onInlineAiToChat={handleInlineAiToChat}
                onEditorReady={(instance) => {
                  monacoRef.current = instance;
                }}
              />
            ) : (
              <div className="welcome-screen" aria-labelledby="welcome-title">
                <div className="welcome-content">
                  <h1 id="welcome-title">🚀 Auto-Coder</h1>
                  <p>Autonomous AI-powered IDE</p>
                  {!projectPath ? (
                    <>
                      <button type="button" className="btn-primary" onClick={handleOpenFolder}>
                        Open Project Folder
                      </button>
                      <p className="hint">
                        Or <strong>File → Open Folder…</strong> ({desktopAccel('openFolder')}), or{' '}
                        <strong>File → Open File…</strong> ({desktopAccel('openFile')}) — the file’s folder becomes
                        the workspace.
                      </p>
                    </>
                  ) : (
                    <p className="hint">
                      Pick a file in the sidebar, or <strong>{desktopAccel('openFile')}</strong> to open a file,{' '}
                      <strong>{desktopAccel('newFile')}</strong> for a new buffer.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Terminal Panel */}
          {terminalOpen && (
            <div className="terminal-container">
              <TerminalPanel projectPath={projectPath} />
            </div>
          )}
        </div>

        {/* Chat / Agent Panel */}
        {chatOpen && (
          <div className="chat-panel-container">
            <ChatPanel
              onRunAgent={handleRunAgent}
              agentStatus={agentStatus}
              projectPath={projectPath}
              indexedChunks={indexedChunks}
              missionDraft={chatMissionDraft}
              onMissionDraftConsumed={handleChatMissionDraftConsumed}
              onRequestDismiss={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>

      <StatusBar
        agentStatus={agentStatus}
        projectPath={projectPath}
        indexedChunks={indexedChunks}
        fileContext={statusFileContext}
        onCopyActivePath={handleCopyActiveFilePath}
        onToggleSidebar={() => setSidebarOpen(p => !p)}
        onToggleChat={() => setChatOpen(p => !p)}
        onToggleTerminal={() => setTerminalOpen(p => !p)}
      />
    </div>
  );
}
