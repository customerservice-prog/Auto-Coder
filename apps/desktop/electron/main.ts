import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import { randomUUID } from 'crypto';
import * as pty from 'node-pty';
import { runAgent } from '@auto-coder/ai-core';
import { indexCodebase, searchCodebase, stopIndexWatcher } from '@auto-coder/indexer';

/** Explorer row — same shape as renderer `FileNode` in `src/types/file-tree.ts`. */
interface ExplorerFileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  ext?: string;
  children?: ExplorerFileNode[];
}

const isDev = process.env.NODE_ENV !== 'production';

/** Pick up `VITE_DEV_PORT` from `apps/desktop/.env` for the main process (Vite already loads it for the renderer). */
function applyDesktopDotEnvForMain() {
  if (!isDev) return;
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (!existsSync(envPath)) return;
    const raw = readFileSync(envPath, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key === 'VITE_DEV_PORT' && /^\d+$/.test(val) && !process.env.VITE_DEV_PORT) {
        process.env.VITE_DEV_PORT = val;
      }
    }
  } catch {
    /* ignore missing or invalid .env */
  }
}

applyDesktopDotEnvForMain();

/** Must match Vite `server.port` when running `pnpm dev:desktop`. */
const viteDevPort = (() => {
  const raw = process.env.VITE_DEV_PORT;
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 1 && n <= 65535) return raw;
  }
  return '5173';
})();

/** Guardrail so IPC cannot stream multi-hundred-MB strings through the renderer. */
const MAX_FILE_READ_BYTES = 25 * 1024 * 1024;
const MAX_FILE_WRITE_BYTES = 25 * 1024 * 1024;
/** Live agent → renderer file patches larger than this trigger a disk re-read instead. */
const MAX_AGENT_FILECHANGE_BYTES = 2 * 1024 * 1024;

let mainWindow: BrowserWindow | null = null;
let currentProjectPath = '';

/** Directory roots the user opened (folder and/or parents of files from picker). FS IPC stays within these. */
let workspaceRoots: string[] = [];

const terminals = new Map<string, pty.IPty>();

function pathIsUnderRoot(absFile: string, root: string): boolean {
  const a = path.resolve(absFile);
  const r = path.resolve(root);
  if (a === r) return true;
  const rel = path.relative(r, a);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function addWorkspaceRoot(dir: string) {
  const r = path.resolve(dir.trim());
  if (!r) return;
  if (!workspaceRoots.some((x) => path.resolve(x) === r)) {
    workspaceRoots.push(r);
  }
}

function assertFsPathAllowed(filePath: string): string {
  const abs = path.resolve(String(filePath ?? '').trim());
  if (!abs) {
    throw new Error('Invalid path');
  }
  if (workspaceRoots.length === 0) {
    throw new Error('Open a folder or file first');
  }
  for (const root of workspaceRoots) {
    if (pathIsUnderRoot(abs, root)) {
      return abs;
    }
  }
  throw new Error('Path outside allowed workspace');
}

/** Shell CWD must stay inside an opened workspace root (or home when no project). */
function resolveTerminalCwd(requested?: string): string {
  const home = os.homedir();
  if (workspaceRoots.length === 0) {
    return home;
  }
  const fallback = path.resolve(
    (currentProjectPath && currentProjectPath.trim()) || workspaceRoots[0]!
  );
  const raw = typeof requested === 'string' ? requested.trim() : '';
  if (!raw) {
    return fallback;
  }
  const abs = path.resolve(raw);
  for (const root of workspaceRoots) {
    const r = path.resolve(root);
    if (abs === r || pathIsUnderRoot(abs, r)) {
      return abs;
    }
  }
  return fallback;
}

/** Directory the agent/indexer may use — must fall under an opened workspace root. */
async function resolveAllowedProjectRoot(projectPathArg?: string): Promise<string> {
  if (workspaceRoots.length === 0) {
    throw new Error('Open a folder or file first');
  }
  const pick =
    typeof projectPathArg === 'string' && projectPathArg.trim().length > 0
      ? projectPathArg.trim()
      : currentProjectPath;
  if (!pick) {
    throw new Error('No project path set');
  }
  const abs = path.resolve(pick);
  const allowed = workspaceRoots.some((root) => {
    const r = path.resolve(root);
    return abs === r || pathIsUnderRoot(abs, r);
  });
  if (!allowed) {
    throw new Error('Project path is outside the allowed workspace');
  }
  const st = await fs.stat(abs);
  if (!st.isDirectory()) {
    throw new Error('Project path must be a directory');
  }
  return abs;
}

/** Keep the app anchored to the dev server or packaged `file:` entry; open normal links in the OS browser. */
function isAllowedMainFrameNavigation(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'about:' && (u.pathname === 'blank' || url === 'about:blank')) {
      return true;
    }
    if (isDev) {
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      const host = u.hostname.toLowerCase();
      const loopback =
        host === 'localhost' || host === '127.0.0.1' || host === '::1';
      return loopback && u.port === viteDevPort;
    }
    return u.protocol === 'file:';
  } catch {
    return false;
  }
}

