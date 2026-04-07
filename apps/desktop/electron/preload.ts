import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload — exposes safe IPC methods to the renderer (React) process.
 * This is the bridge between the UI and Electron's main process.
 */
contextBridge.exposeInMainWorld('autocoder', {
  // Filesystem
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
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

  // Event listeners
  onAgentStatus: (callback: (data: { status: string; message: string }) => void) => {
    ipcRenderer.on('agent:status', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('agent:status');
  },
  onAgentFileChange: (callback: (data: { filePath: string; content: string }) => void) => {
    ipcRenderer.on('agent:fileChange', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('agent:fileChange');
  },
  onIndexComplete: (callback: (data: { total: number }) => void) => {
    ipcRenderer.on('indexer:complete', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('indexer:complete');
  },
});

// TypeScript type declaration
declare global {
  interface Window {
    autocoder: {
      openFolder: () => Promise<string | null>;
      getFileTree: (path?: string) => Promise<any[]>;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<boolean>;
      runAgent: (mission: string, projectPath?: string) => Promise<any>;
      indexCodebase: (projectPath?: string) => Promise<number>;
      searchCodebase: (query: string, topK?: number) => Promise<any[]>;
      onAgentStatus: (cb: (data: { status: string; message: string }) => void) => () => void;
      onAgentFileChange: (cb: (data: { filePath: string; content: string }) => void) => () => void;
      onIndexComplete: (cb: (data: { total: number }) => void) => () => void;
    };
  }
}
