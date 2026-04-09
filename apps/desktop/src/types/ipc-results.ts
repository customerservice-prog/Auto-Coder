/**
 * IPC payloads from the Electron main process — kept aligned with
 * `@auto-coder/ai-core` AgentResult and `@auto-coder/indexer` CodeChunk.
 * Preload duplicates this shape in `electron/preload.ts` (electron `rootDir`).
 */

export interface AgentRunResult {
  success: boolean;
  filesChanged: string[];
  planMd: string;
  error?: string;
  iterations: number;
}

export interface CodeSearchChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'interface' | 'component' | 'block';
  embedding?: number[];
}