function shellCommand(): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return { file: 'powershell.exe', args: ['-NoLogo'] };
  }
  return { file: process.env.SHELL || '/bin/bash', args: ['-l'] };
}

app.on('before-quit', () => {
  void stopIndexWatcher();
  for (const [, term] of terminals) {
    term.kill();
  }
  terminals.clear();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  const wc = mainWindow.webContents;
  wc.on('will-navigate', (event, navigationUrl) => {
    if (isAllowedMainFrameNavigation(navigationUrl)) return;
    event.preventDefault();
  });
  wc.setWindowOpenHandler((details) => {
    const target = typeof details.url === 'string' ? details.url.trim() : '';
    if (/^https?:\/\//i.test(target)) {
      void shell.openExternal(target);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${viteDevPort}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('shell:openExternal', async (_, url: string) => {
  const target = typeof url === 'string' ? url.trim() : '';
  if (!target || !/^https?:\/\//i.test(target)) {
    return false;
  }
  await shell.openExternal(target);
  return true;
});

/** Open the OS file manager on a folder, or select a file inside its parent folder. */
ipcMain.handle('shell:revealInFolder', async (_, fullPath: string) => {
  let p: string;
  try {
    p = assertFsPathAllowed(fullPath);
  } catch {
    return false;
  }
  try {
    const st = await fs.stat(p);
    if (st.isDirectory()) {
      const ret = await shell.openPath(p);
      if (typeof ret === 'string') return ret.length === 0;
      return true;
    }
    shell.showItemInFolder(p);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

ipcMain.handle('window:toggleDevTools', () => {
  mainWindow?.webContents.toggleDevTools();
});

ipcMain.handle('window:setTitle', (_, raw: string) => {
  const title =
    String(raw ?? '')
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 240) || 'Auto-Coder';
  mainWindow?.setTitle(title);
});

ipcMain.handle('window:reload', () => {
  mainWindow?.webContents.reload();
});

ipcMain.handle('window:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

// ============ IPC HANDLERS ============

/** Picker starts here when a project / workspace root is known. */
function workspaceDialogDefaultDir(): string {
  const start =
    String(currentProjectPath).trim() ||
    (workspaceRoots.length > 0 ? String(workspaceRoots[0]) : '');
  return start ? path.resolve(start) : '';
}

// Open folder dialog
ipcMain.handle('dialog:openFolder', async () => {
  const dir = workspaceDialogDefaultDir();
  const opts = {
    properties: ['openDirectory'] as const,
    ...(dir ? { defaultPath: dir } : {}),
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, opts)
    : await dialog.showOpenDialog(opts);
  if (!result.canceled && result.filePaths[0]) {
    currentProjectPath = result.filePaths[0];
    workspaceRoots = [path.resolve(currentProjectPath)];
    return currentProjectPath;
  }
  return null;
});

ipcMain.handle('dialog:openFile', async (_, hint?: string) => {
  let defaultDir = workspaceDialogDefaultDir();
  if (typeof hint === 'string' && hint.trim().length > 0) {
    try {
      const abs = assertFsPathAllowed(path.resolve(hint.trim()));
      const st = await fs.stat(abs);
      defaultDir = st.isDirectory() ? abs : path.dirname(abs);
    } catch {
      /* keep defaultDir from workspace */
    }
  }
  const opts = {
    properties: ['openFile'] as const,
    filters: [
      { name: 'Code', extensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'html', 'css', 'py', 'rs', 'go', 'yaml', 'yml'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    ...(defaultDir ? { defaultPath: defaultDir } : {}),
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, opts)
    : await dialog.showOpenDialog(opts);
  if (!result.canceled && result.filePaths[0]) {
    const abs = path.resolve(result.filePaths[0]);
    if (workspaceRoots.length === 0) {
      const dir = path.dirname(abs);
      workspaceRoots = [dir];
      currentProjectPath = dir;
    } else if (!workspaceRoots.some((root) => pathIsUnderRoot(abs, root))) {
      addWorkspaceRoot(path.dirname(abs));
    }
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('dialog:saveFileAs', async (_, payload: unknown) => {
  let defaultPath: string;
  if (typeof payload === 'string') {
    const name = payload.trim() ? payload.trim() : 'untitled.txt';
    defaultPath = name;
  } else {
    const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const name =
      typeof p.defaultFileName === 'string' && p.defaultFileName.trim()
        ? p.defaultFileName.trim()
        : 'untitled.txt';
    const hint =
      typeof p.directoryHint === 'string' && p.directoryHint.trim() ? p.directoryHint.trim() : '';
    if (hint) {
      try {
        const dir = assertFsPathAllowed(path.resolve(hint));
        defaultPath = path.join(dir, path.basename(name));
      } catch {
        defaultPath = path.basename(name);
      }
    } else {
      defaultPath = path.basename(name);
    }
  }
  const saveOpts = {
    defaultPath,
    filters: [{ name: 'All Files', extensions: ['*'] }],
  };
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, saveOpts)
    : await dialog.showSaveDialog(saveOpts);
  if (!result.canceled && result.filePath) {
    const dir = path.dirname(path.resolve(result.filePath));
    addWorkspaceRoot(dir);
    if (!String(currentProjectPath).trim()) {
      currentProjectPath = dir;
    }
    return result.filePath;
  }
  return null;
});

// Get file tree
ipcMain.handle('fs:getFileTree', async (_, dirPath?: string) => {
  const target = dirPath || currentProjectPath;
  if (!target) return [];
  try {
    return getFileTree(assertFsPathAllowed(target));
  } catch {
    return [];
  }
});

// Read file
ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  const abs = assertFsPathAllowed(filePath);
  const st = await fs.stat(abs);
  if (!st.isFile()) {
    throw new Error('Path is not a file');
  }
  if (st.size > MAX_FILE_READ_BYTES) {
    throw new Error(
      `File is too large to open here (${st.size} bytes; max ${MAX_FILE_READ_BYTES})`
    );
  }
  return fs.readFile(abs, 'utf-8');
});

// Write file
ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  const abs = assertFsPathAllowed(filePath);
  const c = typeof content === 'string' ? content : '';
  const bytes = Buffer.byteLength(c, 'utf8');
  if (bytes > MAX_FILE_WRITE_BYTES) {
    throw new Error(
      `Content is too large to save (${bytes} bytes; max ${MAX_FILE_WRITE_BYTES})`
    );
  }
  await fs.writeFile(abs, c, 'utf-8');
  return true;
});

// Run agent
ipcMain.handle('agent:run', async (_, mission: string, projectPath?: string) => {
  const target = await resolveAllowedProjectRoot(projectPath);

  const missionText =
    typeof mission === 'string' ? mission.slice(0, 200_000) : '';

  const sendFileChange = (relOrAbs: string, text: string, reloadSuggested: boolean) => {
    mainWindow?.webContents.send('agent:fileChange', {
      filePath: relOrAbs,
      content: text,
      reloadSuggested,
    });
  };

  const result = await runAgent(missionText, {
    projectPath: target,
    onStatusChange: (status, message) => {
      mainWindow?.webContents.send('agent:status', { status, message });
    },
    onFileChange: (filePath, content) => {
      const c = typeof content === 'string' ? content : '';
      if (Buffer.byteLength(c, 'utf8') <= MAX_AGENT_FILECHANGE_BYTES) {
        sendFileChange(filePath, c, false);
        return;
      }
      void (async () => {
        try {
          const abs = path.isAbsolute(filePath)
            ? assertFsPathAllowed(filePath)
            : assertFsPathAllowed(path.resolve(target, filePath));
          const st = await fs.stat(abs);
          if (st.size <= MAX_FILE_READ_BYTES) {
            const disk = await fs.readFile(abs, 'utf-8');
            sendFileChange(filePath, disk, false);
            return;
          }
        } catch {
          /* fall through */
        }
        sendFileChange(filePath, '', true);
      })();
    },
  });

  return result;
});

// Index codebase
ipcMain.handle('indexer:index', async (_, projectPath?: string) => {
  const target = await resolveAllowedProjectRoot(projectPath);

  const chunks = await indexCodebase({
    projectPath: target,
    watchMode: true,
    onIndexComplete: (total) => {
      mainWindow?.webContents.send('indexer:complete', { total });
    },
  });

  return chunks.length;
});

// Search codebase
ipcMain.handle('indexer:search', async (_, query: string, topK = 10) => {
  const q = typeof query === 'string' ? query.slice(0, 4000) : '';
  const k = Math.min(100, Math.max(1, Math.floor(Number(topK)) || 10));
  return searchCodebase(q, k);
});

// Terminal (node-pty)
ipcMain.handle('terminal:create', async (_, opts: { cwd?: string } = {}) => {
  const req = opts && typeof opts.cwd === 'string' ? opts.cwd : undefined;
  const cwd = resolveTerminalCwd(req);
  const { file, args } = shellCommand();
  const env = Object.fromEntries(
    Object.entries({ ...process.env, TERM: 'xterm-256color' }).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  );

  const term = pty.spawn(file, args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env,
  });
  const id = randomUUID();
  terminals.set(id, term);
  term.onData((data) => {
    mainWindow?.webContents.send('terminal:data', { id, data });
  });
  term.onExit(() => {
    terminals.delete(id);
    mainWindow?.webContents.send('terminal:exit', { id });
  });
  return { id, cwd };
});

ipcMain.handle(
  'terminal:write',
  async (_, payload: { id: string; data: string }) => {
    if (!payload || typeof payload.id !== 'string') return;
    const data = typeof payload.data === 'string' ? payload.data : '';
    terminals.get(payload.id)?.write(data);
  }
);

ipcMain.handle(
  'terminal:resize',
  async (_, payload: { id: string; cols: number; rows: number }) => {
    if (!payload || typeof payload.id !== 'string') return;
    const cols = Math.min(500, Math.max(2, Math.floor(Number(payload.cols)) || 80));
    const rows = Math.min(500, Math.max(1, Math.floor(Number(payload.rows)) || 24));
    try {
      terminals.get(payload.id)?.resize(cols, rows);
    } catch {
      /* ignore invalid geometry */
    }
  }
);

ipcMain.handle('terminal:kill', async (_, payload: { id: string }) => {
  if (!payload || typeof payload.id !== 'string') return;
  const term = terminals.get(payload.id);
  if (term) {
    term.kill();
    terminals.delete(payload.id);
  }
});

// File tree helper
async function getFileTree(dir: string, depth = 0): Promise<ExplorerFileNode[]> {
  if (depth > 5) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const IGNORE = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.turbo',
    'coverage',
    '.cursor',
    '.auto-coder-memory',
  ];
  const tree: ExplorerFileNode[] = [];

  for (const entry of entries) {
    if (IGNORE.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      tree.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        children: await getFileTree(fullPath, depth + 1),
      });
    } else {
      tree.push({
        name: entry.name,
        path: fullPath,
        type: 'file',
        ext: path.extname(entry.name),
      });
    }
  }

  return tree.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
