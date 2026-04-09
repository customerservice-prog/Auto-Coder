import type { FileNode } from './types/file-tree';
import type { AgentRunResult, CodeSearchChunk } from './types/ipc-results';

export {};

declare global {
  interface Window {
    /** Exposed by `electron/preload.ts` in the packaged Electron app. */
    autocoder?: AutocoderPreloadApi;
  }
}

interface AutocoderPreloadApi {
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
}
