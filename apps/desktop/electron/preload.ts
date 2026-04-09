import { contextBridge, ipcRenderer } from 'electron';

/** Mirror `src/types/ipc-results.ts` — preload `rootDir` is `electron` only. */
type AgentRunResult = {
  success: boolean;
  filesChanged: string[];
  planMd: string;
  error?: string;
  iterations: number;
};
type CodeSearchChunk = {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'interface' | 'component' | 'block';
  embedding?: number[];
};

/**
 * Preload — exposes safe IPC methods to the renderer (React) process.
 * This is the bridge between the UI and Electron's main process.
 */
contextBridge.exposeInMainWorld('autocoder', {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  revealInFolder: (fullPath: string) => ipcRenderer.invoke('shell:revealInFolder', fullPath),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  toggleDevTools: () => ipcRenderer.invoke('window:toggleDevTools'),
  setWindowTitle: (title: string) => ipcRenderer.invoke('window:setTitle', title),
  reloadWindow: () => ipcRenderer.invoke('window:reload'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // Filesystem
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  openFileDialog: (directoryHint?: string) =>
    ipcRenderer.invoke('dialog:openFile', directoryHint),
  saveFileAs: (payload: string | { defaultFileName: string; directoryHint?: string }) =>
    ipcRenderer.invoke('dialog:saveFileAs', payload),
  getFileTree: (path?: string) => ipcRenderer.invoke('fs:getFileTree', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),

  // Agent
  runAgent: (mission: string, projectPath?: string) =>
    ipcRenderer.invoke('agent:run', mission, projectPath),

  // Indexer
  indexCodebase: (projectPath?: string) => ipcRenderer.invoke('indexer:index', projectPath),
  searchCodebase: (query: string, topK?: number) =>
    ipcRenderer.invoke('indexer:search', query, topK),

  // Event listeners (use removeListener so multiple subscribers are safe)
  onAgentStatus: (callback: (data: { status: string; message: string }) => void) => {
    const handler = (_: unknown, data: { status: string; message: string }) => callback(data);
    ipcRenderer.on('agent:status', handler);
    return () => ipcRenderer.removeListener('agent:status', handler);
  },
  onAgentFileChange: (
    callback: (data: { filePath: string; content: string; reloadSuggested?: boolean }) => void
  ) => {
    const handler = (
      _: unknown,
      data: { filePath: string; content: string; reloadSuggested?: boolean }
    ) => callback(data);
    ipcRenderer.on('agent:fileChange', handler);
    return () => ipcRenderer.removeListener('agent:fileChange', handler);
  },
  onIndexComplete: (callback: (data: { total: number }) => void) => {
    const handler = (_: unknown, data: { total: number }) => callback(data);
    ipcRenderer.on('indexer:complete', handler);
    return () => ipcRenderer.removeListener('indexer:complete', handler);
  },

  // Terminal
  terminalCreate: (opts?: { cwd?: string }) =>
    ipcRenderer.invoke('terminal:create', opts ?? {}),
  terminalWrite: (id: string, data: string) =>
    ipcRenderer.invoke('terminal:write', { id, data }),
  terminalResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
  terminalKill: (id: string) => ipcRenderer.invoke('terminal:kill', { id }),
  onTerminalData: (callback: (data: { id: string; data: string }) => void) => {
    const handler = (_: unknown, data: { id: string; data: string }) => callback(data);
    ipcRenderer.on('terminal:data', handler);
    return () => ipcRenderer.removeListener('terminal:data', handler);
  },
  onTerminalExit: (callback: (data: { id: string }) => void) => {
    const handler = (_: unknown, data: { id: string }) => callback(data);
    ipcRenderer.on('terminal:exit', handler);
    return () => ipcRenderer.removeListener('terminal:exit', handler);
  },
});

// TypeScript type declaration
declare global {
  interface Window {
    autocoder: {
      openExternal: (url: string) => Promise<boolean>;
      revealInFolder: (fullPath: string) => Promise<boolean>;
      quitApp: () => Promise<void>;
      toggleDevTools: () => Promise<void>;
      setWindowTitle: (title: string) => Promise<void>;
      reloadWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      openFolder: () => Promise<string | null>;
      openFileDialog: (directoryHint?: string) => Promise<string | null>;
      saveFileAs: (
        payload: string | { defaultFileName: string; directoryHint?: string }
      ) => Promise<string | null>;
      getFileTree: (path?: string) => Promise<FileNode[]>;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<boolean>;
      runAgent: (mission: string, projectPath?: string) => Promise<AgentRunResult>;
      indexCodebase: (projectPath?: string) => Promise<number>;
      searchCodebase: (query: string, topK?: number) => Promise<CodeSearchChunk[]>;
      onAgentStatus: (cb: (data: { status: string; message: string }) => void) => () => void;
      onAgentFileChange: (
        cb: (data: { filePath: string; content: string; reloadSuggested?: boolean }) => void
      ) => () => void;
      onIndexComplete: (cb: (data: { total: number }) => void) => () => void;
      terminalCreate: (opts?: { cwd?: string }) => Promise<{ id: string; cwd: string }>;
      terminalWrite: (id: string, data: string) => Promise<void>;
      terminalResize: (id: string, cols: number, rows: number) => Promise<void>;
      terminalKill: (id: string) => Promise<void>;
      onTerminalData: (cb: (data: { id: string; data: string }) => void) => () => void;
      onTerminalExit: (cb: (data: { id: string }) => void) => () => void;
    };
  }
}
