/** Same tree shape as `getFileTree` in `electron/main.ts` (`ExplorerFileNode`). */
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  ext?: string;
  children?: FileNode[];
}