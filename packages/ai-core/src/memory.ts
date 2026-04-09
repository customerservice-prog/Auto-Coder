import fs from 'fs/promises';
import path from 'path';

interface MemoryEntry {
  timestamp: string;
  mission: string;
  filesChanged: string[];
  notes: string;
}

const MEMORY_FILE = '.auto-coder-memory/context.json';

/**
 * Loads project memory — past decisions, patterns, and architectural context.
 * This gives the agent "long-term memory" across sessions.
 */
export async function getMemory(projectPath: string): Promise<string> {
  try {
    const memPath = path.join(projectPath, MEMORY_FILE);
    const raw = await fs.readFile(memPath, 'utf-8');
    const entries: MemoryEntry[] = JSON.parse(raw);

    if (!entries.length) return 'No previous sessions.';

    const recent = entries.slice(-5); // Last 5 sessions
    return recent
      .map(e => `[${e.timestamp}] Mission: ${e.mission} | Changed: ${e.filesChanged.join(', ')}`)
      .join('\n');
  } catch {
    return 'No previous sessions.';
  }
}

/**
 * Saves the current session to project memory for future agent runs.
 */
export async function saveMemory(
  projectPath: string,
  mission: string,
  filesChanged: string[]
): Promise<void> {
  try {
    const memDir = path.join(projectPath, '.auto-coder-memory');
    const memPath = path.join(memDir, 'context.json');

    await fs.mkdir(memDir, { recursive: true });

    let entries: MemoryEntry[] = [];
    try {
      const raw = await fs.readFile(memPath, 'utf-8');
      entries = JSON.parse(raw);
    } catch {
      // First session
    }

    entries.push({
      timestamp: new Date().toISOString(),
      mission,
      filesChanged,
      notes: '',
    });

    // Keep last 20 sessions
    if (entries.length > 20) entries = entries.slice(-20);

    await fs.writeFile(memPath, JSON.stringify(entries, null, 2));
  } catch (err) {
    console.warn('Could not save memory:', err);
  }
}

/**
 * Add a manual note to project memory (e.g. architectural decisions)
 */
export async function addMemoryNote(projectPath: string, note: string): Promise<void> {
  const memDir = path.join(projectPath, '.auto-coder-memory');
  const notesPath = path.join(memDir, 'notes.md');
  await fs.mkdir(memDir, { recursive: true });
  const existing = await fs.readFile(notesPath, 'utf-8').catch(() => '');
  await fs.writeFile(notesPath, existing + `
- [${new Date().toISOString()}] ${note}`);
}
