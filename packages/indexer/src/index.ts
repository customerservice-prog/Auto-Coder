import fs from 'fs/promises';
import path from 'path';
import chokidar, { type FSWatcher } from 'chokidar';
import { createHash } from 'crypto';

export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  type: 'function' | 'class' | 'interface' | 'component' | 'block';
  embedding?: number[];
}

export interface IndexOptions {
  projectPath: string;
  onChunkIndexed?: (chunk: CodeChunk) => void;
  onIndexComplete?: (totalChunks: number) => void;
  watchMode?: boolean;
  embeddingFn?: (text: string) => Promise<number[]>;
}

const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.css', '.json', '.md'];
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
  '.cursor',
  '.auto-coder-memory',
];

const indexCache = new Map<string, CodeChunk[]>();

/** Single watcher — closed whenever a new project is indexed so IPC re-entry cannot leak listeners. */
let indexWatcher: FSWatcher | null = null;

async function closeIndexWatcher(): Promise<void> {
  if (!indexWatcher) return;
  await indexWatcher.close();
  indexWatcher = null;
}

function normRel(projectRoot: string, absolutePath: string): string {
  return path.relative(projectRoot, path.resolve(absolutePath)).replace(/\\/g, '/');
}

function removeChunksForRelPath(relPosix: string) {
  for (const [key, val] of indexCache.entries()) {
    const fp = val[0]?.filePath.replace(/\\/g, '/');
    if (fp === relPosix) {
      indexCache.delete(key);
    }
  }
}

/**
 * Index the entire codebase using AST-aware chunking.
 * Stores chunks in memory cache (swap for LanceDB in production).
 */
export async function indexCodebase(options: IndexOptions): Promise<CodeChunk[]> {
  const { projectPath, onChunkIndexed, onIndexComplete, watchMode = false, embeddingFn } = options;

  await closeIndexWatcher();
  indexCache.clear();

  const root = path.resolve(projectPath);
  const allChunks: CodeChunk[] = [];

  const files = await getAllFiles(root);

  for (const file of files) {
    const chunks = await chunkFile(file, root);

    for (const chunk of chunks) {
      if (embeddingFn) {
        chunk.embedding = await embeddingFn(chunk.content);
      }
      allChunks.push(chunk);
      indexCache.set(chunk.id, [chunk]);
      onChunkIndexed?.(chunk);
    }
  }

  onIndexComplete?.(allChunks.length);

  // Watch mode — keep index in sync with disk (agent writes, user saves, new files)
  if (watchMode) {
    const notify = () => {
      onIndexComplete?.(indexCache.size);
    };

    const applyFile = async (absolutePath: string) => {
      const abs = path.resolve(absolutePath);
      const rel = normRel(root, abs);
      removeChunksForRelPath(rel);
      const chunks = await chunkFile(abs, root);
      for (const chunk of chunks) {
        indexCache.set(chunk.id, [chunk]);
      }
      notify();
    };

    const removeFile = (absolutePath: string) => {
      removeChunksForRelPath(normRel(root, path.resolve(absolutePath)));
      notify();
    };

    indexWatcher = chokidar
      .watch(root, {
        ignored: IGNORE_PATTERNS.map((p) => `**${path.sep}${p}${path.sep}**`),
        persistent: true,
        ignoreInitial: true,
      })
      .on('change', (p) => {
        void applyFile(p);
      })
      .on('add', (p) => {
        void applyFile(p);
      })
      .on('unlink', (p) => {
        removeFile(p);
      });
  }

  return allChunks;
}

/** Stop file watching (e.g. before app quit). Does not clear the in-memory index. */
export async function stopIndexWatcher(): Promise<void> {
  await closeIndexWatcher();
}

/**
 * Search the indexed codebase for relevant code chunks.
 * Uses simple keyword search (replace with vector similarity for production).
 */
export async function searchCodebase(
  query: string,
  topK: number = 10
): Promise<CodeChunk[]> {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(Boolean);

  const scored: Array<{ chunk: CodeChunk; score: number }> = [];

  for (const [, chunks] of indexCache.entries()) {
    for (const chunk of chunks) {
      const contentLower = chunk.content.toLowerCase();
      let score = 0;
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          score += word.length; // Longer matches = higher score
        }
      }
      if (score > 0) {
        scored.push({ chunk, score });
      }
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.chunk);
}

/**
 * Chunk a file into meaningful segments (functions, classes, etc.)
 */
async function chunkFile(filePath: string, projectPath: string): Promise<CodeChunk[]> {
  const ext = path.extname(filePath);
  if (!SUPPORTED_EXTENSIONS.includes(ext)) return [];

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(projectPath, filePath).replace(/\\/g, '/');
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];

    // Simple chunker: split by function/class boundaries
    // In production, use tree-sitter for proper AST parsing
    const chunkSize = 60; // lines per chunk
    let currentStart = 0;

    while (currentStart < lines.length) {
      const chunkEnd = Math.min(currentStart + chunkSize, lines.length);
      const chunkContent = lines.slice(currentStart, chunkEnd).join('\n');

      if (chunkContent.trim()) {
        const id = createHash('md5')
          .update(`${relativePath}:${currentStart}`)
          .digest('hex');

        chunks.push({
          id,
          filePath: relativePath,
          content: chunkContent,
          startLine: currentStart + 1,
          endLine: chunkEnd,
          type: detectChunkType(chunkContent),
        });
      }

      currentStart = chunkEnd;
    }

    return chunks;
  } catch {
    return [];
  }
}

function detectChunkType(content: string): CodeChunk['type'] {
  if (content.includes('function ') || content.includes('=>')) return 'function';
  if (content.includes('class ')) return 'class';
  if (content.includes('interface ') || content.includes('type ')) return 'interface';
  if (content.includes('export default') || content.includes('return (')) return 'component';
  return 'block';
}

async function getAllFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (IGNORE_PATTERNS.some(p => entry.name === p)) continue;
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (SUPPORTED_EXTENSIONS.includes(path.extname(entry.name))) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

export { indexCache };
